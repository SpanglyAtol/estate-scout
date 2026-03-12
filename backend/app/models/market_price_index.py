from sqlalchemy import BigInteger, Column, Date, DateTime, Numeric, String, Integer, func
from app.database import Base


class MarketPriceIndex(Base):
    """
    Pre-aggregated market price statistics, refreshed nightly.

    Each row represents one (category × maker × sub_category × period × condition_bucket)
    segment for one monthly time bucket. NULL dimension = rolled-up "all" bucket.

    trend_direction is computed by comparing median_price to prior_median:
      > +3%  → 'up'
      < -3%  → 'down'
      else   → 'flat'
    """

    __tablename__ = "market_price_index"

    id = Column(BigInteger, primary_key=True, autoincrement=True)

    # Segment dimensions (NULL = all)
    category         = Column(String(200), nullable=False)
    maker            = Column(String(200), nullable=True)
    sub_category     = Column(String(200), nullable=True)
    period           = Column(String(100), nullable=True)
    condition_bucket = Column(String(50),  nullable=True)

    # Monthly time bucket (first day of month, e.g. 2026-03-01)
    time_bucket = Column(Date(),      nullable=False)
    bucket_type = Column(String(10),  nullable=False, default="monthly")

    # Price distribution from completed sales in this bucket
    sale_count   = Column(Integer,        nullable=False, default=0)
    median_price = Column(Numeric(12, 2), nullable=True)
    mean_price   = Column(Numeric(12, 2), nullable=True)
    p25_price    = Column(Numeric(12, 2), nullable=True)
    p75_price    = Column(Numeric(12, 2), nullable=True)
    min_price    = Column(Numeric(12, 2), nullable=True)
    max_price    = Column(Numeric(12, 2), nullable=True)

    # Trend vs prior bucket
    prior_median    = Column(Numeric(12, 2), nullable=True)
    pct_change      = Column(Numeric(8,  4), nullable=True)
    trend_direction = Column(String(10),     nullable=True)  # 'up' | 'down' | 'flat'

    # Market velocity: avg days from listing creation to completion
    avg_days_to_sell = Column(Numeric(6, 1), nullable=True)

    computed_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
