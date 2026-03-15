from xml.etree import ElementTree as ET

from scrapers.sources.liveauctioneers import LiveAuctioneersScraper


class _NoopRateLimiter:
    async def wait(self, *_args, **_kwargs):
        return None


class _NoopProxyPool:
    async def get_proxy(self):
        return None


def _scraper() -> LiveAuctioneersScraper:
    return LiveAuctioneersScraper(rate_limiter=_NoopRateLimiter(), proxy_pool=_NoopProxyPool())


def test_parse_sitemap_xml_handles_urlset_and_sitemapindex():
    scraper = _scraper()

    root = ET.fromstring(
        """
        <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <sitemap><loc>https://www.liveauctioneers.com/sitemap-auctions-1.xml</loc></sitemap>
          <sitemap><loc>https://www.liveauctioneers.com/sitemap-auctions-2.xml</loc></sitemap>
        </sitemapindex>
        """
    )
    listing_urls, child_sitemaps = scraper._parse_sitemap_xml(root)

    assert listing_urls == []
    assert child_sitemaps == [
        "https://www.liveauctioneers.com/sitemap-auctions-1.xml",
        "https://www.liveauctioneers.com/sitemap-auctions-2.xml",
    ]

    root = ET.fromstring(
        """
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url><loc>https://www.liveauctioneers.com/item/12345-a</loc></url>
          <url><loc>https://www.liveauctioneers.com/item/67890-b</loc></url>
        </urlset>
        """
    )
    listing_urls, child_sitemaps = scraper._parse_sitemap_xml(root)

    assert listing_urls == [
        "https://www.liveauctioneers.com/item/12345-a",
        "https://www.liveauctioneers.com/item/67890-b",
    ]
    assert child_sitemaps == []


def test_normalize_item_skips_records_without_lot_id():
    scraper = _scraper()

    assert scraper._normalize_item({"auctionId": "99", "title": "No lot"}) is None

    normalized = scraper._normalize_item({"id": "123", "auctionId": "99", "title": "Lot"})
    assert normalized is not None
    assert normalized.external_id == "99_123"
