from sqlalchemy import BigInteger, Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String, func
from app.database import Base


class PriceSnapshot(Base):
    """
    Immutable time-series record of a listing's state at a key moment.

    Written once and never mutated. Events:
      'created'       — listing first ingested by scraper
      'price_updated' — current_price changed mid-auction (bid came in)
      'completed'     — listing marked is_completed=True with final_price
      'expired'       — listing ended with no bids / no sale

    Category, maker, etc. are denormalized here so aggregation queries
    over this table don't require JOINs back to listings.
    """

    __tablename__ = "price_snapshots"

    id         = Column(BigInteger, primary_key=True, autoincrement=True)
    listing_id = Column(BigInteger, ForeignKey("listings.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(String(50), nullable=False)

    # Price state at snapshot moment
    current_price  = Column(Numeric(12, 2), nullable=True)
    bid_count      = Column(Integer,        nullable=True)
    is_completed   = Column(Boolean,        nullable=False, default=False)
    final_price    = Column(Numeric(12, 2), nullable=True)
    estimate_low   = Column(Numeric(12, 2), nullable=True)
    estimate_high  = Column(Numeric(12, 2), nullable=True)

    # Denormalized dimensions (copied from listing at snapshot time)
    platform_id      = Column(Integer,      nullable=True)
    category         = Column(String(200),  nullable=True)
    sub_category     = Column(String(200),  nullable=True)
    maker            = Column(String(200),  nullable=True)
    brand            = Column(String(200),  nullable=True)
    period           = Column(String(100),  nullable=True)
    condition        = Column(String(100),  nullable=True)
    condition_bucket = Column(String(50),   nullable=True)  # 'excellent'|'good'|'fair'|'poor'|'unknown'

    snapped_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
