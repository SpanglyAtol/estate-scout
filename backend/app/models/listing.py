from datetime import datetime
from sqlalchemy import (
    ARRAY,
    BigInteger,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Listing(Base):
    __tablename__ = "listings"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    platform_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("platforms.id"), nullable=False, index=True
    )
    external_id: Mapped[str] = mapped_column(String(500), nullable=False)
    external_url: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str | None] = mapped_column(String(200), nullable=True, index=True)
    condition: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Pricing
    current_price: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True, index=True)
    start_price: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    buy_now_price: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    buyers_premium_pct: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    final_price: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)

    # Fulfillment
    pickup_only: Mapped[bool] = mapped_column(Boolean, default=False)
    ships_nationally: Mapped[bool] = mapped_column(Boolean, default=True)
    shipping_estimate: Mapped[float | None] = mapped_column(Numeric(8, 2), nullable=True)

    # Location
    city: Mapped[str | None] = mapped_column(String(200), nullable=True)
    state: Mapped[str | None] = mapped_column(String(2), nullable=True, index=True)
    zip_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    country: Mapped[str] = mapped_column(String(2), default="US")
    latitude: Mapped[float | None] = mapped_column(Numeric(10, 7), nullable=True)
    longitude: Mapped[float | None] = mapped_column(Numeric(10, 7), nullable=True)

    # Timing
    sale_starts_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    sale_ends_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    preview_date: Mapped[datetime | None] = mapped_column(Date, nullable=True)

    # Media
    primary_image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_urls: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)

    # Full-text search (populated via trigger or manual update)
    search_vector: Mapped[str | None] = mapped_column(TSVECTOR, nullable=True)

    # Raw scrape payload - schema flexible
    raw_data: Mapped[dict] = mapped_column(JSONB, default=dict)

    # Metadata
    scraped_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Relationships
    platform: Mapped["Platform"] = relationship(back_populates="listings")  # noqa: F821
    embedding: Mapped["EmbeddingCache | None"] = relationship(  # noqa: F821
        back_populates="listing", uselist=False
    )

    @property
    def total_cost_estimate(self) -> float | None:
        if self.current_price is None:
            return None
        premium = (self.buyers_premium_pct or 0) / 100
        return float(self.current_price) * (1 + premium)
