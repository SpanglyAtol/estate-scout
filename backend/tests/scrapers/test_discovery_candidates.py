from scrapers.sources.discovery import DiscoveryScraper


def test_candidate_link_relevance_prefers_auction_context():
    assert DiscoveryScraper._candidate_link_is_relevant(
        "https://exampleauction.com/upcoming-auctions",
        "Visit Website",
        "Estate auction company with online bidding",
    )


def test_candidate_link_relevance_rejects_social_links():
    assert not DiscoveryScraper._candidate_link_is_relevant(
        "https://facebook.com/example",
        "Facebook",
        "Follow us on social",
    )


def test_candidate_url_score_prioritizes_listing_like_paths():
    high = DiscoveryScraper._score_candidate_url("https://acme.com/auctions/catalog")
    low = DiscoveryScraper._score_candidate_url("https://acme.com/privacy")
    assert high > low
