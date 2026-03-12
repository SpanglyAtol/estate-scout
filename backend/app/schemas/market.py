from __future__ import annotations

from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel


class PriceHistoryBucket(BaseModel):
    time_bucket: date
    sale_count: int
    median_price: Optional[float]
    mean_price: Optional[float]
    p25_price: Optional[float]
    p75_price: Optional[float]


class PriceHistoryResponse(BaseModel):
    category: str
    maker: Optional[str]
    sub_category: Optional[str]
    period: Optional[str]
    condition_bucket: Optional[str]
    months: int
    buckets: list[PriceHistoryBucket]


class MarketIndexBucket(BaseModel):
    time_bucket: str              # ISO date string (first of month)
    sale_count: int
    median_price: Optional[float]
    mean_price: Optional[float]
    p25_price: Optional[float]
    p75_price: Optional[float]
    min_price: Optional[float]
    max_price: Optional[float]
    pct_change: Optional[float]
    trend_direction: Optional[str]
    avg_days_to_sell: Optional[float]


class MarketIndexResponse(BaseModel):
    category: str
    maker: Optional[str]
    sub_category: Optional[str]
    current: Optional[MarketIndexBucket]    # most recent month
    history: list[MarketIndexBucket]        # full window


class ItemAppearance(BaseModel):
    listing_id: int
    platform_id: Optional[int]
    final_price: Optional[float]
    condition: Optional[str]
    sale_date: Optional[datetime]
    seen_at: datetime


class FingerprintResponse(BaseModel):
    id: str
    title_normalized: str
    maker: Optional[str]
    category: Optional[str]
    sub_category: Optional[str]

    # Edition
    edition_string: Optional[str]
    edition_number: Optional[int]
    edition_size: Optional[int]
    edition_type: Optional[str]
    is_limited_edition: bool

    # Watch / collectible signals
    reference_number: Optional[str]
    model: Optional[str]
    material: Optional[str]
    year_approx: Optional[int]

    # Provenance stats
    fingerprint_hash: str
    appearance_count: int
    first_seen_at: datetime
    last_seen_at: datetime
    first_sale_price: Optional[float]
    last_sale_price: Optional[float]
    min_sale_price: Optional[float]
    max_sale_price: Optional[float]
    avg_sale_price: Optional[float]
    price_trend_pct: Optional[float]

    appearances: list[ItemAppearance] = []
