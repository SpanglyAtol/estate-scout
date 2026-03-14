"""Add archive schema, listing type/status columns, and scraper platform seeds

Architecture change
-------------------
Introduces a two-schema layout within the same Supabase project:

  public   — live / active listings served by the website.  Small, fast.
  archive  — completed / ended listings for historical queries, AI valuation,
             price-trend charts, and market intelligence.  Grows unbounded.

Why same project (not a second Supabase instance)?
  * Cross-schema JOINs work natively in PostgreSQL — the AI valuation service
    can JOIN public.embedding_cache with archive.listings without any network hop.
  * Single connection string, single backup, single billing plan.
  * public.listings stays small (< 30 days of active listings) → fast UI queries.
  * archive.listings is append-only / upsert-only — no risk of hot-row contention
    with the live site.

New columns on public.listings
  listing_type   auction | estate_sale | buy_now      (scraped value)
  item_type      individual_item | lot | estate_sale | auction_catalog
  auction_status upcoming | live | ended | completed  (computed by scraper)
  archived_at    set when row is soft-deleted after copying to archive

archive.listings
  Denormalized copy of each completed/ended listing.  Includes all enrichment
  fields (maker, period, attributes …).  No FK to public — self-contained so
  the AI can query it independently.  search_vector gives full-text search.

Revision ID: 0004
Revises: 0003
Create Date: 2026-03-11
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table_name: str, column_name: str, schema: str | None = None) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return any(c["name"] == column_name for c in insp.get_columns(table_name, schema=schema))


def _index_exists(index_name: str, table_name: str, schema: str | None = None) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return any(ix["name"] == index_name for ix in insp.get_indexes(table_name, schema=schema))


def upgrade() -> None:
    # ── 1. New columns on public.listings ──────────────────────────────────────

    if not _column_exists("listings", "listing_type"):
        op.add_column("listings", sa.Column(
            "listing_type", sa.String(50), server_default="auction", nullable=False,
        ))
    if not _column_exists("listings", "item_type"):
        op.add_column("listings", sa.Column(
            "item_type", sa.String(50), server_default="individual_item", nullable=False,
        ))
    if not _column_exists("listings", "auction_status"):
        op.add_column("listings", sa.Column(
            "auction_status", sa.String(50), server_default="upcoming", nullable=False,
        ))
    # auction_status includes listing_type in the enricher fields that were added in 0001.
    # Also add the enriched structured fields that are written by the scraper but
    # were not in the original schema.
    if not _column_exists("listings", "maker"):
        op.add_column("listings", sa.Column("maker", sa.String(200), nullable=True))
    if not _column_exists("listings", "brand"):
        op.add_column("listings", sa.Column("brand", sa.String(200), nullable=True))
    if not _column_exists("listings", "collaboration_brands"):
        op.add_column("listings", sa.Column(
            "collaboration_brands", postgresql.ARRAY(sa.Text), server_default="{}"
        ))
    if not _column_exists("listings", "period"):
        op.add_column("listings", sa.Column("period", sa.String(100), nullable=True))
    if not _column_exists("listings", "country_of_origin"):
        op.add_column("listings", sa.Column("country_of_origin", sa.String(100), nullable=True))
    if not _column_exists("listings", "attributes"):
        op.add_column("listings", sa.Column(
            "attributes", postgresql.JSONB, server_default="{}"
        ))
    # auction_status: also add final_price + estimate columns that storage.py writes
    # but were missing from migration 0001.
    if not _column_exists("listings", "estimate_low"):
        op.add_column("listings", sa.Column("estimate_low", sa.Numeric(12, 2), nullable=True))
    if not _column_exists("listings", "estimate_high"):
        op.add_column("listings", sa.Column("estimate_high", sa.Numeric(12, 2), nullable=True))
    if not _column_exists("listings", "auction_status_type"):
        op.add_column("listings", sa.Column("auction_status_type", sa.String(50), nullable=True))

    # archived_at: NULL = live row; non-NULL = moved to archive, excluded from website
    if not _column_exists("listings", "archived_at"):
        op.add_column("listings", sa.Column(
            "archived_at", sa.DateTime(timezone=True), nullable=True,
        ))

    # Backfill auction_status for existing rows using date/completion logic
    op.execute("""
        UPDATE listings
        SET auction_status = CASE
            WHEN is_completed = true THEN 'completed'
            WHEN sale_ends_at IS NOT NULL AND sale_ends_at < NOW() THEN 'ended'
            WHEN sale_starts_at IS NOT NULL AND sale_starts_at > NOW() THEN 'upcoming'
            ELSE 'live'
        END
    """)

    # Partial index: archive worker efficiently finds rows that need moving.
    # Note: no NOW() in the predicate — partial index predicates must be immutable.
    # The date cutoff is applied at query time in batch_archive_ended().
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_listings_needs_archive
        ON listings (sale_ends_at, is_completed)
        WHERE archived_at IS NULL
    """)

    # Indexes for new columns
    if not _index_exists("idx_listings_auction_status", "listings"):
        op.create_index("idx_listings_auction_status", "listings", ["auction_status"])
    if not _index_exists("idx_listings_listing_type", "listings"):
        op.create_index("idx_listings_listing_type", "listings", ["listing_type"])
    if not _index_exists("idx_listings_maker", "listings"):
        op.create_index("idx_listings_maker", "listings", ["maker"],
                        postgresql_where=sa.text("maker IS NOT NULL"))

    # ── 2. Seed new platforms ──────────────────────────────────────────────────
    op.execute("""
        INSERT INTO platforms (name, display_name, base_url, scraper_class) VALUES
        ('ebth',        'EBTH',          'https://www.ebth.com',          'EbthScraper'),
        ('invaluable',  'Invaluable',    'https://www.invaluable.com',    'InvaluableScraper'),
        ('auctionzip',  'AuctionZip',    'https://www.auctionzip.com',    'AuctionZipScraper'),
        ('discovery',   'Regional Auction (Discovered)', '',              'DiscoveryScraper')
        ON CONFLICT (name) DO NOTHING
    """)

    # ── 3. Create archive schema ───────────────────────────────────────────────
    op.execute("CREATE SCHEMA IF NOT EXISTS archive")

    # archive.listings — denormalized, self-contained, no FKs to public
    op.execute("""
        CREATE TABLE IF NOT EXISTS archive.listings (
            id                  BIGSERIAL PRIMARY KEY,

            -- Back-reference to public.listings (informational only, no FK constraint
            -- so archive survives independently if public row is ever hard-deleted)
            source_listing_id   BIGINT,

            -- Platform (denormalized — no FK needed)
            platform_slug       VARCHAR(100) NOT NULL,
            platform_display_name VARCHAR(200),
            platform_base_url   TEXT,

            -- Core identity
            external_id         VARCHAR(500) NOT NULL,
            external_url        TEXT NOT NULL,
            title               TEXT NOT NULL,
            description         TEXT,

            -- Classification
            category            VARCHAR(200),
            condition           VARCHAR(100),
            listing_type        VARCHAR(50),   -- auction | estate_sale | buy_now
            item_type           VARCHAR(50),   -- individual_item | lot | estate_sale | auction_catalog

            -- Pricing (final state at time of archiving)
            final_price         NUMERIC(12, 2),
            current_price       NUMERIC(12, 2),
            estimate_low        NUMERIC(12, 2),
            estimate_high       NUMERIC(12, 2),
            buyers_premium_pct  NUMERIC(5, 2),
            currency            VARCHAR(3)     DEFAULT 'USD',

            -- Structured enrichment (from enricher.py)
            maker               VARCHAR(200),
            brand               VARCHAR(200),
            collaboration_brands TEXT[]        DEFAULT '{}',
            period              VARCHAR(100),
            country_of_origin   VARCHAR(100),
            attributes          JSONB          DEFAULT '{}',

            -- Location
            city                VARCHAR(200),
            state               VARCHAR(2),
            zip_code            VARCHAR(20),
            latitude            NUMERIC(10, 7),
            longitude           NUMERIC(10, 7),

            -- Timing
            sale_starts_at      TIMESTAMPTZ,
            sale_ends_at        TIMESTAMPTZ,

            -- Media
            primary_image_url   TEXT,

            -- Full-text search vector (same recipe as public.listings)
            search_vector       TSVECTOR,

            -- Provenance
            scraped_at          TIMESTAMPTZ,
            archived_at         TIMESTAMPTZ    DEFAULT NOW(),

            UNIQUE (platform_slug, external_id)
        )
    """)

    # Indexes for AI valuation, market charts, and geographic queries
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_archive_category_maker
            ON archive.listings (category, maker)
            WHERE final_price IS NOT NULL
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_archive_sale_ends
            ON archive.listings (sale_ends_at DESC)
            WHERE final_price IS NOT NULL
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_archive_maker_price
            ON archive.listings (maker, final_price)
            WHERE final_price IS NOT NULL AND maker IS NOT NULL
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_archive_state_category
            ON archive.listings (state, category)
            WHERE final_price IS NOT NULL
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_archive_platform
            ON archive.listings (platform_slug, archived_at DESC)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_archive_search
            ON archive.listings USING GIN (search_vector)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_archive_source_id
            ON archive.listings (source_listing_id)
            WHERE source_listing_id IS NOT NULL
    """)

    # Auto-update search_vector on archive.listings
    op.execute("""
        CREATE OR REPLACE FUNCTION archive_listings_search_vector_update()
        RETURNS trigger AS $$
        BEGIN
            NEW.search_vector := to_tsvector('english',
                coalesce(NEW.title, '')       || ' ' ||
                coalesce(NEW.description, '') || ' ' ||
                coalesce(NEW.category, '')    || ' ' ||
                coalesce(NEW.maker, '')       || ' ' ||
                coalesce(NEW.brand, '')       || ' ' ||
                coalesce(NEW.city, '')        || ' ' ||
                coalesce(NEW.state, '')
            );
            RETURN NEW;
        END
        $$ LANGUAGE plpgsql
    """)
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_trigger
                WHERE tgname = 'archive_listings_search_vector_trigger'
            ) THEN
                CREATE TRIGGER archive_listings_search_vector_trigger
                BEFORE INSERT OR UPDATE ON archive.listings
                FOR EACH ROW EXECUTE FUNCTION archive_listings_search_vector_update();
            END IF;
        END
        $$;
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS archive_listings_search_vector_trigger ON archive.listings")
    op.execute("DROP FUNCTION IF EXISTS archive_listings_search_vector_update()")
    op.execute("DROP TABLE IF EXISTS archive.listings")
    op.execute("DROP SCHEMA IF EXISTS archive CASCADE")

    op.drop_index("idx_listings_maker")
    op.drop_index("idx_listings_listing_type")
    op.drop_index("idx_listings_auction_status")
    op.execute("DROP INDEX IF EXISTS idx_listings_needs_archive")

    for col in (
        "archived_at", "auction_status_type", "estimate_high", "estimate_low",
        "attributes", "country_of_origin", "period", "collaboration_brands",
        "brand", "maker", "auction_status", "item_type", "listing_type",
    ):
        op.drop_column("listings", col)
