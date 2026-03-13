from datetime import datetime
from pydantic import BaseModel, Field


class PlatformOut(BaseModel):
    id: int
    name: str
    display_name: str
    base_url: str
    logo_url: str | None

    model_config = {"from_attributes": True}


class ListingOut(BaseModel):
    id: int
    platform: PlatformOut
    external_id: str
    external_url: str
    title: str
    description: str | None
    category: str | None
    condition: str | None
    listing_type: str = "auction"
    item_type: str = "individual_item"
    auction_status: str = "upcoming"
    current_price: float | None
    final_price: float | None
    is_completed: bool
    buyers_premium_pct: float | None
    total_cost_estimate: float | None
    pickup_only: bool
    ships_nationally: bool
    city: str | None
    state: str | None
    zip_code: str | None
    latitude: float | None
    longitude: float | None
    sale_ends_at: datetime | None
    sale_starts_at: datetime | None
    primary_image_url: str | None
    image_urls: list[str]
    scraped_at: datetime
    # Enriched structured fields (populated by enricher.py at ingest time)
    maker: str | None = None
    brand: str | None = None
    period: str | None = None
    country_of_origin: str | None = None
    sub_category: str | None = None
    attributes: dict = Field(default_factory=dict)
    # computed
    distance_miles: float | None = None
    is_sponsored: bool = False

    model_config = {"from_attributes": True}


class ListingLotOut(BaseModel):
    id: int
    listing_id: int
    lot_number: str | None
    title: str
    description: str | None
    category: str | None
    condition: str | None
    current_price: float | None
    hammer_price: float | None
    estimate_low: float | None
    estimate_high: float | None
    is_completed: bool
    bid_count: int | None
    sale_ends_at: datetime | None
    primary_image_url: str | None
    image_urls: list[str]
    external_url: str | None
    scraped_at: datetime

    model_config = {"from_attributes": True}


class ListingSearchParams(BaseModel):
    q: str | None = None
    lat: float | None = None
    lon: float | None = None
    radius_miles: int = Field(50, ge=1, le=500)
    min_price: float | None = Field(None, ge=0)
    max_price: float | None = None
    pickup_only: bool = False
    ending_hours: int | None = None
    category: str | None = None
    platform_ids: list[int] = Field(default_factory=list)
    listing_type: str | None = None
    page: int = Field(1, ge=1)
    page_size: int = Field(24, ge=1, le=100)
