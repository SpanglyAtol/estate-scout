from datetime import datetime
from sqlalchemy import BigInteger, DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ValuationCache(Base):
    __tablename__ = "valuation_cache"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    query_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    query_text: Mapped[str] = mapped_column(Text, nullable=False)
    comp_listing_ids: Mapped[list[int]] = mapped_column(ARRAY(BigInteger), default=list)
    model_used: Mapped[str | None] = mapped_column(String(100), nullable=True)
    response_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    input_tokens: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    output_tokens: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now() + func.cast("7 days", DateTime),
        index=True,
    )
