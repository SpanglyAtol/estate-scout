"""
Price history service.

Responsibilities:
  1. Write price snapshots when scraper events occur (created / updated / completed)
  2. Query historical price time-series for a given segment
  3. Normalize condition strings into condition_buckets for cross-platform comparison
"""

from __future__ import annotations

import re
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.price_snapshot import PriceSnapshot


# ── Condition normalization ────────────────────────────────────────────────────

_EXCELLENT = re.compile(
    r"\b(mint|excellent|like new|pristine|perfect|nr|no reserve|gem)\b", re.I
)
_GOOD = re.compile(
    r"\b(good|very good|vg|fine|near fine|nice)\b", re.I
)
_FAIR = re.compile(
    r"\b(fair|acceptable|average|used|worn|light wear)\b", re.I
)
_POOR = re.compile(
    r"\b(poor|rough|damage|damaged|broken|crack|crack|restoration|repaired|as.?is)\b", re.I
)


def normalize_condition(condition: str | None) -> str:
    """Map a free-text condition string to a standard bucket."""
    if not condition:
        return "unknown"
    c = condition.lower()
    if _EXCELLENT.search(c):
        return "excellent"
    if _GOOD.search(c):
        return "good"
    if _FAIR.search(c):
        return "fair"
    if _POOR.search(c):
        return "poor"
    return "unknown"


# ── Snapshot writer ────────────────────────────────────────────────────────────

async def snapshot_listing(
    *,
    db: AsyncSession,
    listing_id: int,
    event_type: str,
    listing_data: dict[str, Any],
) -> None:
    """
    Write one immutable price_snapshot row.

    listing_data should contain the relevant fields from the Listing ORM object
    (or from a ScrapedListing after conversion).  Missing keys are silently
    treated as None.

    event_type: 'created' | 'price_updated' | 'completed' | 'expired'
    """
    condition_raw = listing_data.get("condition")
    snap = PriceSnapshot(
        listing_id=listing_id,
        event_type=event_type,
        current_price=listing_data.get("current_price"),
        bid_count=listing_data.get("bid_count"),
        is_completed=bool(listing_data.get("is_completed", False)),
        final_price=listing_data.get("final_price"),
        estimate_low=listing_data.get("estimate_low"),
        estimate_high=listing_data.get("estimate_high"),
        platform_id=listing_data.get("platform_id"),
        category=listing_data.get("category"),
        sub_category=listing_data.get("sub_category"),
        maker=listing_data.get("maker"),
        brand=listing_data.get("brand"),
        period=listing_data.get("period"),
        condition=condition_raw,
        condition_bucket=normalize_condition(condition_raw),
        snapped_at=datetime.now(timezone.utc),
    )
    db.add(snap)
    # Caller is responsible for committing the session.


# ── Historical query helpers ────────────────────────────────────────────────────

async def get_price_history(
    *,
    db: AsyncSession,
    category: str,
    maker: str | None = None,
    sub_category: str | None = None,
    period: str | None = None,
    condition_bucket: str | None = None,
    months: int = 24,
) -> list[dict]:
    """
    Return monthly median prices for a given segment, newest first.

    Uses price_snapshots directly (not the pre-aggregated market_price_index)
    so callers always get the freshest data without waiting for the nightly job.

    Returns list of:
      {time_bucket, sale_count, median_price, mean_price, p25_price, p75_price}
    """
    filters = [
        "is_completed = true",
        "final_price IS NOT NULL",
        f"snapped_at >= NOW() - INTERVAL '{months} months'",
        f"category = :category",
    ]
    params: dict[str, Any] = {"category": category}

    if maker:
        filters.append("maker = :maker")
        params["maker"] = maker
    if sub_category:
        filters.append("sub_category = :sub_category")
        params["sub_category"] = sub_category
    if period:
        filters.append("period = :period")
        params["period"] = period
    if condition_bucket and condition_bucket != "unknown":
        filters.append("condition_bucket = :condition_bucket")
        params["condition_bucket"] = condition_bucket

    where = " AND ".join(filters)

    sql = text(f"""
        SELECT
            DATE_TRUNC('month', snapped_at)::date                   AS time_bucket,
            COUNT(*)                                                 AS sale_count,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY final_price) AS median_price,
            ROUND(AVG(final_price)::numeric, 2)                      AS mean_price,
            PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY final_price) AS p25_price,
            PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY final_price) AS p75_price
        FROM price_snapshots
        WHERE {where}
        GROUP BY 1
        ORDER BY 1 DESC
    """)

    result = await db.execute(sql, params)
    rows = result.mappings().all()
    return [dict(r) for r in rows]


async def get_listing_price_timeline(
    *,
    db: AsyncSession,
    listing_id: int,
) -> list[dict]:
    """All snapshots for a single listing, chronological order."""
    stmt = (
        select(PriceSnapshot)
        .where(PriceSnapshot.listing_id == listing_id)
        .order_by(PriceSnapshot.snapped_at)
    )
    result = await db.execute(stmt)
    snaps = result.scalars().all()
    return [
        {
            "event_type":    s.event_type,
            "current_price": s.current_price,
            "final_price":   s.final_price,
            "is_completed":  s.is_completed,
            "snapped_at":    s.snapped_at.isoformat() if s.snapped_at else None,
        }
        for s in snaps
    ]
