"""
MaxSold scraper — uses __NEXT_DATA__ embedded JSON from the homepage.

MaxSold is a Next.js app that geo-locates the visitor and returns nearby
auctions in the page's server-side data.  The previous catalog URL no
longer exists; this version reads the embedded JSON instead.

Data shape on the homepage:
  props.pageProps.listings.listings  - individual lot objects
  props.pageProps.sales.data          - auction/sale metadata

Lot external URL:  https://maxsold.com/auction/{amAuctionId}
"""

import json
import re
from datetime import datetime
from typing import AsyncIterator

from bs4 import BeautifulSoup

from scrapers.base import BaseScraper, ScrapedItem, ScrapedListing


# Major US metro coordinates for national coverage.
# Each coordinate pair anchors a MaxSold geo-search with a 150 km radius.
_US_METRO_COORDS = [
    (47.6062,  -122.3321),   # Seattle, WA
    (40.7128,   -74.0060),   # New York, NY
    (34.0522,  -118.2437),   # Los Angeles, CA
    (41.8781,   -87.6298),   # Chicago, IL
    (29.7604,   -95.3698),   # Houston, TX
    (39.9526,   -75.1652),   # Philadelphia, PA
    (33.4484,  -112.0740),   # Phoenix, AZ
    (32.7767,   -96.7970),   # Dallas, TX
    (39.7392,  -104.9903),   # Denver, CO
    (42.3601,   -71.0589),   # Boston, MA
    (44.9778,   -93.2650),   # Minneapolis, MN
    (33.7490,   -84.3880),   # Atlanta, GA
    (25.7617,   -80.1918),   # Miami, FL
]


