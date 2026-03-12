"""
Market price intelligence API.

GET /api/v1/market/price-history   — raw monthly time-series from price_snapshots
GET /api/v1/market/index           — pre-aggregated market_price_index (nightly job)
GET /api/v1/market/fingerprint     — item provenance / limited-edition tracking
GET /api/v1/market/listing-timeline/{id} — bid/price history for one listing
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.item_fingerprint import FingerprintListing, ItemFingerprint
from app.schemas.market import (
    FingerprintResponse,
    ItemAppearance,
    MarketIndexBucket,
    MarketIndexResponse,
    PriceHistoryBucket,
    PriceHistoryResponse,
)
from app.services.market_index_service import get_market_index
from app.services.price_history_service import (
    get_listing_price_timeline,
    get_price_history,
)

router = APIRouter(prefix="/api/v1/market", tags=["market"])
log = logging.getLogger(__name__)


# ── Price history (raw aggregation from price_snapshots) ─────────────────────

@router.get("/price-history", response_model=PriceHistoryResponse)
async def price_history(
    category: str = Query(..., description="Category slug, e.g. 'watches', 'silver'"),
    maker: Optional[str] = Query(None, description="Maker slug, e.g. 'rolex', 'gorham'"),
    sub_category: Optional[str] = Query(None),
    period: Optional[str] = Query(None, description="Era slug, e.g. 'art_deco', 'victorian'"),
    condition_bucket: Optional[str] = Query(None, description="'excellent'|'good'|'fair'|'poor'"),
    months: int = Query(24, ge=1, le=60),
    db: AsyncSession = Depends(get_db),
):
    """
    Monthly median prices for a segment, newest-first.

    Example:
      GET /api/v1/market/price-history?category=watches&maker=rolex&months=24
      GET /api/v1/market/price-history?category=art&period=art_deco&condition_bucket=excellent
    """
    buckets_raw = await get_price_history(
        db=db,
        category=category,
        maker=maker,
        sub_category=sub_category,
        period=period,
        condition_bucket=condition_bucket,
        months=months,
    )

    buckets = [
        PriceHistoryBucket(
            time_bucket=r["time_bucket"],
            sale_count=int(r["sale_count"]),
            median_price=float(r["median_price"]) if r["median_price"] else None,
            mean_price=float(r["mean_price"]) if r["mean_price"] else None,
            p25_price=float(r["p25_price"]) if r["p25_price"] else None,
            p75_price=float(r["p75_price"]) if r["p75_price"] else None,
        )
        for r in buckets_raw
    ]

    return PriceHistoryResponse(
        category=category,
        maker=maker,
        sub_category=sub_category,
        period=period,
        condition_bucket=condition_bucket,
        months=months,
        buckets=buckets,
    )


# ── Market index (pre-aggregated, nightly refresh) ───────────────────────────

@router.get("/index", response_model=MarketIndexResponse)
async def market_index(
    category: str = Query(...),
    maker: Optional[str] = Query(None),
    sub_category: Optional[str] = Query(None),
    period: Optional[str] = Query(None),
    condition_bucket: Optional[str] = Query(None),
    months: int = Query(12, ge=1, le=24),
    db: AsyncSession = Depends(get_db),
):
    """
    Pre-aggregated market statistics with trend direction.
    Faster than /price-history because it reads the nightly-computed index table.
    Falls back to the rolled-up (NULL-dimension) bucket if the specific segment
    has fewer than 3 data points.

    Example:
      GET /api/v1/market/index?category=watches&maker=rolex&sub_category=luxury_sports_watches
      GET /api/v1/market/index?category=silver&maker=gorham
    """
    rows = await get_market_index(
        db=db,
        category=category,
        maker=maker,
        sub_category=sub_category,
        period=period,
        condition_bucket=condition_bucket,
        months=months,
    )

    def _to_bucket(r: dict) -> MarketIndexBucket:
        return MarketIndexBucket(
            time_bucket=r["time_bucket"],
            sale_count=r["sale_count"],
            median_price=float(r["median_price"]) if r["median_price"] else None,
            mean_price=float(r["mean_price"]) if r["mean_price"] else None,
            p25_price=float(r["p25_price"]) if r["p25_price"] else None,
            p75_price=float(r["p75_price"]) if r["p75_price"] else None,
            min_price=float(r["min_price"]) if r["min_price"] else None,
            max_price=float(r["max_price"]) if r["max_price"] else None,
            pct_change=float(r["pct_change"]) if r["pct_change"] else None,
            trend_direction=r.get("trend_direction"),
            avg_days_to_sell=float(r["avg_days_to_sell"]) if r["avg_days_to_sell"] else None,
        )

    history = [_to_bucket(r) for r in rows]
    current = history[0] if history else None

    return MarketIndexResponse(
        category=category,
        maker=maker,
        sub_category=sub_category,
        current=current,
        history=history,
    )


# ── Item fingerprint / provenance lookup ─────────────────────────────────────

@router.get("/fingerprint", response_model=list[FingerprintResponse])
async def search_fingerprints(
    q: str = Query(..., description="Free-text query (matched against title_normalized)"),
    maker: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    is_limited_edition: Optional[bool] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """
    Search for tracked items by normalized title keywords, maker, or category.
    Returns provenance records including all auction appearances and price trajectory.

    Example:
      GET /api/v1/market/fingerprint?q=basquiat&is_limited_edition=true
      GET /api/v1/market/fingerprint?maker=rolex&q=submariner
      GET /api/v1/market/fingerprint?q=seiko&category=watches
    """
    stmt = select(ItemFingerprint).where(
        ItemFingerprint.title_normalized.ilike(f"%{q.lower()}%")
    )
    if maker:
        stmt = stmt.where(ItemFingerprint.maker == maker)
    if category:
        stmt = stmt.where(ItemFingerprint.category == category)
    if is_limited_edition is not None:
        stmt = stmt.where(ItemFingerprint.is_limited_edition == is_limited_edition)

    stmt = stmt.order_by(ItemFingerprint.last_seen_at.desc()).limit(limit)

    result = await db.execute(stmt)
    fingerprints = result.scalars().all()

    # Fetch appearances for each fingerprint
    out: list[FingerprintResponse] = []
    for fp in fingerprints:
        apps_result = await db.execute(
            select(FingerprintListing)
            .where(FingerprintListing.fingerprint_id == fp.id)
            .order_by(FingerprintListing.sale_date.desc().nullslast())
        )
        appearances = [
            ItemAppearance(
                listing_id=a.listing_id,
                platform_id=a.platform_id,
                final_price=float(a.final_price) if a.final_price else None,
                condition=a.condition,
                sale_date=a.sale_date,
                seen_at=a.seen_at,
            )
            for a in apps_result.scalars().all()
        ]
        out.append(
            FingerprintResponse(
                id=str(fp.id),
                title_normalized=fp.title_normalized,
                maker=fp.maker,
                category=fp.category,
                sub_category=fp.sub_category,
                edition_string=fp.edition_string,
                edition_number=fp.edition_number,
                edition_size=fp.edition_size,
                edition_type=fp.edition_type,
                is_limited_edition=fp.is_limited_edition,
                reference_number=fp.reference_number,
                model=fp.model,
                material=fp.material,
                year_approx=fp.year_approx,
                fingerprint_hash=fp.fingerprint_hash,
                appearance_count=fp.appearance_count,
                first_seen_at=fp.first_seen_at,
                last_seen_at=fp.last_seen_at,
                first_sale_price=float(fp.first_sale_price) if fp.first_sale_price else None,
                last_sale_price=float(fp.last_sale_price) if fp.last_sale_price else None,
                min_sale_price=float(fp.min_sale_price) if fp.min_sale_price else None,
                max_sale_price=float(fp.max_sale_price) if fp.max_sale_price else None,
                avg_sale_price=float(fp.avg_sale_price) if fp.avg_sale_price else None,
                price_trend_pct=float(fp.price_trend_pct) if fp.price_trend_pct else None,
                appearances=appearances,
            )
        )

    return out


# ── Listing price timeline ────────────────────────────────────────────────────

@router.get("/listing-timeline/{listing_id}")
async def listing_timeline(
    listing_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Full bid/price history for a single listing — how did the price evolve during the auction?

    Example:
      GET /api/v1/market/listing-timeline/42
    """
    snapshots = await get_listing_price_timeline(db=db, listing_id=listing_id)
    if not snapshots:
        raise HTTPException(status_code=404, detail="No price history found for this listing.")
    return {"listing_id": listing_id, "timeline": snapshots}
