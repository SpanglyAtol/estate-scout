from datetime import datetime
from pydantic import BaseModel


class AiAnalysis(BaseModel):
    narrative: str
    priceLow: float | None = None
    priceMid: float | None = None
    priceHigh: float | None = None
    priceCount: int = 0
    queriedWith: str = ""


class CatalogItemCreate(BaseModel):
    title: str
    description: str | None = None
    category: str | None = None
    condition: str | None = None
    notes: str | None = None
    image_urls: list[str] = []


class CatalogItemUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    category: str | None = None
    condition: str | None = None
    notes: str | None = None
    image_urls: list[str] | None = None
    ai_analysis: dict | None = None
    estimate_low: float | None = None
    estimate_mid: float | None = None
    estimate_high: float | None = None


class CatalogItemOut(BaseModel):
    id: str
    user_id: str
    title: str
    description: str | None
    category: str | None
    condition: str | None
    notes: str | None
    image_urls: list[str]
    ai_analysis: dict | None
    estimate_low: float | None
    estimate_mid: float | None
    estimate_high: float | None
    last_analyzed_at: datetime | None
    added_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
