from datetime import datetime
from sqlalchemy import (
    ARRAY,
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ListingLot(Base):
    __tablename__ = "listing_lots"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    listing_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("listings.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Lot identity
    lot_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str | None] = mapped_column(String(200), nullable=True)
    condition: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Pricing
    current_price: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    hammer_price: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    estimate_low: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    estimate_high: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)

    # Status
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    bid_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sale_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Media
    primary_image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_urls: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)

    # Click-through
    external_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Metadata
    scraped_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationship
    listing: Mapped["Listing"] = relationship(back_populates="lots")  # noqa: F821
