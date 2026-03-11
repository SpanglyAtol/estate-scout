"""Add listing_lots table for individual lot/item data within auction listings

Scrapers that access lot-level detail (HiBid, MaxSold, AuctionZip, EBTH,
Invaluable) previously stored lot data as JSONB inside raw_data, making it
completely invisible to queries, search, and the enrichment pipeline.

This migration adds a proper listing_lots table so every lot is a first-class
searchable row keyed to its parent listing.

Revision ID: 0005
Revises: 0004
Create Date: 2026-03-11
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "listing_lots",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column(
            "listing_id",
            sa.BigInteger,
            sa.ForeignKey("listings.id", ondelete="CASCADE"),
            nullable=False,
        ),
        # Lot identity
        sa.Column("lot_number", sa.String(100), nullable=True),
        sa.Column("title", sa.Text, nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("category", sa.String(200), nullable=True),
        sa.Column("condition", sa.String(100), nullable=True),
        # Pricing
        sa.Column("current_price", sa.Numeric(12, 2), nullable=True),
        sa.Column("hammer_price", sa.Numeric(12, 2), nullable=True),
        sa.Column("estimate_low", sa.Numeric(12, 2), nullable=True),
        sa.Column("estimate_high", sa.Numeric(12, 2), nullable=True),
        # Status
        sa.Column("is_completed", sa.Boolean, server_default="false", nullable=False),
        sa.Column("bid_count", sa.Integer, nullable=True),
        sa.Column("sale_ends_at", sa.DateTime(timezone=True), nullable=True),
        # Media
        sa.Column("primary_image_url", sa.Text, nullable=True),
        sa.Column("image_urls", postgresql.ARRAY(sa.Text), server_default="{}"),
        # Click-through
        sa.Column("external_url", sa.Text, nullable=True),
        # Metadata
        sa.Column(
            "scraped_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    # Primary lookup: all lots for a listing (detail page, browse grid)
    op.create_index("idx_listing_lots_listing_id", "listing_lots", ["listing_id"])

    # Lot number lookup within a listing (deduplication on re-scrape)
    op.create_index(
        "idx_listing_lots_listing_lot_num",
        "listing_lots",
        ["listing_id", "lot_number"],
        postgresql_where=sa.text("lot_number IS NOT NULL"),
    )

    # Price range filtering across lots
    op.create_index(
        "idx_listing_lots_price",
        "listing_lots",
        ["current_price"],
        postgresql_where=sa.text("current_price IS NOT NULL"),
    )

    # Completed lots with hammer prices (for valuation / comps)
    op.create_index(
        "idx_listing_lots_hammer",
        "listing_lots",
        ["hammer_price"],
        postgresql_where=sa.text("hammer_price IS NOT NULL AND is_completed = true"),
    )


def downgrade() -> None:
    op.drop_index("idx_listing_lots_hammer")
    op.drop_index("idx_listing_lots_price")
    op.drop_index("idx_listing_lots_listing_lot_num")
    op.drop_index("idx_listing_lots_listing_id")
    op.drop_table("listing_lots")
