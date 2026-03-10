"""
Market index service — nightly aggregation job.

Reads completed sales from price_snapshots and writes pre-aggregated statistics
into market_price_index.  Called by the scheduler once per night.

Produces two levels of rollup per segment (category × maker × sub_category × period × condition_bucket):
  - 'monthly' buckets going back 24 months
  - Trend direction by comparing current month's median to prior month's median

Query strategy: uses PostgreSQL window functions + PERCENTILE_CONT so we never
load raw price rows into Python memory — all percentile math stays in the DB.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timezone

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

log = logging.getLogger(__name__)

# Segments we want to track. Each entry = one dimension combination.
# NULL maker / sub_category / period = rolled-up "all" aggregate for that category.
# The SQL generates these via GROUPING SETS so one query covers all combos.
_GROUPING_SETS_SQL = """
    GROUPING SETS (
        (category),
        (category, maker),
        (category, sub_category),
        (category, maker, sub_category),
        (category, maker, period),
        (category, maker, sub_category, period),
        (category, maker, sub_category, period, condition_bucket)
    )
"""

_UPSERT_MARKET_INDEX = text("""
INSERT INTO market_price_index (
    category, maker, sub_category, period, condition_bucket,
    time_bucket, bucket_type,
    sale_count, median_price, mean_price,
    p25_price, p75_price, min_price, max_price,
    avg_days_to_sell,
    computed_at
)
SELECT
    category,
    maker,
    sub_category,
    period,
    condition_bucket,
    DATE_TRUNC('month', snapped_at)::date                                  AS time_bucket,
    'monthly'                                                              AS bucket_type,
    COUNT(*)                                                               AS sale_count,
    PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY final_price)             AS median_price,
    ROUND(AVG(final_price)::numeric, 2)                                    AS mean_price,
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY final_price)             AS p25_price,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY final_price)             AS p75_price,
    MIN(final_price)                                                       AS min_price,
    MAX(final_price)                                                       AS max_price,
    ROUND(
        AVG(EXTRACT(EPOCH FROM (snapped_at - listing_created_at)) / 86400)::numeric,
        1
    )                                                                      AS avg_days_to_sell,
    NOW()                                                                  AS computed_at
FROM (
    SELECT
        ps.category,
        ps.maker,
        ps.sub_category,
        ps.period,
        ps.condition_bucket,
        ps.final_price,
        ps.snapped_at,
        -- Join back to listings for created_at so we can compute velocity
        l.scraped_at AS listing_created_at
    FROM price_snapshots ps
    LEFT JOIN listings l ON l.id = ps.listing_id
    WHERE ps.is_completed = true
      AND ps.final_price  IS NOT NULL
      AND ps.final_price  > 0
      AND ps.snapped_at   >= NOW() - INTERVAL '25 months'
) base
GROUP BY """ + _GROUPING_SETS_SQL + """
HAVING COUNT(*) >= 3          -- only emit a bucket if we have ≥3 data points
ON CONFLICT ON CONSTRAINT uq_market_index_segment
DO UPDATE SET
    sale_count       = EXCLUDED.sale_count,
    median_price     = EXCLUDED.median_price,
    mean_price       = EXCLUDED.mean_price,
    p25_price        = EXCLUDED.p25_price,
    p75_price        = EXCLUDED.p75_price,
    min_price        = EXCLUDED.min_price,
    max_price        = EXCLUDED.max_price,
    avg_days_to_sell = EXCLUDED.avg_days_to_sell,
    computed_at      = EXCLUDED.computed_at
""")

# Second pass: compute trend direction by comparing each bucket to the one before it.
_UPDATE_TRENDS = text("""
UPDATE market_price_index mpi
SET
    prior_median    = prev.median_price,
    pct_change      = CASE
                        WHEN prev.median_price IS NULL OR prev.median_price = 0 THEN NULL
                        ELSE ROUND(
                            (mpi.median_price - prev.median_price)::numeric
                            / prev.median_price::numeric * 100,
                            4
                        )
                      END,
    trend_direction = CASE
                        WHEN prev.median_price IS NULL OR prev.median_price = 0 THEN NULL
                        WHEN mpi.median_price > prev.median_price * 1.03 THEN 'up'
                        WHEN mpi.median_price < prev.median_price * 0.97 THEN 'down'
                        ELSE 'flat'
                      END
