"""Initial schema

Revision ID: 0001
Revises:
Create Date: 2026-02-22

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Extensions (already run by init_db.sql, but safe to repeat)
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.execute("CREATE EXTENSION IF NOT EXISTS unaccent")

    # --- platforms ---
    op.create_table(
        "platforms",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(100), nullable=False, unique=True),
        sa.Column("display_name", sa.String(200), nullable=False),
        sa.Column("base_url", sa.Text, nullable=False),
        sa.Column("logo_url", sa.Text, nullable=True),
        sa.Column("scraper_class", sa.String(200), nullable=True),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("last_scraped_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("scrape_interval_minutes", sa.Integer, server_default="60"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Seed known platforms
    op.execute("""
        INSERT INTO platforms (name, display_name, base_url, scraper_class) VALUES
        ('liveauctioneers', 'LiveAuctioneers', 'https://www.liveauctioneers.com', 'LiveAuctioneersScraper'),
        ('estatesales_net', 'EstateSales.NET', 'https://www.estatesales.net', 'EstateSalesNetScraper'),
        ('hibid', 'HiBid', 'https://hibid.com', 'HibidScraper'),
        ('maxsold', 'MaxSold', 'https://maxsold.com', 'MaxSoldScraper')
    """)

    # --- users ---
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("email", sa.String(320), nullable=False, unique=True),
        sa.Column("display_name", sa.String(200), nullable=True),
        sa.Column("password_hash", sa.Text, nullable=True),
        sa.Column("tier", sa.String(20), server_default="free"),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("valuation_queries_this_month", sa.Integer, server_default="0"),
        sa.Column("valuation_reset_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("stripe_customer_id", sa.String(200), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # --- listings ---
    op.create_table(
        "listings",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("platform_id", sa.Integer, sa.ForeignKey("platforms.id"), nullable=False),
        sa.Column("external_id", sa.String(500), nullable=False),
        sa.Column("external_url", sa.Text, nullable=False),
        sa.Column("title", sa.Text, nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("category", sa.String(200), nullable=True),
        sa.Column("condition", sa.String(100), nullable=True),
        # Pricing
        sa.Column("current_price", sa.Numeric(12, 2), nullable=True),
        sa.Column("start_price", sa.Numeric(12, 2), nullable=True),
        sa.Column("buy_now_price", sa.Numeric(12, 2), nullable=True),
        sa.Column("currency", sa.String(3), server_default="USD"),
        sa.Column("buyers_premium_pct", sa.Numeric(5, 2), nullable=True),
        sa.Column("is_completed", sa.Boolean, server_default="false"),
        sa.Column("final_price", sa.Numeric(12, 2), nullable=True),
        # Fulfillment
        sa.Column("pickup_only", sa.Boolean, server_default="false"),
        sa.Column("ships_nationally", sa.Boolean, server_default="true"),
        sa.Column("shipping_estimate", sa.Numeric(8, 2), nullable=True),
        # Location
        sa.Column("city", sa.String(200), nullable=True),
        sa.Column("state", sa.String(2), nullable=True),
        sa.Column("zip_code", sa.String(20), nullable=True),
        sa.Column("country", sa.String(2), server_default="US"),
        sa.Column("latitude", sa.Numeric(10, 7), nullable=True),
        sa.Column("longitude", sa.Numeric(10, 7), nullable=True),
        # Timing
        sa.Column("sale_starts_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sale_ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("preview_date", sa.Date, nullable=True),
        # Media
        sa.Column("primary_image_url", sa.Text, nullable=True),
        sa.Column("image_urls", postgresql.ARRAY(sa.Text), server_default="{}"),
        # Search
        sa.Column("search_vector", postgresql.TSVECTOR, nullable=True),
        # Metadata
        sa.Column("raw_data", postgresql.JSONB, server_default="{}"),
        sa.Column("scraped_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.UniqueConstraint("platform_id", "external_id", name="uq_listing_platform_external"),
    )

    op.create_index("idx_listings_platform", "listings", ["platform_id"])
    op.create_index("idx_listings_sale_ends", "listings", ["sale_ends_at"])
    op.create_index("idx_listings_price", "listings", ["current_price"])
    op.create_index("idx_listings_category", "listings", ["category"])
    op.create_index("idx_listings_state", "listings", ["state"])
    op.create_index("idx_listings_completed", "listings", ["is_completed"])
    op.create_index(
        "idx_listings_search",
        "listings",
        ["search_vector"],
        postgresql_using="gin",
    )

    # Trigger to keep search_vector updated automatically
    op.execute("""
        CREATE OR REPLACE FUNCTION listings_search_vector_update() RETURNS trigger AS $$
        BEGIN
            NEW.search_vector := to_tsvector('english',
                coalesce(NEW.title, '') || ' ' ||
                coalesce(NEW.description, '') || ' ' ||
                coalesce(NEW.category, '') || ' ' ||
                coalesce(NEW.city, '') || ' ' ||
                coalesce(NEW.state, '')
            );
            RETURN NEW;
        END
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        CREATE TRIGGER listings_search_vector_trigger
        BEFORE INSERT OR UPDATE ON listings
        FOR EACH ROW EXECUTE FUNCTION listings_search_vector_update();
    """)

    # --- embedding_cache ---
    op.create_table(
        "embedding_cache",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column(
            "listing_id",
            sa.BigInteger,
            sa.ForeignKey("listings.id", ondelete="CASCADE"),
            nullable=True,
            index=True,
        ),
        sa.Column("text_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("model", sa.String(100), server_default="text-embedding-3-small"),
        sa.Column("embedding", sa.Text, nullable=False),  # stored as string, cast in queries
        sa.Column("token_count", sa.Integer, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    # NOTE: The vector column type requires pgvector. Use raw SQL for this column.
    op.execute("""
        ALTER TABLE embedding_cache
        ALTER COLUMN embedding TYPE vector(1536) USING embedding::vector(1536)
    """)
    # Add IVFFlat index AFTER loading data (10k+ rows needed first)
    # op.execute("CREATE INDEX idx_embedding_vector ON embedding_cache USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)")

    # --- valuation_cache ---
    op.create_table(
        "valuation_cache",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("query_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("query_text", sa.Text, nullable=False),
        sa.Column("comp_listing_ids", postgresql.ARRAY(sa.BigInteger), server_default="{}"),
        sa.Column("model_used", sa.String(100), nullable=True),
        sa.Column("response_json", postgresql.JSONB, nullable=False),
        sa.Column("input_tokens", sa.BigInteger, nullable=True),
        sa.Column("output_tokens", sa.BigInteger, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column(
            "expires_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW() + INTERVAL '7 days'"),
            index=True,
        ),
    )

    # --- saved_searches ---
    op.create_table(
        "saved_searches",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=False),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("query_text", sa.Text, nullable=True),
        sa.Column("filters", postgresql.JSONB, server_default="{}"),
        sa.Column("last_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("result_count", sa.Integer, nullable=True),
        sa.Column("notify_email", sa.Boolean, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # --- alerts ---
    op.create_table(
        "alerts",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=False),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("query_text", sa.Text, nullable=True),
        sa.Column("filters", postgresql.JSONB, server_default="{}"),
        sa.Column("max_price", sa.Numeric(12, 2), nullable=True),
        sa.Column("notify_email", sa.Boolean, server_default="true"),
        sa.Column("notify_push", sa.Boolean, server_default="false"),
        sa.Column("is_active", sa.Boolean, server_default="true", index=True),
        sa.Column("last_triggered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("trigger_count", sa.Integer, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # --- sponsored_placements ---
    op.create_table(
        "sponsored_placements",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column(
            "listing_id",
            sa.BigInteger,
            sa.ForeignKey("listings.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("sponsor_name", sa.String(200), nullable=True),
        sa.Column("contact_email", sa.String(320), nullable=True),
        sa.Column("search_keywords", postgresql.ARRAY(sa.Text), server_default="{}"),
        sa.Column("categories", postgresql.ARRAY(sa.Text), server_default="{}"),
        sa.Column("location_states", postgresql.ARRAY(sa.String(2)), server_default="{}"),
        sa.Column("priority_score", sa.Integer, server_default="100"),
        sa.Column("cost_per_day", sa.Numeric(8, 2), nullable=True),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("impressions", sa.Integer, server_default="0"),
        sa.Column("clicks", sa.Integer, server_default="0"),
        sa.Column("is_active", sa.Boolean, server_default="true", index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("sponsored_placements")
    op.drop_table("alerts")
    op.drop_table("saved_searches")
    op.drop_table("valuation_cache")
    op.drop_table("embedding_cache")
    op.execute("DROP TRIGGER IF EXISTS listings_search_vector_trigger ON listings")
    op.execute("DROP FUNCTION IF EXISTS listings_search_vector_update()")
    op.drop_table("listings")
    op.drop_table("users")
    op.drop_table("platforms")
