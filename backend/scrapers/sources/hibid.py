"""
HiBid scraper using the site's GraphQL API.

HiBid exposes a GraphQL endpoint at https://hibid.com/graphql that the
Angular front-end uses.  Schema was reverse-engineered from the minified
JS bundle (main.*.js on the CDN).

Key fields on AuctionSearchInput:
  searchText, state, countryName, status, category, zip, miles,
  shippingOffered, closingDate  (all optional)

Pagination is separate top-level args on auctionSearch():
  pageNumber: Int, pageLength: Int

Results path: auctionSearch.pagedResults.results[] → AuctionMatchType
  .auction → Auction type fields used below.

Lot-level items are fetched via a separate lotSearch() GQL query,
keyed on the auction's numeric catalog ID.
"""

import json
import re
from datetime import datetime
from typing import AsyncIterator

from scrapers.base import BaseScraper, ScrapedItem, ScrapedListing


# Full GQL query, matching what the HiBid catalog-search page uses
_AUCTION_SEARCH_QUERY = """
query CatalogSearch(
    $searchText: String,
    $state: String,
    $countryName: String,
    $pageNumber: Int,
    $pageLength: Int
) {
  auctionSearch(
    input: {
      searchText: $searchText,
      state: $state,
      countryName: $countryName
    }
    pageNumber: $pageNumber
    pageLength: $pageLength
  ) {
    pagedResults {
      pageNumber
      pageLength
      totalCount
      filteredCount
      results {
        auction {
          id
          eventName
          description
          lotCount
          eventCity
          eventState
          eventZip
          eventDateEnd
          bidCloseDateTime
          bidOpenDateTime
          bidType
          featuredPicture { fullSizeLocation }
          auctioneer { id name city state }
        }
      }
    }
  }
}
"""

HIBID_GQL_ENDPOINT = "https://hibid.com/graphql"
HIBID_BASE_URL = "https://hibid.com"

# GraphQL query to fetch individual lots within a HiBid auction catalog.
# Uses the lotSearch() resolver observed in the HiBid Angular SPA network traffic.
_LOT_SEARCH_QUERY = """
query LotSearch(
    $catalogId: Int!,
    $pageNumber: Int,
    $pageLength: Int
) {
  lotSearch(
    catalogId: $catalogId
    pageNumber: $pageNumber
    pageLength: $pageLength
  ) {
    pagedResults {
      totalCount
      results {
        lot {
          id
          lotNum
          title
          description
          category
          condition
          lowEstimate
          highEstimate
          currentBid
          hammerPrice
          bidCount
          status
          startDateTime
          endDateTime
          primaryImage { fullSizeLocation thumbnailLocation }
          images { fullSizeLocation thumbnailLocation }
        }
      }
    }
  }
}
"""


