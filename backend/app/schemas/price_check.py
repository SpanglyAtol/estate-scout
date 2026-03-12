from typing import Literal
from pydantic import BaseModel, Field


class PriceCheckRequest(BaseModel):
    # Item description
    title: str = Field(..., min_length=3, max_length=500)
    description: str | None = None
    image_url: str | None = None

    # Classification — all optional; more = better context for Claude
    category: str | None = None
    sub_category: str | None = None
    maker: str | None = None
    brand: str | None = None
    period: str | None = None
    country_of_origin: str | None = None
    condition: str | None = None

    # Market context
    asking_price: float | None = None       # Is this listing price fair?
    currency: str = "USD"


class ComparableSale(BaseModel):
    title: str
    price: float
    sale_date: str | None
    platform: str
    condition: str | None
    url: str | None


class MarketContextSnapshot(BaseModel):
    """Pre-aggregated market stats fed to Claude as context."""
    category: str | None
    maker: str | None
    period: str | None
    data_points: int
    median_price: float | None
    p25_price: float | None      # 25th percentile
    p75_price: float | None      # 75th percentile
    avg_days_to_sell: float | None
    trend: str | None            # "up" | "down" | "flat"
    pct_change_mom: float | None # month-over-month % change


class FingerprintMatch(BaseModel):
    """Exact provenance match (e.g. 'Rolex Ref 1675', '1/500 Miro print')."""
    edition_string: str | None
    is_limited_edition: bool
    reference_number: str | None
    avg_price: float | None
    min_price: float | None
    max_price: float | None
    total_appearances: int
    price_trend_pct: float | None


class PriceCheckResponse(BaseModel):
    # Core estimate
    estimated_low: float | None
    estimated_high: float | None
    estimated_median: float | None
    currency: str = "USD"

    # Quality signal
    confidence: Literal["high", "medium", "low", "insufficient_data"]
    data_points_used: int

    # Asking price verdict (only if asking_price was provided)
    asking_price: float | None = None
    asking_price_verdict: Literal["fair", "below_market", "above_market", "unknown"] | None = None
    asking_price_delta_pct: float | None = None  # % above/below median

    # Claude's reasoning (human-readable)
    reasoning: str
    key_value_factors: list[str]  # bullet points driving the estimate
    market_trend_summary: str | None

    # Supporting data
    comparable_sales: list[ComparableSale]
    market_context: MarketContextSnapshot | None
    fingerprint_match: FingerprintMatch | None

    # Meta
    data_source: Literal["claude_with_market_data", "claude_no_data", "template_fallback"]
    cached: bool = False
