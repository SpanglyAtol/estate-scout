"""Add unique constraint on listing_lots(listing_id, lot_number) for upsert deduplication

Without a unique constraint the ON CONFLICT clause in storage._upsert_lots has
no conflict target, so every re-scrape of the same auction inserts fresh duplicate
rows.  This migration promotes the existing index to a proper UNIQUE constraint
(partial — only for rows that have a lot_number) so that storage.py can do a real
ON CONFLICT … DO UPDATE.

For lots without a lot_number the upsert strategy switches to DELETE + INSERT per
parent listing (handled in storage.py, not in SQL schema).

Revision ID: 0006
Revises: 0005
Create Date: 2026-03-13
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop the plain index added in 0005 — we're replacing it with a unique one.
    op.drop_index("idx_listing_lots_listing_lot_num", table_name="listing_lots")

    # Partial unique constraint: only rows where lot_number IS NOT NULL.
    # Rows without a lot_number are deduplicated by storage.py (delete + re-insert).
    op.create_index(
        "uq_listing_lots_listing_lot_num",
        "listing_lots",
        ["listing_id", "lot_number"],
        unique=True,
        postgresql_where=sa.text("lot_number IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_listing_lots_listing_lot_num", table_name="listing_lots")
    op.create_index(
        "idx_listing_lots_listing_lot_num",
        "listing_lots",
        ["listing_id", "lot_number"],
        postgresql_where=sa.text("lot_number IS NOT NULL"),
    )
