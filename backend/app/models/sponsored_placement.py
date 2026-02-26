from datetime import datetime
from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SponsoredPlacement(Base):
    __tablename__ = "sponsored_placements"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    listing_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("listings.id", ondelete="CASCADE"), nullable=True
    )
    sponsor_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    contact_email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    search_keywords: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    categories: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    location_states: Mapped[list[str]] = mapped_column(ARRAY(String(2)), default=list)
    priority_score: Mapped[int] = mapped_column(Integer, default=100)
    cost_per_day: Mapped[float | None] = mapped_column(Numeric(8, 2), nullable=True)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    impressions: Mapped[int] = mapped_column(Integer, default=0)
    clicks: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