class HibidScraper(BaseScraper):
    """
    Scraper for HiBid.com via its GraphQL API.

    Previously this tried HTML / __NEXT_DATA__ parsing, but HiBid is an
    Angular SPA — the listing data lives entirely in GraphQL responses.
    We now call the API directly.
    """

    platform_slug = "hibid"
    base_url = HIBID_BASE_URL
    default_rate_limit = 0.5   # GraphQL is cheaper to rate-limit than HTML

    async def scrape_listings(
        self,
        state: str = "",
        country: str = "USA",
        **kwargs,
    ) -> AsyncIterator[ScrapedListing]:
        """
        Yield auction catalog listings from HiBid.

        Args:
            state:    2-letter state code (e.g. "WA").  Leave blank for all US.
            country:  Country filter passed to HiBid.  "USA" keeps results to
                      the United States; pass "" or None to include Canada.
            **kwargs: max_pages (default 10), page_length (default 100).
        """
        max_pages = kwargs.get("max_pages", 10)
        page_length = kwargs.get("page_length", 100)

        for page_number in range(1, max_pages + 1):
            variables = {
                "pageNumber": page_number,
                "pageLength": page_length,
            }
            if state:
                variables["state"] = state
            if country:
                variables["countryName"] = country

            payload = {
                "operationName": "CatalogSearch",
                "query": _AUCTION_SEARCH_QUERY,
                "variables": variables,
            }

            try:
                if self.rate_limiter:
                    await self.rate_limiter.acquire(self.platform_slug)

                response = await self._session.post(
                    HIBID_GQL_ENDPOINT,
                    json=payload,
                    headers={
                        "User-Agent": self._user_agent(),
                        "Content-Type": "application/json",
                        "Accept": "application/json",
                        "Origin": HIBID_BASE_URL,
                        "Referer": f"{HIBID_BASE_URL}/catalog-search",
                    },
                )
                response.raise_for_status()

                data = response.json()
                if "errors" in data:
                    self.logger.warning(
                        f"HiBid GraphQL errors on page {page_number}: "
                        f"{data['errors'][:2]}"
                    )
                    break

                paged = (
                    data.get("data", {})
                    .get("auctionSearch", {})
                    .get("pagedResults", {})
                )
                results = paged.get("results", [])
                total_count = paged.get("totalCount", 0)

                if not results:
                    self.logger.info(
                        f"HiBid: no more results at page {page_number}"
                    )
                    break

                self.logger.info(
                    f"HiBid page {page_number}: {len(results)} auctions "
                    f"(total reported: {total_count})"
                )

                for match in results:
                    auction = match.get("auction")
                    if not auction:
                        continue
                    listing = self._normalize(auction)
                    if listing:
                        # Fetch individual lot items for this auction
                        auction_id_int = self._to_int(auction.get("id"))
                        if auction_id_int:
                            listing.items = await self._fetch_lots(auction_id_int)
                            if listing.items:
                                self.logger.info(
                                    f"HiBid auction {auction_id_int}: "
                                    f"{len(listing.items)} lots fetched"
                                )
                        yield listing

                # Stop if we've retrieved everything
                if page_number * page_length >= total_count:
                    break

            except Exception as exc:
                self.logger.error(
                    f"HiBid error on page {page_number}: {exc}"
                )
                break

    def _normalize(self, auction: dict) -> ScrapedListing | None:
        """Convert a raw HiBid auction dict to a ScrapedListing."""
        try:
            auction_id = str(auction.get("id", ""))
            if not auction_id:
                return None

            title = (auction.get("eventName") or "").strip()
            if not title:
                # Fall back to auctioneer name + id
                auctioneer_name = (
                    (auction.get("auctioneer") or {}).get("name", "")
                )
                title = f"Auction #{auction_id}" + (
                    f" – {auctioneer_name}" if auctioneer_name else ""
                )

            # Location: prefer event* fields, fall back to auctioneer fields
            auctioneer = auction.get("auctioneer") or {}
            city = (auction.get("eventCity") or auctioneer.get("city") or "").strip()
            state = (auction.get("eventState") or auctioneer.get("state") or "").strip()
            zip_code = (auction.get("eventZip") or "").strip() or None

            # Dates
            end_date = self._parse_dt(
                auction.get("bidCloseDateTime") or auction.get("eventDateEnd")
            )
            start_date = self._parse_dt(auction.get("bidOpenDateTime"))

            # Image — CDN URL is already absolute
            img_url: str | None = None
            fp = auction.get("featuredPicture")
            if fp and isinstance(fp, dict):
                img_url = fp.get("fullSizeLocation") or None

            # External URL: HiBid catalog pages use /auctions/online/{id}/
            external_url = f"{HIBID_BASE_URL}/auctions/online/{auction_id}/"

            return ScrapedListing(
                platform_slug=self.platform_slug,
                external_id=auction_id,
                external_url=external_url,
                title=title,
                description=(auction.get("description") or "").strip() or None,
                city=city or None,
                state=state or None,
                zip_code=zip_code,
                sale_starts_at=start_date,
                sale_ends_at=end_date,
                primary_image_url=img_url,
                pickup_only=False,   # HiBid auctions can ship
                ships_nationally=True,
                raw_data=auction,
            )
        except Exception as exc:
            self.logger.debug(f"HiBid _normalize error: {exc}")
            return None

    async def _fetch_lots(self, catalog_id: int, max_lots: int = 200) -> list[ScrapedItem]:
        """Fetch individual lot items for a HiBid auction via GraphQL."""
        items: list[ScrapedItem] = []
        page_length = 50
        page = 1

        while len(items) < max_lots:
            payload = {
                "operationName": "LotSearch",
                "query": _LOT_SEARCH_QUERY,
                "variables": {
                    "catalogId": catalog_id,
                    "pageNumber": page,
                    "pageLength": page_length,
                },
            }
            try:
                if self.rate_limiter:
                    await self.rate_limiter.acquire(self.platform_slug)

                response = await self._session.post(
                    HIBID_GQL_ENDPOINT,
                    json=payload,
                    headers={
                        "User-Agent": self._user_agent(),
                        "Content-Type": "application/json",
                        "Accept": "application/json",
                        "Origin": HIBID_BASE_URL,
                        "Referer": f"{HIBID_BASE_URL}/auctions/online/{catalog_id}/",
                    },
                )
                response.raise_for_status()
                data = response.json()

                if "errors" in data:
                    self.logger.debug(
                        f"HiBid lots GQL errors for catalog {catalog_id}: {data['errors'][:1]}"
                    )
                    break

                paged = (
                    data.get("data", {})
                    .get("lotSearch", {})
                    .get("pagedResults", {})
                )
                results = paged.get("results", [])
                total = paged.get("totalCount", 0)

                if not results:
                    break

                for match in results:
                    lot = match.get("lot")
                    if not lot:
                        continue
                    item = self._lot_to_item(lot, catalog_id)
                    if item:
                        items.append(item)

                if page * page_length >= min(total, max_lots):
                    break
                page += 1

            except Exception as exc:
                self.logger.debug(f"HiBid lots fetch error for {catalog_id}: {exc}")
                break

        return items

    def _lot_to_item(self, lot: dict, catalog_id: int) -> ScrapedItem | None:
        """Convert a HiBid lot GQL object to a ScrapedItem."""
        try:
            title = (lot.get("title") or "").strip()
            if not title:
                return None

            lot_num = str(lot.get("lotNum") or lot.get("id") or "")

            # Images
            images: list[str] = []
            primary_img_node = lot.get("primaryImage") or {}
            for key in ("fullSizeLocation", "thumbnailLocation"):
                url = primary_img_node.get(key)
                if url:
                    images.insert(0, url)
                    break
            for img_node in lot.get("images") or []:
                url = img_node.get("fullSizeLocation") or img_node.get("thumbnailLocation") or ""
                if url and url not in images:
                    images.append(url)

            # Pricing
            def _f(val):
                try:
                    return float(val) if val is not None else None
                except (TypeError, ValueError):
                    return None

            current_bid = _f(lot.get("currentBid"))
            hammer = _f(lot.get("hammerPrice"))
            est_low = _f(lot.get("lowEstimate"))
            est_high = _f(lot.get("highEstimate"))

            # External URL — HiBid lot pages
            lot_id = str(lot.get("id") or "")
            external_url = (
                f"{HIBID_BASE_URL}/auctions/online/{catalog_id}/#lot-{lot_num}"
                if lot_num else f"{HIBID_BASE_URL}/auctions/online/{catalog_id}/"
            )

            return ScrapedItem(
                title=title,
                lot_number=lot_num or None,
                description=(lot.get("description") or "").strip() or None,
                current_price=current_bid,
                estimate_low=est_low,
                estimate_high=est_high,
                primary_image_url=images[0] if images else None,
                image_urls=images,
                category=lot.get("category"),
                condition=lot.get("condition"),
                external_url=external_url,
            )
        except Exception as exc:
            self.logger.debug(f"HiBid lot parse error: {exc}")
            return None

    @staticmethod
    def _to_int(value) -> int | None:
        try:
            return int(value) if value is not None else None
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _parse_dt(value) -> datetime | None:
        if not value:
            return None
        fmts = [
            "%Y-%m-%dT%H:%M:%SZ",
            "%Y-%m-%dT%H:%M:%S.%fZ",
            "%Y-%m-%dT%H:%M:%S%z",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d",
        ]
        for fmt in fmts:
            try:
                return datetime.strptime(str(value), fmt)
            except ValueError:
                continue
        return None

    # ------------------------------------------------------------------
    # The old HTML/GraphQL-probing methods are kept as dead code for
    # reference but are no longer called.
    # ------------------------------------------------------------------

    async def scrape_listing_detail(self, external_id: str) -> ScrapedListing | None:
        """Not implemented — auction-level data is sufficient."""
        return None
