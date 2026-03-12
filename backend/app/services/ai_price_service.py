"""
AI Price Intelligence Service
──────────────────────────────
Uses Claude Opus 4.6 with adaptive thinking to provide expert antique/estate
price estimates. Three-layer context assembly:

  1. market_price_index  — pre-aggregated median/trend stats (nightly refresh)
  2. item_fingerprints   — provenance matches for limited editions / known models
  3. price_snapshots     — recent individual completed sales (comparables)

Claude receives all context in a structured prompt and reasons through the
estimate with adaptive thinking enabled. The response is parsed into a
structured PriceCheckResponse.
"""

import hashlib
import json
import logging
from datetime import datetime, timedelta

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.schemas.price_check import (
    ComparableSale,
    FingerprintMatch,
    MarketContextSnapshot,
    PriceCheckRequest,
    PriceCheckResponse,
)
from app.services.cache_service import CacheService

logger = logging.getLogger(__name__)

PRICE_CHECK_CACHE_TTL = 24 * 3600  # 24 hours — market data changes daily


class AiPriceService:
    def __init__(self, db: AsyncSession, cache: CacheService):
        self.db = db
        self.cache = cache

    # ── Public API ────────────────────────────────────────────────────────────

    async def check_price(self, req: PriceCheckRequest) -> PriceCheckResponse:
        cache_key = f"price_check:{self._hash_request(req)}"

        cached = await self.cache.get_json(cache_key)
        if cached:
            result = PriceCheckResponse(**cached)
            result.cached = True
            return result

        market_ctx = await self._get_market_context(req)
        fingerprint = await self._get_fingerprint_match(req)
        comps = await self._get_comparable_sales(req)

        if settings.claude_enabled:
            result = await self._claude_estimate(req, market_ctx, fingerprint, comps)
        else:
            result = self._template_estimate(req, market_ctx, fingerprint, comps)

        await self.cache.set_json(cache_key, result.model_dump(), ttl=PRICE_CHECK_CACHE_TTL)
        return result

    # ── Data layer ────────────────────────────────────────────────────────────

    async def _get_market_context(self, req: PriceCheckRequest) -> MarketContextSnapshot | None:
        """Pull the most specific market index row available for this item."""
        # Try progressively broader dimension combos until we find data
        combos = []
        if req.maker:
            combos.append({"category": req.category, "maker": req.maker, "period": req.period})
            combos.append({"category": req.category, "maker": req.maker, "period": None})
        if req.category:
            combos.append({"category": req.category, "maker": None, "period": req.period})
            combos.append({"category": req.category, "maker": None, "period": None})
        combos.append({"category": None, "maker": None, "period": None})  # overall fallback

        for combo in combos:
            row = await self.db.execute(
                text("""
                    SELECT
                        category, maker, period,
                        sale_count,
                        median_price, p25_price, p75_price,
                        avg_days_to_sell,
                        trend_direction, pct_change
                    FROM market_price_index
                    WHERE
                        (category = :category OR (:category IS NULL AND category IS NULL))
                        AND (maker = :maker OR (:maker IS NULL AND maker IS NULL))
                        AND (period = :period OR (:period IS NULL AND period IS NULL))
                    ORDER BY time_bucket DESC
                    LIMIT 1
                """),
                combo,
            )
            data = row.mappings().first()
            if data and data["sale_count"] >= 3:
                return MarketContextSnapshot(
                    category=data["category"],
                    maker=data["maker"],
                    period=data["period"],
                    data_points=data["sale_count"],
                    median_price=float(data["median_price"]) if data["median_price"] else None,
                    p25_price=float(data["p25_price"]) if data["p25_price"] else None,
                    p75_price=float(data["p75_price"]) if data["p75_price"] else None,
                    avg_days_to_sell=float(data["avg_days_to_sell"]) if data["avg_days_to_sell"] else None,
                    trend=data["trend_direction"],
                    pct_change_mom=float(data["pct_change"]) if data["pct_change"] else None,
                )
        return None

    async def _get_fingerprint_match(self, req: PriceCheckRequest) -> FingerprintMatch | None:
        """Check item_fingerprints for an exact provenance match."""
        if not req.maker:
            return None

        row = await self.db.execute(
            text("""
                SELECT
                    edition_string, is_limited_edition, reference_number,
                    avg_price, min_price, max_price,
                    total_appearances, price_trend_pct
                FROM item_fingerprints
                WHERE maker ILIKE :maker
                  AND (:ref IS NULL OR reference_number ILIKE :ref)
                  AND (
                      :edition IS NULL
                      OR edition_string ILIKE :edition
                      OR title_normalized ILIKE '%' || :title_fragment || '%'
                  )
                ORDER BY total_appearances DESC
                LIMIT 1
            """),
            {
                "maker": req.maker,
                "ref": None,  # Could extract from title in future
                "edition": None,
                "title_fragment": req.title[:30],
            },
        )
        data = row.mappings().first()
        if not data:
            return None

        return FingerprintMatch(
            edition_string=data["edition_string"],
            is_limited_edition=bool(data["is_limited_edition"]),
            reference_number=data["reference_number"],
            avg_price=float(data["avg_price"]) if data["avg_price"] else None,
            min_price=float(data["min_price"]) if data["min_price"] else None,
            max_price=float(data["max_price"]) if data["max_price"] else None,
            total_appearances=data["total_appearances"] or 0,
            price_trend_pct=float(data["price_trend_pct"]) if data["price_trend_pct"] else None,
        )

    async def _get_comparable_sales(self, req: PriceCheckRequest) -> list[ComparableSale]:
        """Fetch recent completed sales from price_snapshots as comparables."""
        cutoff = datetime.utcnow() - timedelta(days=365)
        result = await self.db.execute(
            text("""
                SELECT DISTINCT ON (ps.listing_id)
                    ps.title, ps.price_at_snapshot as price,
                    ps.created_at as sale_date,
                    ps.platform_slug as platform,
                    ps.condition_bucket as condition,
                    l.external_url as url
                FROM price_snapshots ps
                LEFT JOIN listings l ON l.id = ps.listing_id
                WHERE ps.event_type IN ('completed', 'sold')
                  AND ps.price_at_snapshot IS NOT NULL
                  AND ps.created_at >= :cutoff
                  AND (
                      (:category IS NULL OR ps.category ILIKE :category)
                      AND (:maker IS NULL OR ps.maker ILIKE :maker)
                  )
                ORDER BY ps.listing_id, ps.created_at DESC
                LIMIT 12
            """),
            {
                "cutoff": cutoff,
                "category": req.category,
                "maker": req.maker,
            },
        )
        comps = []
        for row in result.mappings():
            sale_date = row.get("sale_date")
            comps.append(ComparableSale(
                title=row["title"] or "Unknown",
                price=float(row["price"]),
                sale_date=sale_date.isoformat() if isinstance(sale_date, datetime) else sale_date,
                platform=row["platform"] or "unknown",
                condition=row.get("condition"),
                url=row.get("url"),
            ))
        return comps

    # ── Claude estimate ───────────────────────────────────────────────────────

    async def _claude_estimate(
        self,
        req: PriceCheckRequest,
        market_ctx: MarketContextSnapshot | None,
        fingerprint: FingerprintMatch | None,
        comps: list[ComparableSale],
    ) -> PriceCheckResponse:
        try:
            import anthropic

            client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

            prompt = self._build_prompt(req, market_ctx, fingerprint, comps)
            system = self._system_prompt()

            # Opus 4.6 with adaptive thinking — model decides how much reasoning
            # is needed based on data richness and complexity
            async with client.messages.stream(
                model=settings.anthropic_model,
                max_tokens=4096,
                thinking={"type": "adaptive"},
                system=system,
                messages=[{"role": "user", "content": prompt}],
            ) as stream:
                response = await stream.get_final_message()

            # Extract the text block (thinking blocks are separate)
            text_content = next(
                (b.text for b in response.content if b.type == "text"), ""
            )

            return self._parse_claude_response(text_content, req, market_ctx, fingerprint, comps)

        except Exception as e:
            logger.error(f"Claude price check failed: {e}")
            return self._template_estimate(req, market_ctx, fingerprint, comps)

    def _system_prompt(self) -> str:
        return """You are an expert antique, collectible, and estate sale appraiser with 30+ years of experience at major auction houses (Christie's, Sotheby's, Heritage Auctions) and specialized knowledge across furniture, jewelry, silver, ceramics, art, watches, and decorative arts.

You analyze items using provided market data and comparable sales to give accurate, data-backed price estimates. You understand what drives value: maker reputation, period authenticity, condition grading, provenance, rarity, and current market trends.

Always respond in valid JSON matching this exact schema:
{
  "estimated_low": <number or null>,
  "estimated_high": <number or null>,
  "estimated_median": <number or null>,
  "confidence": "high" | "medium" | "low" | "insufficient_data",
  "reasoning": "<2-4 sentence expert analysis>",
  "key_value_factors": ["<factor 1>", "<factor 2>", ...],
  "market_trend_summary": "<1 sentence about price trend or null>",
  "asking_price_verdict": "fair" | "below_market" | "above_market" | "unknown" | null,
  "asking_price_delta_pct": <number or null>
}

Confidence levels:
- "high": 10+ comparable sales, strong market index data
- "medium": 3-9 comparable sales or market index only
- "low": 1-2 comparables, limited data, significant uncertainty
- "insufficient_data": Cannot reliably estimate

For asking_price_verdict:
- "fair": within ±15% of estimated median
- "below_market": >15% below estimated median (good deal for buyer)
- "above_market": >15% above estimated median (overpriced)
- asking_price_delta_pct: positive = above median, negative = below"""

    def _build_prompt(
        self,
        req: PriceCheckRequest,
        market_ctx: MarketContextSnapshot | None,
        fingerprint: FingerprintMatch | None,
        comps: list[ComparableSale],
    ) -> str:
        parts = ["## Item Details\n"]
        parts.append(f"**Title:** {req.title}")
        if req.description:
            parts.append(f"**Description:** {req.description[:500]}")
        if req.category:
            parts.append(f"**Category:** {req.category}" + (f" / {req.sub_category}" if req.sub_category else ""))
        if req.maker:
            parts.append(f"**Maker/Artist:** {req.maker}")
        if req.brand:
            parts.append(f"**Brand:** {req.brand}")
        if req.period:
            parts.append(f"**Period/Era:** {req.period}")
        if req.country_of_origin:
            parts.append(f"**Origin:** {req.country_of_origin}")
        if req.condition:
            parts.append(f"**Condition:** {req.condition}")
        if req.asking_price:
            parts.append(f"**Asking Price:** ${req.asking_price:,.2f} {req.currency}")

        if market_ctx:
            parts.append("\n## Market Index Data (Pre-Aggregated)")
            parts.append(f"Scope: {market_ctx.category or 'all'} / {market_ctx.maker or 'all makers'} / {market_ctx.period or 'all periods'}")
            parts.append(f"Based on {market_ctx.data_points} completed sales:")
            if market_ctx.median_price:
                parts.append(f"  - Median sale price: ${market_ctx.median_price:,.0f}")
            if market_ctx.p25_price and market_ctx.p75_price:
                parts.append(f"  - Price range (25th–75th pct): ${market_ctx.p25_price:,.0f} – ${market_ctx.p75_price:,.0f}")
            if market_ctx.trend:
                trend_str = {"up": "↑ Rising", "down": "↓ Falling", "flat": "→ Stable"}.get(market_ctx.trend, market_ctx.trend)
                parts.append(f"  - Market trend: {trend_str}" + (f" ({market_ctx.pct_change_mom:+.1f}% MoM)" if market_ctx.pct_change_mom else ""))
            if market_ctx.avg_days_to_sell:
                parts.append(f"  - Avg days to sell: {market_ctx.avg_days_to_sell:.0f}")

        if fingerprint:
            parts.append("\n## Provenance / Fingerprint Match")
            if fingerprint.reference_number:
                parts.append(f"Reference: {fingerprint.reference_number}")
            if fingerprint.edition_string:
                parts.append(f"Edition: {fingerprint.edition_string} (limited: {fingerprint.is_limited_edition})")
            if fingerprint.avg_price:
                parts.append(f"Historical avg price: ${fingerprint.avg_price:,.0f} (from {fingerprint.total_appearances} auction appearances)")
            if fingerprint.min_price and fingerprint.max_price:
                parts.append(f"Price range ever seen: ${fingerprint.min_price:,.0f} – ${fingerprint.max_price:,.0f}")
            if fingerprint.price_trend_pct is not None:
                parts.append(f"Price trend: {fingerprint.price_trend_pct:+.1f}% vs. prior period")

        if comps:
            parts.append(f"\n## Comparable Completed Sales ({len(comps)} found)")
            for c in comps[:10]:
                cond = f" [{c.condition}]" if c.condition else ""
                date_str = f" — {c.sale_date[:10]}" if c.sale_date else ""
                parts.append(f"  - {c.title[:60]}: ${c.price:,.0f}{cond} ({c.platform}{date_str})")
        else:
            parts.append("\n## Comparable Sales: None found in database")

        if not market_ctx and not comps and not fingerprint:
            parts.append("\nNote: No market data available. Use general expertise and knowledge of this item category to provide a best-effort estimate, making clear it is based on general market knowledge rather than our specific sales database.")

        parts.append("\nProvide your expert price assessment as JSON.")
        return "\n".join(parts)

    def _parse_claude_response(
        self,
        text_content: str,
        req: PriceCheckRequest,
        market_ctx: MarketContextSnapshot | None,
        fingerprint: FingerprintMatch | None,
        comps: list[ComparableSale],
    ) -> PriceCheckResponse:
        # Extract JSON from Claude's response
        try:
            # Strip markdown fences if present
            cleaned = text_content.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("```")[1]
                if cleaned.startswith("json"):
                    cleaned = cleaned[4:]
                cleaned = cleaned.strip()

            data = json.loads(cleaned)
        except (json.JSONDecodeError, IndexError) as e:
            logger.warning(f"Failed to parse Claude JSON: {e}\nResponse: {text_content[:200]}")
            return self._template_estimate(req, market_ctx, fingerprint, comps)

        data_points = (market_ctx.data_points if market_ctx else 0) + len(comps)
        if fingerprint:
            data_points += fingerprint.total_appearances

        return PriceCheckResponse(
            estimated_low=data.get("estimated_low"),
            estimated_high=data.get("estimated_high"),
            estimated_median=data.get("estimated_median"),
            confidence=data.get("confidence", "low"),
            data_points_used=data_points,
            asking_price=req.asking_price,
            asking_price_verdict=data.get("asking_price_verdict"),
            asking_price_delta_pct=data.get("asking_price_delta_pct"),
            reasoning=data.get("reasoning", ""),
            key_value_factors=data.get("key_value_factors", []),
            market_trend_summary=data.get("market_trend_summary"),
            comparable_sales=comps[:8],
            market_context=market_ctx,
            fingerprint_match=fingerprint,
            data_source="claude_with_market_data" if (market_ctx or comps) else "claude_no_data",
            cached=False,
        )

    # ── Fallback (no Claude key) ───────────────────────────────────────────────

    def _template_estimate(
        self,
        req: PriceCheckRequest,
        market_ctx: MarketContextSnapshot | None,
        fingerprint: FingerprintMatch | None,
        comps: list[ComparableSale],
    ) -> PriceCheckResponse:
        prices = [c.price for c in comps if c.price]
        if fingerprint and fingerprint.avg_price:
            prices.append(fingerprint.avg_price)

        if market_ctx and market_ctx.median_price:
            low = market_ctx.p25_price
            high = market_ctx.p75_price
            median = market_ctx.median_price
            confidence = "medium" if market_ctx.data_points >= 10 else "low"
        elif prices:
            sorted_prices = sorted(prices)
            low = sorted_prices[0]
            high = sorted_prices[-1]
            median = sorted_prices[len(sorted_prices) // 2]
            confidence = "medium" if len(prices) >= 5 else "low"
        else:
            low = high = median = None
            confidence = "insufficient_data"

        verdict = None
        delta_pct = None
        if req.asking_price and median:
            delta_pct = ((req.asking_price - median) / median) * 100
            if abs(delta_pct) <= 15:
                verdict = "fair"
            elif delta_pct > 15:
                verdict = "above_market"
            else:
                verdict = "below_market"

        if median:
            reasoning = (
                f"Based on {market_ctx.data_points if market_ctx else len(prices)} "
                f"comparable sales, similar items typically sell around "
                f"${median:,.0f}. Add an ANTHROPIC_API_KEY to get expert AI analysis."
            )
        else:
            reasoning = (
                "No comparable sales found in our database for this item. "
                "Set ANTHROPIC_API_KEY to enable AI-powered estimates using general market expertise."
            )

        return PriceCheckResponse(
            estimated_low=low,
            estimated_high=high,
            estimated_median=median,
            confidence=confidence,
            data_points_used=len(comps) + (market_ctx.data_points if market_ctx else 0),
            asking_price=req.asking_price,
            asking_price_verdict=verdict,
            asking_price_delta_pct=delta_pct,
            reasoning=reasoning,
            key_value_factors=[],
            market_trend_summary=f"Market trend: {market_ctx.trend}" if market_ctx and market_ctx.trend else None,
            comparable_sales=comps[:8],
            market_context=market_ctx,
            fingerprint_match=fingerprint,
            data_source="template_fallback",
            cached=False,
        )

    # ── Utilities ─────────────────────────────────────────────────────────────

    @staticmethod
    def _hash_request(req: PriceCheckRequest) -> str:
        key = json.dumps({
            "title": req.title.lower().strip(),
            "category": req.category,
            "maker": req.maker,
            "period": req.period,
            "condition": req.condition,
            "asking_price": req.asking_price,
        }, sort_keys=True)
        return hashlib.sha256(key.encode()).hexdigest()[:32]
