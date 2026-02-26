from pydantic import BaseModel


class ValuationRequest(BaseModel):
    query_text: str
    image_url: str | None = None


class CompSale(BaseModel):
    listing_id: int
    title: str
    final_price: float
    sale_date: str | None
    platform_display_name: str
    external_url: str
    primary_image_url: str | None
    condition: str | None
    similarity_score: float | None = None


class PriceRange(BaseModel):
    low: float | None
    mid: float | None
    high: float | None
    count: int
    currency: str = "USD"


class ValuationResponse(BaseModel):
    query: str
    price_range: PriceRange
    comparable_sales: list[CompSale]
    narrative: str
    data_source: str  # "ai" | "comps_only" | "no_data"
    cached: bool = False
