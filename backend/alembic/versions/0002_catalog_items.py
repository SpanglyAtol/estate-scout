"""Add catalog_items table and avatar_url to users

Revision ID: 0002
Revises: 0001
Create Date: 2026-03-04

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add avatar_url to users (safe to add; nullable)
    op.add_column(
        "users",
        sa.Column("avatar_url", sa.Text, nullable=True),
    )

    # Seed new platforms introduced by new scrapers
    op.execute("""
        INSERT INTO platforms (name, display_name, base_url, scraper_class) VALUES
        ('bidspotter',  'BidSpotter', 'https://www.bidspotter.com', 'BidSpotterScraper'),
        ('ebay',        'eBay',       'https://www.ebay.com',       'EbaySoldListingsScraper'),
        ('proxibid',    'Proxibid',   'https://www.proxibid.com',   'ProxibidScraper'),
        ('1stdibs',     '1stDibs',    'https://www.1stdibs.com',    'OneDibsScraper')
        ON CONFLICT (name) DO NOTHING
    """)

    # Create catalog_items table
    op.create_table(
        "catalog_items",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=False),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        # Item details
        sa.Column("title", sa.Text, nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("category", sa.String(200), nullable=True),
        sa.Column("condition", sa.String(100), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        # Media
        sa.Column("image_urls", postgresql.JSONB, server_default="[]"),
        # AI valuation
        sa.Column("ai_analysis", postgresql.JSONB, nullable=True),
        sa.Column("estimate_low", sa.Float, nullable=True),
        sa.Column("estimate_mid", sa.Float, nullable=True),
        sa.Column("estimate_high", sa.Float, nullable=True),
        sa.Column("last_analyzed_at", sa.DateTime(timezone=True), nullable=True),
        # Timestamps
        sa.Column("added_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_index("ix_catalog_items_user_id", "catalog_items", ["user_id"])
    op.create_index("ix_catalog_items_added_at", "catalog_items", ["added_at"])


def downgrade() -> None:
    op.drop_table("catalog_items")
    op.drop_column("users", "avatar_url")
