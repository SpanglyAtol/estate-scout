"""Add market price history tables: price_snapshots, market_price_index, item_fingerprints

price_snapshots    — immutable log of listing state at key moments (created, bid, completed)
market_price_index — nightly-aggregated price stats by (category, maker, sub_category, period)
item_fingerprints  — identity tracking for specific limited-edition / provenance items across
                     multiple sales / platforms over time
fingerprint_listings — junction: fingerprint ↔ listing appearances

Revision ID: 0003
Revises: 0002
Create Date: 2026-03-10
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── price_snapshots ────────────────────────────────────────────────────────
    # Immutable time-series of listing state. Written by ScraperStorage on every
    # meaningful event (listing created, price updated mid-auction, listing
    # completed). Never mutated after write.
    op.create_table(
        "price_snapshots",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("listing_id", sa.BigInteger(), nullable=False),

        # Event type: 'created' | 'price_updated' | 'completed' | 'expired'
        sa.Column("event_type", sa.String(50), nullable=False),

        # Price state at the moment of this snapshot
        sa.Column("current_price", sa.Numeric(12, 2), nullable=True),
        sa.Column("bid_count", sa.Integer(), nullable=True),
        sa.Column("is_completed", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("final_price", sa.Numeric(12, 2), nullable=True),
        sa.Column("estimate_low", sa.Numeric(12, 2), nullable=True),
        sa.Column("estimate_high", sa.Numeric(12, 2), nullable=True),

        # Denormalized from listing so queries don't need JOINs for aggregation
        sa.Column("platform_id", sa.Integer(), nullable=True),
        sa.Column("category", sa.String(200), nullable=True),
        sa.Column("sub_category", sa.String(200), nullable=True),
        sa.Column("maker", sa.String(200), nullable=True),
        sa.Column("brand", sa.String(200), nullable=True),
        sa.Column("period", sa.String(100), nullable=True),
        sa.Column("condition", sa.String(100), nullable=True),
        # Normalized condition bucket for cross-platform comparisons
        sa.Column("condition_bucket", sa.String(50), nullable=True),

        sa.Column("snapped_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),

        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["listing_id"], ["listings.id"], ondelete="CASCADE"),
    )
    op.create_index("idx_ps_listing_id", "price_snapshots", ["listing_id"])
    op.create_index("idx_ps_completed", "price_snapshots", ["snapped_at"],
                    postgresql_where=sa.text("is_completed = true AND final_price IS NOT NULL"))
    op.create_index("idx_ps_maker_cat", "price_snapshots", ["maker", "category"],
                    postgresql_where=sa.text("is_completed = true"))
    op.create_index("idx_ps_category_bucket", "price_snapshots", ["category", "condition_bucket", "snapped_at"],
                    postgresql_where=sa.text("is_completed = true"))

    # ── market_price_index ─────────────────────────────────────────────────────
    # Pre-computed aggregate price statistics, refreshed nightly by the scheduler.
    # Segmented by (category, maker, sub_category, period, condition_bucket) and
    # bucketed by month. Includes trend direction vs. the prior period.
    op.create_table(
        "market_price_index",
        sa.Column("id", sa.BigInteger(), nullable=False),

        # Segment dimensions (NULL = "all makers" / "all periods" rollup)
        sa.Column("category", sa.String(200), nullable=False),
        sa.Column("maker", sa.String(200), nullable=True),
        sa.Column("sub_category", sa.String(200), nullable=True),
        sa.Column("period", sa.String(100), nullable=True),
        sa.Column("condition_bucket", sa.String(50), nullable=True),

        # Monthly time bucket (first day of month)
        sa.Column("time_bucket", sa.Date(), nullable=False),
        sa.Column("bucket_type", sa.String(10), nullable=False, server_default="'monthly'"),

        # Price distribution stats (from completed sales in this bucket)
        sa.Column("sale_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("median_price", sa.Numeric(12, 2), nullable=True),
        sa.Column("mean_price", sa.Numeric(12, 2), nullable=True),
        sa.Column("p25_price", sa.Numeric(12, 2), nullable=True),
        sa.Column("p75_price", sa.Numeric(12, 2), nullable=True),
        sa.Column("min_price", sa.Numeric(12, 2), nullable=True),
        sa.Column("max_price", sa.Numeric(12, 2), nullable=True),

        # Trend vs prior bucket
        sa.Column("prior_median", sa.Numeric(12, 2), nullable=True),
        sa.Column("pct_change", sa.Numeric(8, 4), nullable=True),
        sa.Column("trend_direction", sa.String(10), nullable=True),  # 'up' | 'down' | 'flat'

        # Market velocity: average days from listing creation to sale completion
        sa.Column("avg_days_to_sell", sa.Numeric(6, 1), nullable=True),

        sa.Column("computed_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),

        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "category", "maker", "sub_category", "period", "condition_bucket",
            "time_bucket", "bucket_type",
            name="uq_market_index_segment",
            postgresql_nulls_not_distinct=True,
        ),
    )
    op.create_index("idx_mpi_lookup", "market_price_index", ["category", "maker", "time_bucket"])
    op.create_index("idx_mpi_category", "market_price_index", ["category", "time_bucket"])

    # ── item_fingerprints ──────────────────────────────────────────────────────
    # Tracks specific items (identified by maker + normalized title + edition info)
    # across multiple auction appearances over time. Primary use case: limited-
    # edition prints ("1/500"), signed sculptures, watches by reference number.
    op.create_table(
        "item_fingerprints",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),

        # Identity signals
        sa.Column("title_normalized", sa.Text(), nullable=False),
        sa.Column("maker", sa.String(200), nullable=True),
        sa.Column("category", sa.String(200), nullable=True),
        sa.Column("sub_category", sa.String(200), nullable=True),

        # Edition / provenance signals
        sa.Column("edition_string", sa.String(100), nullable=True),   # "1/500", "AP 3/25"
        sa.Column("edition_number", sa.Integer(), nullable=True),      # 1
        sa.Column("edition_size", sa.Integer(), nullable=True),        # 500
        sa.Column("edition_type", sa.String(50), nullable=True),       # 'numbered' | 'AP' | 'HC' | 'PP'
        sa.Column("is_limited_edition", sa.Boolean(), nullable=False, server_default="false"),

        # Watch / collectible reference signals
        sa.Column("reference_number", sa.String(100), nullable=True),  # e.g. "116610LN" for Rolex Sub
        sa.Column("model", sa.String(200), nullable=True),             # e.g. "Submariner Date"
        sa.Column("material", sa.String(100), nullable=True),          # e.g. "stainless_steel"
        sa.Column("year_approx", sa.Integer(), nullable=True),

        # SHA-256 fingerprint hash (maker + normalized_title + edition + ref_number)
        sa.Column("fingerprint_hash", sa.String(64), nullable=False, unique=True),

        # Appearance statistics (updated each time this item is seen)
        sa.Column("appearance_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("first_seen_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("first_sale_price", sa.Numeric(12, 2), nullable=True),
        sa.Column("last_sale_price", sa.Numeric(12, 2), nullable=True),
        sa.Column("min_sale_price", sa.Numeric(12, 2), nullable=True),
        sa.Column("max_sale_price", sa.Numeric(12, 2), nullable=True),
        sa.Column("avg_sale_price", sa.Numeric(12, 2), nullable=True),

        # Percentage change from first known sale to most recent
        sa.Column("price_trend_pct", sa.Numeric(8, 4), nullable=True),

        sa.Column("notes", sa.Text(), nullable=True),

        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_fp_hash", "item_fingerprints", ["fingerprint_hash"], unique=True)
    op.create_index("idx_fp_maker_model", "item_fingerprints", ["maker", "model"])
    op.create_index("idx_fp_category", "item_fingerprints", ["category"])
    op.create_index("idx_fp_limited", "item_fingerprints", ["is_limited_edition", "category"],
                    postgresql_where=sa.text("is_limited_edition = true"))

    # ── fingerprint_listings ───────────────────────────────────────────────────
    # Junction table: each row = one auction appearance of a fingerprinted item.
    op.create_table(
        "fingerprint_listings",
        sa.Column("fingerprint_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("listing_id", sa.BigInteger(), nullable=False),
        sa.Column("platform_id", sa.Integer(), nullable=True),
        sa.Column("final_price", sa.Numeric(12, 2), nullable=True),
        sa.Column("condition", sa.String(100), nullable=True),
        sa.Column("sale_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("seen_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),

        sa.PrimaryKeyConstraint("fingerprint_id", "listing_id"),
        sa.ForeignKeyConstraint(["fingerprint_id"], ["item_fingerprints.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["listing_id"], ["listings.id"], ondelete="CASCADE"),
    )
    op.create_index("idx_fl_fingerprint", "fingerprint_listings", ["fingerprint_id"])
    op.create_index("idx_fl_listing", "fingerprint_listings", ["listing_id"])


def downgrade() -> None:
    op.drop_table("fingerprint_listings")
    op.drop_table("item_fingerprints")
    op.drop_table("market_price_index")
    op.drop_table("price_snapshots")
