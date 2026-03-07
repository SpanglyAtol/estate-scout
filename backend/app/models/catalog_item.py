from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
import uuid

from app.database import Base


class CatalogItem(Base):
    """
    A single item in a user's personal antiques catalog.

    Users add items here to track their collection, store photos, notes,
    and receive AI-powered price estimates.  Stored server-side so the
    catalog is accessible across devices (replaces localStorage-only MVP).
    """
    __tablename__ = "catalog_items"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Item details
    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str | None] = mapped_column(String(200), nullable=True)
    condition: Mapped[str | None] = mapped_column(String(100), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Media — stored as JSON array of URLs (or base64 for MVP; swap for S3 URLs later)
    image_urls: Mapped[list] = mapped_column(JSONB, server_default="[]")

    # AI valuation results (cached from the last /valuation/query call)
    ai_analysis: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    estimate_low: Mapped[float | None] = mapped_column(Float, nullable=True)
    estimate_mid: Mapped[float | None] = mapped_column(Float, nullable=True)
    estimate_high: Mapped[float | None] = mapped_column(Float, nullable=True)
    last_analyzed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Timestamps
    added_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="catalog_items")  # noqa: F821
