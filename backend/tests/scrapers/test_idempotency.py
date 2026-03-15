import pytest

from scrapers.base import ScrapedListing
from scrapers.persistence.idempotency import MissingExternalIdError, listing_dedupe_key


def test_listing_dedupe_key_uses_platform_and_external_id():
    listing = ScrapedListing(
        platform_slug="hibid",
        external_id="abc-123",
        external_url="https://example.com/abc-123",
        title="Lot 42",
    )

    assert listing_dedupe_key(listing) == ("hibid", "abc-123")


def test_listing_dedupe_key_requires_external_id():
    listing = ScrapedListing(
        platform_slug="hibid",
        external_id="",
        external_url="https://example.com/no-id",
        title="No ID",
    )

    with pytest.raises(MissingExternalIdError):
        listing_dedupe_key(listing)
