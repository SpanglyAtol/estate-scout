from workers.discovery_daily import build_site_candidates, classify_site


def test_classify_site_detects_existing_scraper_domain_hint():
    recommendation, target = classify_site("foo.bidspotter.com")
    assert recommendation == "extend_existing_scraper"
    assert target == "bidspotter"


def test_classify_site_marks_new_adapter_for_unknown_domain():
    recommendation, target = classify_site("smalltownauctions.example")
    assert recommendation == "build_new_adapter"
    assert target is None


def test_build_site_candidates_aggregates_per_domain_counts():
    listings = [
        {"external_url": "https://example-auction.com/lot/1"},
        {"external_url": "https://example-auction.com/lot/2"},
        {"external_url": "https://other-auction.com/a"},
    ]

    candidates = build_site_candidates(listings)

    assert candidates[0].domain == "example-auction.com"
    assert candidates[0].listing_count == 2
    assert {c.domain for c in candidates} == {"example-auction.com", "other-auction.com"}
