from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from scrapers.base import ScrapedListing

REQUIRED_FIELDS = ("platform_slug", "external_id", "external_url", "title")


class CanonicalValidationError(ValueError):
    pass


def normalize_listing(listing: "ScrapedListing") -> "ScrapedListing":
    """Apply lightweight canonical normalization shared by all source adapters."""
    listing.platform_slug = (listing.platform_slug or "").strip().lower()
    listing.external_id = str(listing.external_id).strip()
    listing.external_url = (listing.external_url or "").strip()
    listing.title = (listing.title or "").strip()

    if listing.state:
        listing.state = listing.state.strip().upper()
    if listing.city:
        listing.city = listing.city.strip()
    if listing.zip_code:
        listing.zip_code = listing.zip_code.strip()

    validate_required_fields(listing)
    return listing


def validate_required_fields(listing: "ScrapedListing") -> None:
    missing = [field for field in REQUIRED_FIELDS if not getattr(listing, field)]
    if missing:
        raise CanonicalValidationError(f"Missing required fields: {', '.join(missing)}")
