from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from scrapers.base import ScrapedListing


class MissingExternalIdError(ValueError):
    pass


def listing_dedupe_key(listing: "ScrapedListing") -> tuple[str, str]:
    """Return idempotent storage key for a listing: (platform_slug, external_id)."""
    if not listing.external_id:
        raise MissingExternalIdError("external_id is required for idempotent upsert")
    return (listing.platform_slug, str(listing.external_id))
