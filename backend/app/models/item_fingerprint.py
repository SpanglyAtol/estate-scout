import uuid
from sqlalchemy import BigInteger, Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class ItemFingerprint(Base):
    """
    Identity record for a specific item seen across multiple auction appearances.

    A fingerprint is derived from stable identity signals:
      - Normalized title (lowercased, punctuation stripped)
      - Maker slug
      - Edition info (number + size, e.g. 1/500)
      - Reference number (watches: "116610LN")
      - Model name

    Each time the same item surfaces at auction, we update appearance_count,
    last_seen_at, and the price statistics.  This lets us answer:
      "How many times has this 1/500 Basquiat print sold, and at what prices?"
      "What's the price trajectory for a Rolex 116610LN since 2022?"
    """

    __tablename__ = "item_fingerprints"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Identity signals
    title_normalized = Column(Text(),        nullable=False)
    maker            = Column(String(200),   nullable=True)
    category         = Column(String(200),   nullable=True)
    sub_category     = Column(String(200),   nullable=True)

    # Edition / provenance signals (art, prints, sculptures, coins)
    edition_string     = Column(String(100), nullable=True)   # raw: "1/500", "AP 3/25"
    edition_number     = Column(Integer(),   nullable=True)   # 1
    edition_size       = Column(Integer(),   nullable=True)   # 500
    edition_type       = Column(String(50),  nullable=True)   # 'numbered'|'AP'|'HC'|'PP'
    is_limited_edition = Column(Boolean(),   nullable=False, default=False)

    # Watch / collectible reference signals
    reference_number = Column(String(100), nullable=True)  # "116610LN"
    model            = Column(String(200), nullable=True)  # "Submariner Date"
    material         = Column(String(100), nullable=True)  # "stainless_steel"
    year_approx      = Column(Integer(),   nullable=True)

    # SHA-256 fingerprint hash: stable identity digest
    fingerprint_hash = Column(String(64), nullable=False, unique=True)

    # Appearance stats (updated on each new sighting)
    appearance_count  = Column(Integer(),        nullable=False, default=1)
    first_seen_at     = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    last_seen_at      = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    # Price stats across all appearances (only completed sales count)
    first_sale_price  = Column(Numeric(12, 2), nullable=True)
    last_sale_price   = Column(Numeric(12, 2), nullable=True)
    min_sale_price    = Column(Numeric(12, 2), nullable=True)
    max_sale_price    = Column(Numeric(12, 2), nullable=True)
    avg_sale_price    = Column(Numeric(12, 2), nullable=True)

    # % change from first to most recent sale (positive = appreciated)
    price_trend_pct = Column(Numeric(8, 4), nullable=True)

    notes = Column(Text(), nullable=True)


class FingerprintListing(Base):
    """Junction: one row per auction appearance of a fingerprinted item."""

    __tablename__ = "fingerprint_listings"

    fingerprint_id = Column(UUID(as_uuid=True), ForeignKey("item_fingerprints.id", ondelete="CASCADE"),
                            primary_key=True)
    listing_id     = Column(BigInteger, ForeignKey("listings.id", ondelete="CASCADE"),
                            primary_key=True)

    platform_id = Column(Integer(),          nullable=True)
    final_price = Column(Numeric(12, 2),     nullable=True)
    condition   = Column(String(100),        nullable=True)
    sale_date   = Column(DateTime(timezone=True), nullable=True)
    seen_at     = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