class MaxSoldScraper(BaseScraper):
    platform_slug = "maxsold"
    base_url = "https://maxsold.com"
    default_rate_limit = 0.5

    HOME_URL = "https://maxsold.com/"

    async def scrape_listings(
        self,
        state: str = "",
        **kwargs,
    ) -> AsyncIterator[ScrapedListing]:
        """
        Yield ScrapedListings from MaxSold's homepage __NEXT_DATA__.
        MaxSold geo-locates by IP so we get regionally relevant results.

        When state="" (national mode), cycles through 13 major US metros to
        get broad geographic coverage.  When a specific state is requested,
        only tries metro coordinates in or near that state.
        """
        # Build the list of geo-search URLs to try
        if state.upper() == "":
            # National mode: hit every metro coordinate for maximum coverage
            pages_to_try = [
                f"https://maxsold.com/?lat={lat}&lng={lng}&radius=150000"
                for lat, lng in _US_METRO_COORDS
            ]
        else:
            # State-specific mode: only use metros roughly matching that state
            # Fall through to WA (Seattle) coords as default fallback
            pages_to_try = [self.HOME_URL]
            if state.upper() == "WA":
                pages_to_try.append("https://maxsold.com/?lat=47.6062&lng=-122.3321&radius=150000")
            elif state.upper() in ("NY", "NJ", "CT"):
                pages_to_try.append("https://maxsold.com/?lat=40.7128&lng=-74.0060&radius=150000")
            elif state.upper() in ("CA",):
                pages_to_try.append("https://maxsold.com/?lat=34.0522&lng=-118.2437&radius=150000")
            elif state.upper() in ("IL",):
                pages_to_try.append("https://maxsold.com/?lat=41.8781&lng=-87.6298&radius=150000")
            elif state.upper() in ("TX",):
                pages_to_try.append("https://maxsold.com/?lat=29.7604&lng=-95.3698&radius=150000")
            elif state.upper() in ("PA",):
                pages_to_try.append("https://maxsold.com/?lat=39.9526&lng=-75.1652&radius=150000")
            elif state.upper() in ("AZ",):
                pages_to_try.append("https://maxsold.com/?lat=33.4484&lng=-112.0740&radius=150000")
            elif state.upper() in ("CO",):
                pages_to_try.append("https://maxsold.com/?lat=39.7392&lng=-104.9903&radius=150000")
            elif state.upper() in ("MA",):
                pages_to_try.append("https://maxsold.com/?lat=42.3601&lng=-71.0589&radius=150000")
            elif state.upper() in ("MN",):
                pages_to_try.append("https://maxsold.com/?lat=44.9778&lng=-93.2650&radius=150000")
            elif state.upper() in ("GA",):
                pages_to_try.append("https://maxsold.com/?lat=33.7490&lng=-84.3880&radius=150000")
            elif state.upper() in ("FL",):
                pages_to_try.append("https://maxsold.com/?lat=25.7617&lng=-80.1918&radius=150000")

        seen_ids: set = set()

        for url in pages_to_try:
            try:
                response = await self._fetch(
                    url,
                    headers=self._browser_headers(referer="https://maxsold.com/"),
                )
                page_data = self._extract_next_data(response.text)
                if not page_data:
                    self.logger.info(f"MaxSold: no __NEXT_DATA__ at {url}")
                    continue

                pp = page_data.get("props", {}).get("pageProps", {})

                # Build auction_id → lots mapping from the listings payload
                lots_by_auction: dict[str, list] = {}
                for lot in pp.get("listings", {}).get("listings", []):
                    aid = str(lot.get("amAuctionId", ""))
                    if aid:
                        lots_by_auction.setdefault(aid, []).append(lot)

                # Yield one listing per unique auction (sale-level only).
                # Individual lots are stored as nested ScrapedItem objects.
                for sale in pp.get("sales", {}).get("data", []):
                    sale_id = str(sale.get("amAuctionId", ""))
                    key = f"sale_{sale_id}"
                    if not sale_id or key in seen_ids:
                        continue
                    seen_ids.add(key)
                    listing = self._sale_to_listing(
                        sale, lots_by_auction.get(sale_id, [])
                    )
                    if listing:
                        yield listing

            except Exception as exc:
                self.logger.warning(f"MaxSold error at {url}: {exc}")

    # ── helpers ──────────────────────────────────────────────────────────────

    def _extract_next_data(self, html):
        """Parse __NEXT_DATA__ JSON embedded in the page."""
        match = re.search(
            r'<script[^>]+id=["\']__NEXT_DATA__["\'][^>]*>(.*?)</script>',
            html,
            re.DOTALL,
        )
        if not match:
            return None
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            return None

    def _lot_to_listing(self, lot, sale):
        """Convert a MaxSold lot object to ScrapedListing."""
        try:
            auction_id = str(lot.get("amAuctionId", ""))
            lot_id = str(lot.get("amLotId", ""))
            if not auction_id or not lot_id:
                return None

            external_url = f"{self.base_url}/auction/{auction_id}"

            images = lot.get("imagePaths", [])
            primary_img = images[0] if images else None

            addr = lot.get("address") or sale.get("address") or {}
            city = addr.get("city", "")
            region_code = addr.get("regionCode", "")
            state = region_code.upper() if region_code else ""

            bid_info = lot.get("currentBid") or {}
            price_raw = bid_info.get("amount")
            current_price = float(price_raw) if price_raw else None

            return ScrapedListing(
                platform_slug=self.platform_slug,
                external_id=lot_id,
                external_url=external_url,
                title=lot.get("title") or lot.get("auctionTitle") or "MaxSold Lot",
                description=lot.get("description"),
                category=lot.get("saleCategory") or sale.get("saleCategory"),
                current_price=current_price,
                pickup_only=True,
                ships_nationally=False,
                city=city,
                state=state,
                sale_starts_at=self._parse_iso(lot.get("openTime") or sale.get("openTime")),
                sale_ends_at=self._parse_iso(lot.get("closeTime") or sale.get("closeTime")),
                primary_image_url=primary_img,
                image_urls=images,
                raw_data={"lot": lot, "sale": sale},
            )
        except Exception as exc:
            self.logger.debug(f"MaxSold lot parse error: {exc}")
            return None

    def _sale_to_listing(self, sale, lots=None):
        """Convert a MaxSold sale (auction) to a ScrapedListing.

        ``lots`` is an optional list of individual lot dicts from the same
        __NEXT_DATA__ payload.  Each lot is converted to a ScrapedItem and
        stored in listing.items so the frontend can display a browsable grid.
        """
        try:
            auction_id = str(sale.get("amAuctionId", ""))
            if not auction_id:
                return None

            images = sale.get("images", [])
            primary_img = images[0] if images else None

            addr = sale.get("address", {})
            state = addr.get("regionCode", "").upper()
            external_url = f"{self.base_url}/auction/{auction_id}"

            listing = ScrapedListing(
                platform_slug=self.platform_slug,
                external_id=f"sale_{auction_id}",
                external_url=external_url,
                title=sale.get("title") or f"MaxSold Auction #{auction_id}",
                category=sale.get("saleCategory"),
                pickup_only=True,
                ships_nationally=not sale.get("hasShipping", False),
                city=addr.get("city", ""),
                state=state,
                sale_starts_at=self._parse_iso(sale.get("openTime")),
                sale_ends_at=self._parse_iso(sale.get("closeTime")),
                primary_image_url=primary_img,
                image_urls=images,
                raw_data={"sale": sale},
            )

            # Populate individual lot items
            for lot in (lots or []):
                try:
                    lot_images = lot.get("imagePaths", [])
                    bid_info = lot.get("currentBid") or {}
                    price_raw = bid_info.get("amount")
                    lot_title = lot.get("title") or lot.get("name") or ""
                    if not lot_title:
                        continue
                    item = ScrapedItem(
                        title=lot_title,
                        lot_number=str(lot.get("amLotId") or lot.get("id") or "") or None,
                        description=lot.get("description"),
                        current_price=float(price_raw) if price_raw is not None else None,
                        estimate_low=float(lot["estimateLow"]) if lot.get("estimateLow") else None,
                        estimate_high=float(lot["estimateHigh"]) if lot.get("estimateHigh") else None,
                        primary_image_url=lot_images[0] if lot_images else None,
                        image_urls=lot_images,
                        category=lot.get("saleCategory"),
                        external_url=external_url,
                    )
                    listing.items.append(item)
                except Exception as lot_exc:
                    self.logger.debug(f"MaxSold lot item error: {lot_exc}")

            if listing.items:
                self.logger.info(
                    f"MaxSold auction {auction_id}: {len(listing.items)} lots scraped"
                )
            return listing
        except Exception as exc:
            self.logger.debug(f"MaxSold sale parse error: {exc}")
            return None

    @staticmethod
    def _parse_iso(value):
        if not value:
            return None
        try:
            return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except Exception:
            return None

    async def scrape_listing_detail(self, external_id):
        """Best-effort fetch of a detail page using JSON-LD."""
        auction_id = external_id.replace("sale_", "").split("_")[0]
        url = f"{self.base_url}/auction/{auction_id}"
        try:
            response = await self._fetch(
                url,
                headers=self._browser_headers(referer=self.base_url + "/"),
            )
            soup = BeautifulSoup(response.text, "lxml")
            ld = soup.find("script", type="application/ld+json")
            if ld:
                data = json.loads(ld.string)
                if isinstance(data, list):
                    data = data[0]
                return ScrapedListing(
                    platform_slug=self.platform_slug,
                    external_id=external_id,
                    external_url=url,
                    title=data.get("name", ""),
                    description=data.get("description", ""),
                    pickup_only=True,
                    primary_image_url=(
                        data.get("image", [None])[0]
                        if isinstance(data.get("image"), list)
                        else data.get("image")
                    ),
                    raw_data=data,
                )
        except Exception as exc:
            self.logger.error(f"MaxSold detail error for {external_id}: {exc}")
        return None
