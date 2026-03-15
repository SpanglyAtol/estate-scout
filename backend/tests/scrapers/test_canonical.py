from scrapers.base import ScrapedListing
from scrapers.normalization.canonical import CanonicalValidationError, normalize_listing


def test_normalize_listing_standardizes_fields():
    listing = ScrapedListing(
        platform_slug=" HiBid ",
        external_id=" 123 ",
        external_url=" https://example.com/item/123 ",
        title="  Antique Vase  ",
        state=" wa ",
        city=" Seattle ",
    )

    normalized = normalize_listing(listing)

    assert normalized.platform_slug == "hibid"
    assert normalized.external_id == "123"
    assert normalized.title == "Antique Vase"
    assert normalized.state == "WA"
    assert normalized.city == "Seattle"


def test_normalize_listing_raises_for_missing_required():
    listing = ScrapedListing(
        platform_slug="hibid",
        external_id="",
        external_url="",
        title="",
    )

    try:
        normalize_listing(listing)
        assert False, "expected validation error"
    except CanonicalValidationError as exc:
        assert "external_id" in str(exc)
        assert "external_url" in str(exc)
        assert "title" in str(exc)
