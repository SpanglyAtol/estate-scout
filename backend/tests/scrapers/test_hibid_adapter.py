import asyncio

from scrapers.sources.adapters.hibid_adapter import HibidAuctionAdapter


class _FakeScraper:
    platform_slug = "hibid"

    def __init__(self):
        self.calls = 0
        self.logger = type("L", (), {"warning": lambda *args, **kwargs: None})()

    async def _post_gql(self, payload, referer=""):
        self.calls += 1
        page = payload["variables"]["pageNumber"]
        if page == 1:
            return {
                "data": {
                    "auctionSearch": {
                        "pagedResults": {
                            "totalCount": 2,
                            "results": [
                                {"auction": {"id": "10", "eventName": "A"}},
                                {"auction": {"id": "11", "eventName": "B"}},
                            ],
                        }
                    }
                }
            }
        return {"data": {"auctionSearch": {"pagedResults": {"totalCount": 2, "results": []}}}}

    def _normalize(self, auction):
        from scrapers.base import ScrapedListing

        return ScrapedListing(
            platform_slug="hibid",
            external_id=str(auction["id"]),
            external_url=f"https://hibid.com/{auction['id']}",
            title=auction["eventName"],
        )


def test_hibid_adapter_run_emits_listings_and_stats():
    scraper = _FakeScraper()
    adapter = HibidAuctionAdapter(
        scraper=scraper,
        state="",
        country="USA",
        max_pages=2,
        page_length=2,
    )

    async def _collect():
        return [listing async for listing in adapter.run()]

    listings = asyncio.run(_collect())

    assert len(listings) == 2
    assert listings[0].external_id == "10"
    assert adapter.emit_stats()["listings_emitted"] == 2
    assert adapter.emit_stats()["records_seen"] == 2
    assert adapter.emit_stats()["pages_fetched"] == 1
