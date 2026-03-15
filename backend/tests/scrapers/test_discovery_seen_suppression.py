from scrapers.sources.discovery import DiscoveryScraper


def test_is_previously_seen_domain_matches_normalized_domain():
    scraper = DiscoveryScraper(cache_only=True)
    scraper._seen_domains = {"exampleauction.com"}

    assert scraper._is_previously_seen_domain("https://www.exampleauction.com/auctions")
    assert not scraper._is_previously_seen_domain("https://differentauction.com/auctions")
