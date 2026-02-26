import hashlib
import json
import logging
from datetime import datetime

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.listing import Listing
from app.models.platform import Platform
from app.schemas.valuation import CompSale, PriceRange, ValuationResponse
from app.services.cache_service import CacheService
from app.services.embedding_service import EmbeddingService

logger = logging.getLogger(__name__)

VALUATION_CACHE_TTL = 7 * 24 * 3600  # 7 days


class ValuationService:
    def __init__(self, db: AsyncSession, cache: CacheService):
        self.db = db
        self.cache = cache
        self.embeddings = EmbeddingService()

    async def query(self, query_text: str, image_url: str | None = None) -> ValuationResponse:
        cache_key = f"valuation:{self._hash(query_text)}"

        # 1. Check cache
        cached = await self.cache.get_json(cache_key)
        if cached:
            result = ValuationResponse(**cached)
            result.cached = True
            return result

        # 2. Embed query (None if no API key)
        embedding = await self.embeddings.embed_text(query_text)

        # 3. Find comparable completed sales
        comps = await self._find_comps(query_text, embedding, limit=10)

        # 4. Calculate price range
        price_range = self._calculate_price_range(comps)

        # 5. Generate narrative
        if settings.ai_enabled and comps:
            narrative = await self._llm_narrative(query_text, comps, price_range)
            data_source = "ai"
        else:
            narrative = self._template_narrative(comps, price_range)
            data_source = "comps_only" if comps else "no_data"

        result = ValuationResponse(
            query=query_text,
            price_range=price_range,
            comparable_sales=comps,
            narrative=narrative,
            data_source=data_source,
            cached=False,
        )

        # 6. Cache result
        await self.cache.set_json(cache_key, result.model_dump(), ttl=VALUATION_CACHE_TTL)
        return result

    async def _find_comps(
        self, query_text: str, embedding: list[float] | None, limit: int = 10
    ) -> list[CompSale]:
        if embedding is not None:
            return await self._vector_search(embedding, limit)
        return await self._fulltext_search(query_text, limit)

    async def _vector_search(self, embedding: list[float], limit: int) -> list[CompSale]:
        vector_str = "[" + ",".join(str(x) for x in embedding) + "]"
        result = await self.db.execute(
            text("""
                SELECT
                    l.id, l.title, l.final_price, l.sale_ends_at,
                    l.external_url, l.primary_image_url, l.condition,
                    p.display_name as platform_display_name,
                    1 - (e.embedding <=> :embedding::vector) as similarity
                FROM embedding_cache e
                JOIN listings l ON l.id = e.listing_id
                JOIN platforms p ON p.id = l.platform_id
                WHERE l.is_completed = true AND l.final_price IS NOT NULL
                ORDER BY e.embedding <=> :embedding::vector
                LIMIT :limit
            """),
            {"embedding": vector_str, "limit": limit},
        )
        return [self._row_to_comp(row) for row in result.mappings()]

    async def _fulltext_search(self, query_text: str, limit: int) -> list[CompSale]:
        result = await self.db.execute(
            text("""
                SELECT
                    l.id, l.title, l.final_price, l.sale_ends_at,
                    l.external_url, l.primary_image_url, l.condition,
                    p.display_name as platform_display_name,
                    ts_rank(l.search_vector, query) as similarity
                FROM listings l
                JOIN platforms p ON p.id = l.platform_id,
                     to_tsquery('english', :query) query
                WHERE l.is_completed = true
                  AND l.final_price IS NOT NULL
                  AND l.search_vector @@ query
                ORDER BY similarity DESC
                LIMIT :limit
            """),
            {"query": " & ".join(query_text.split()[:10]), "limit": limit},
        )
        return [self._row_to_comp(row) for row in result.mappings()]

    def _row_to_comp(self, row: dict) -> CompSale:
        sale_date = row.get("sale_ends_at")
        return CompSale(
            listing_id=row["id"],
            title=row["title"],
            final_price=float(row["final_price"]),
            sale_date=sale_date.isoformat() if isinstance(sale_date, datetime) else sale_date,
            platform_display_name=row["platform_display_name"],
            external_url=row["external_url"],
            primary_image_url=row.get("primary_image_url"),
            condition=row.get("condition"),
            similarity_score=float(row.get("similarity") or 0),
        )

    def _calculate_price_range(self, comps: list[CompSale]) -> PriceRange:
        prices = sorted(c.final_price for c in comps if c.final_price)
        if not prices:
            return PriceRange(low=None, mid=None, high=None, count=0)
        trim = max(1, len(prices) // 10) if len(prices) > 5 else 0
        trimmed = prices[trim : len(prices) - trim] if trim else prices
        mid_idx = len(trimmed) // 2
        return PriceRange(
            low=round(trimmed[0], 2),
            mid=round(trimmed[mid_idx], 2),
            high=round(trimmed[-1], 2),
            count=len(prices),
        )

    def _template_narrative(self, comps: list[CompSale], price_range: PriceRange) -> str:
        if not comps:
            return (
                "No comparable sales found in our database yet. "
                "Try describing the item differently or check back as we add more data."
            )
        return (
            f"Based on {price_range.count} comparable completed sales, "
            f"similar items typically sell between "
            f"${price_range.low:,.0f} and ${price_range.high:,.0f}, "
            f"with a median around ${price_range.mid:,.0f}. "
            f"Add an OpenAI API key to get AI-powered analysis and recommendations."
        )

    async def _llm_narrative(
        self, query: str, comps: list[CompSale], price_range: PriceRange
    ) -> str:
        try:
            from openai import AsyncOpenAI

            client = AsyncOpenAI(api_key=settings.openai_api_key)
            comp_lines = "\n".join(
                f"- {c.title}: ${c.final_price:,.0f} ({c.platform_display_name}, {c.sale_date or 'date unknown'})"
                for c in comps[:8]
            )
            response = await client.chat.completions.create(
                model=settings.openai_chat_model,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are an expert antique and estate sale appraiser. "
                            "Give concise, helpful valuation guidance based on comparable sales data. "
                            "Be specific about what factors affect value. Keep response under 150 words."
                        ),
                    },
                    {
                        "role": "user",
                        "content": (
                            f"Item: {query}\n\n"
                            f"Comparable sales:\n{comp_lines}\n\n"
                            f"Price range: ${price_range.low:,.0f} - ${price_range.high:,.0f} "
                            f"(median ${price_range.mid:,.0f})\n\n"
                            "Provide a valuation estimate with key factors that affect value."
                        ),
                    },
                ],
                max_tokens=200,
                temperature=0.3,
            )
            return response.choices[0].message.content or self._template_narrative(comps, price_range)
        except Exception as e:
            logger.error(f"LLM narrative failed: {e}")
            return self._template_narrative(comps, price_range)

    @staticmethod
    def _hash(text: str) -> str:
        return hashlib.sha256(text.lower().strip().encode()).hexdigest()