FROM market_price_index prev
WHERE
    mpi.bucket_type    = prev.bucket_type
    AND mpi.time_bucket = (prev.time_bucket + INTERVAL '1 month')::date
    -- NULL-safe dimension matching
    AND (mpi.category        = prev.category        OR (mpi.category        IS NULL AND prev.category        IS NULL))
    AND (mpi.maker           = prev.maker           OR (mpi.maker           IS NULL AND prev.maker           IS NULL))
    AND (mpi.sub_category    = prev.sub_category    OR (mpi.sub_category    IS NULL AND prev.sub_category    IS NULL))
    AND (mpi.period          = prev.period          OR (mpi.period          IS NULL AND prev.period          IS NULL))
    AND (mpi.condition_bucket= prev.condition_bucket OR (mpi.condition_bucket IS NULL AND prev.condition_bucket IS NULL))
""")


async def refresh_market_index(db: AsyncSession) -> dict:
    """
    Run the full nightly market index refresh.

    Returns a summary dict with row counts for logging / monitoring.
    Called by scheduler.py once per night.
    """
    log.info("Market index refresh: starting aggregation pass")
    start = datetime.now(timezone.utc)

    result = await db.execute(_UPSERT_MARKET_INDEX)
    upserted = result.rowcount
    log.info("Market index refresh: upserted %d segment-bucket rows", upserted)

    await db.execute(_UPDATE_TRENDS)
    log.info("Market index refresh: trend directions updated")

    await db.commit()

    elapsed = (datetime.now(timezone.utc) - start).total_seconds()
    log.info("Market index refresh: done in %.1fs", elapsed)

    return {"upserted_rows": upserted, "elapsed_seconds": elapsed}


async def get_market_index(
    *,
    db: AsyncSession,
    category: str,
    maker: str | None = None,
    sub_category: str | None = None,
    period: str | None = None,
    condition_bucket: str | None = None,
    months: int = 12,
) -> list[dict]:
    """
    Query the pre-aggregated market_price_index for a specific segment.
    Returns monthly buckets newest-first.

    Falls back to null-dimension rollups if the specific combination has
    fewer than 3 data points (enforced at write time by HAVING COUNT(*) >= 3).
    """
    filters = [
        "category = :category",
        "bucket_type = 'monthly'",
        "time_bucket >= (CURRENT_DATE - (:months || ' months')::interval)::date",
    ]
    params: dict = {"category": category, "months": months}

    for field, val in [
        ("maker", maker),
        ("sub_category", sub_category),
        ("period", period),
        ("condition_bucket", condition_bucket),
    ]:
        if val:
            filters.append(f"{field} = :{field}")
            params[field] = val
        else:
            filters.append(f"{field} IS NULL")

    where = " AND ".join(filters)

    sql = text(f"""
        SELECT
            time_bucket,
            sale_count,
            median_price,
            mean_price,
            p25_price,
            p75_price,
            min_price,
            max_price,
            pct_change,
            trend_direction,
            avg_days_to_sell
        FROM market_price_index
        WHERE {where}
        ORDER BY time_bucket DESC
        LIMIT :months
    """)

    result = await db.execute(sql, params)
    rows = result.mappings().all()
    return [
        {**dict(r), "time_bucket": r["time_bucket"].isoformat()}
        for r in rows
    ]


async def get_current_market_stats(
    *,
    db: AsyncSession,
    category: str,
    maker: str | None = None,
    sub_category: str | None = None,
) -> dict | None:
    """
    Return just the most recent month's stats for a segment — the 'current market price'.
    Used by the API for quick lookups ("what's a Rolex Submariner worth right now?").
    """
    rows = await get_market_index(
        db=db,
        category=category,
        maker=maker,
        sub_category=sub_category,
        months=1,
    )
    return rows[0] if rows else None
