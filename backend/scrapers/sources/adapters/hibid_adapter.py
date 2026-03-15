from __future__ import annotations

from typing import TYPE_CHECKING, AsyncIterator

from scrapers.sources.adapter_base import SourceAdapter

if TYPE_CHECKING:
    from scrapers.sources.hibid import HibidScraper


class HibidAuctionAdapter(SourceAdapter):
    def __init__(
        self,
        *,
        scraper: "HibidScraper",
        state: str,
        country: str,
        max_pages: int,
        page_length: int,
    ):
        super().__init__(platform_slug=scraper.platform_slug)
        self.scraper = scraper
        self.state = state
        self.country = country
        self.max_pages = max_pages
        self.page_length = page_length

    async def fetch(self) -> AsyncIterator[dict]:
        from scrapers.sources.hibid import HIBID_BASE_URL, _AUCTION_SEARCH_QUERY

        for page_number in range(1, self.max_pages + 1):
            variables = {
                "pageNumber": page_number,
                "pageLength": self.page_length,
            }
            if self.state:
                variables["state"] = self.state
            if self.country:
                variables["countryName"] = self.country

            payload = {
                "operationName": "CatalogSearch",
                "query": _AUCTION_SEARCH_QUERY,
                "variables": variables,
            }
            data = await self.scraper._post_gql(
                payload, referer=f"{HIBID_BASE_URL}/catalog-search"
            )
            yield data

            total_count = (
                data.get("data", {})
                .get("auctionSearch", {})
                .get("pagedResults", {})
                .get("totalCount", 0)
            )
            if page_number * self.page_length >= total_count:
                break

    def parse(self, payload: dict) -> list[dict]:
        if "errors" in payload:
            self.scraper.logger.warning(
                "HiBid GraphQL returned errors: %s", payload["errors"][:2]
            )
            return []

        return (
            payload.get("data", {})
            .get("auctionSearch", {})
            .get("pagedResults", {})
            .get("results", [])
        )

    def normalize(self, record: dict):
        auction = record.get("auction")
        if not auction:
            return None
        return self.scraper._normalize(auction)
