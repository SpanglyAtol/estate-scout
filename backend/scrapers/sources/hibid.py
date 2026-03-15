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

import asyncio
import json
import re
from typing import AsyncIterator

from scrapers.base import BaseScraper, ScrapedItem, ScrapedListing
from scrapers.sources.adapters.hibid_adapter import HibidAuctionAdapter


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
          shippingOffered
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

        # Limit concurrent lot-fetching to avoid overwhelming the GQL endpoint
        lot_semaphore = asyncio.Semaphore(kwargs.get("lot_concurrency", 5))

        async def _fetch_lots_limited(catalog_id: int) -> list[ScrapedItem]:
            async with lot_semaphore:
                return await self._fetch_lots(catalog_id)

        adapter = HibidAuctionAdapter(
            scraper=self,
            state=state,
            country=country,
            max_pages=max_pages,
            page_length=page_length,
        )

        try:
            async for payload in adapter.fetch():
                results = adapter.parse(payload)
                if not results:
                    continue

                self.logger.info("HiBid adapter page: %s auctions", len(results))

                # Normalize all auctions on this page first
                page_listings: list[tuple] = []  # (listing, auction_id_int)
                for match in results:
                    listing = adapter.normalize(match)
                    if listing:
                        auction_id_int = self._to_int((match.get("auction") or {}).get("id"))
                        page_listings.append((listing, auction_id_int))

                # Fetch lots for all auctions on this page concurrently (rate-limited)
                async def _empty_lots() -> list:
                    return []

                if page_listings:
                    lot_tasks = [
                        _fetch_lots_limited(aid) if aid else _empty_lots()
                        for _, aid in page_listings
                    ]
                    lot_results = await asyncio.gather(*lot_tasks, return_exceptions=True)
                    for (listing, auction_id_int), lots in zip(page_listings, lot_results):
                        if isinstance(lots, list) and lots:
                            listing.items = lots
                            self.logger.info(
                                f"HiBid auction {auction_id_int}: {len(lots)} lots fetched"
                            )
                        yield listing
        except Exception as exc:
            self.logger.error("HiBid adapter execution failed: %s", exc)

        self.logger.info("HiBid adapter stats: %s", adapter.emit_stats())

    async def _post_gql(self, payload: dict, referer: str = "") -> dict:
        """Rate-limited GraphQL POST with exponential backoff on 429/503.

        Mirrors BaseScraper._fetch() retry logic for POST requests, which
        _fetch() doesn't cover (it only handles GET).
        """
        headers = {
            "User-Agent": self._user_agent(),
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Origin": HIBID_BASE_URL,
            "Referer": referer or f"{HIBID_BASE_URL}/catalog-search",
        }
        for attempt in range(3):
            if self.rate_limiter:
                await self.rate_limiter.acquire(self.platform_slug)
            response = await self._session.post(
                HIBID_GQL_ENDPOINT, json=payload, headers=headers
            )
            if response.status_code in (429, 503):
                wait = 2 ** attempt * 5
                self.logger.warning(
                    f"HiBid GQL rate limited ({response.status_code}), waiting {wait}s"
                )
                await asyncio.sleep(wait)
                continue
            response.raise_for_status()
            return response.json()
        raise RuntimeError("HiBid GraphQL POST failed after 3 attempts")

    # bidType values observed in API: "TIMED", "LIVE", "SIMULCAST"
    _BID_TYPE_STATUS: dict[str, str] = {
        "TIMED": "active",
        "LIVE": "active",
        "SIMULCAST": "active",
        "CLOSED": "completed",
        "PREVIEW": "upcoming",
    }

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

            # bidType → auction_status
            bid_type = (auction.get("bidType") or "").upper()
            auction_status = self._BID_TYPE_STATUS.get(bid_type, "active")

            # shippingOffered: true means items can be shipped
            shipping_offered = auction.get("shippingOffered")
            if shipping_offered is None:
                ships_nationally = True   # default assumption for HiBid
                pickup_only = False
            else:
                ships_nationally = bool(shipping_offered)
                pickup_only = not ships_nationally

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
                listing_type="auction",
                item_type="auction_catalog",
                auction_status=auction_status,
                pickup_only=pickup_only,
                ships_nationally=ships_nationally,
                raw_data=auction,
            )
        except Exception as exc:
            self.logger.debug(f"HiBid _normalize error: {exc}")
            return None

    async def _fetch_lots(
        self,
        catalog_id: int,
        max_lots: int = 2000,
    ) -> list[ScrapedItem]:
        """Fetch all lot items for a HiBid auction via GraphQL.

        Args:
            catalog_id: Numeric HiBid catalog / auction ID.
            max_lots:   Safety cap to prevent runaway fetches on giant auctions.
                        Default 2000.  A warning is logged if the auction has
                        more lots than this limit.
        """
        items: list[ScrapedItem] = []
        page_length = 50
        page = 1
        total_reported = 0

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
                data = await self._post_gql(
                    payload, referer=f"{HIBID_BASE_URL}/auctions/online/{catalog_id}/"
                )
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
                total_reported = paged.get("totalCount", 0) or 0

                if not results:
                    break

                for match in results:
                    lot = match.get("lot")
                    if not lot:
                        continue
                    item = self._lot_to_item(lot, catalog_id)
                    if item:
                        items.append(item)

                # All pages fetched?
                if page * page_length >= total_reported:
                    break
                page += 1

            except Exception as exc:
                self.logger.debug(f"HiBid lots fetch error for {catalog_id}: {exc}")
                break

        if total_reported and len(items) < total_reported:
            self.logger.warning(
                f"HiBid catalog {catalog_id}: fetched {len(items)} of "
                f"{total_reported} reported lots (cap={max_lots})"
            )

        return items

    # lot status values observed in API
    _LOT_COMPLETED_STATUSES = frozenset({"SOLD", "PASSED", "CLOSED", "UNSOLD"})

    def _lot_to_item(self, lot: dict, catalog_id: int) -> ScrapedItem | None:
        """Convert a HiBid lot GQL object to a ScrapedItem."""
        try:
            title = (lot.get("title") or "").strip()
            if not title:
                return None

            lot_num = str(lot.get("lotNum") or "")
            lot_id = str(lot.get("id") or "")

            # Images — prefer fullSizeLocation over thumbnail
            images: list[str] = []
            primary_img_node = lot.get("primaryImage") or {}
            primary_url = (
                primary_img_node.get("fullSizeLocation")
                or primary_img_node.get("thumbnailLocation")
            )
            if primary_url:
                images.append(primary_url)
            for img_node in lot.get("images") or []:
                url = (
                    img_node.get("fullSizeLocation")
                    or img_node.get("thumbnailLocation")
                    or ""
                )
                if url and url not in images:
                    images.append(url)

            # Pricing — use _parse_price to handle 0, None, strings
            current_bid = self._parse_price(lot.get("currentBid"))
            hammer = self._parse_price(lot.get("hammerPrice"))
            est_low = self._parse_price(lot.get("lowEstimate"))
            est_high = self._parse_price(lot.get("highEstimate"))

            # Completion status
            lot_status = (lot.get("status") or "").upper()
            is_completed = lot_status in self._LOT_COMPLETED_STATUSES

            # Bid count
            bid_count_raw = lot.get("bidCount")
            bid_count = int(bid_count_raw) if bid_count_raw is not None else None

            # Sale end datetime
            sale_ends_at = self._parse_dt(lot.get("endDateTime"))

            # External URL — HiBid lot detail pages use /lot/{lot_id}
            if lot_id:
                external_url = f"{HIBID_BASE_URL}/lot/{lot_id}"
            elif lot_num:
                external_url = f"{HIBID_BASE_URL}/auctions/online/{catalog_id}/#lot-{lot_num}"
            else:
                external_url = f"{HIBID_BASE_URL}/auctions/online/{catalog_id}/"

            return ScrapedItem(
                title=title,
                lot_number=lot_num or None,
                description=(lot.get("description") or "").strip() or None,
                current_price=current_bid,
                hammer_price=hammer,
                estimate_low=est_low,
                estimate_high=est_high,
                bid_count=bid_count,
                is_completed=is_completed,
                sale_ends_at=sale_ends_at,
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

    # _parse_price, _parse_dt, _parse_iso inherited from BaseScraper

    # ------------------------------------------------------------------
    # The old HTML/GraphQL-probing methods are kept as dead code for
    # reference but are no longer called.
    # ------------------------------------------------------------------

    async def scrape_listing_detail(self, external_id: str) -> ScrapedListing | None:
        """Not implemented — auction-level data is sufficient."""
        return None
