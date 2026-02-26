from datetime import datetime
from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from pgvector.sqlalchemy import Vector

from app.database import Base


class EmbeddingCache(Base):
    __tablename__ = "embedding_cache"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    listing_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("listings.id", ondelete="CASCADE"), nullable=True, index=True
    )
    text_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    model: Mapped[str] = mapped_column(String(100), default="text-embedding-3-small")
    embedding: Mapped[list[float]] = mapped_column(Vector(1536), nullable=False)
    token_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    listing: Mapped["Listing | None"] = relationship(back_populates="embedding")  # noqa: F821
