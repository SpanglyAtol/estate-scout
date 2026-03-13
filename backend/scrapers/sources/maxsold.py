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
    (45.5051,  -122.6750),   # Portland, OR
    (36.1627,   -86.7816),   # Nashville, TN
    (39.1031,   -84.5120),   # Cincinnati, OH
    (43.0481,   -76.1474),   # Syracuse, NY (upstate coverage)
    (35.2271,   -80.8431),   # Charlotte, NC
    (38.2527,   -85.7585),   # Louisville, KY
    (36.0726,   -79.7920),   # Greensboro, NC
    (30.3322,   -81.6557),   # Jacksonville, FL
    (38.8951,   -77.0364),   # Washington, DC
    (43.6591,   -70.2568),   # Portland, ME (New England coverage)
    (35.4676,   -97.5164),   # Oklahoma City, OK
    (35.1495,   -90.0490),   # Memphis, TN
    (30.6954,   -88.0399),   # Mobile, AL (Gulf coverage)
    (43.0389,   -76.1422),   # Buffalo / Syracuse corridor
    (46.8772,  -113.9962),   # Missoula, MT (Mountain West)
    (43.6150,  -116.2023),   # Boise, ID
    (36.1540,  -115.1537),   # Las Vegas, NV
    (44.0805,   -92.4637),   # Rochester, MN
]

# State → best representative metro coordinates (for state-specific mode)
_STATE_COORDS: dict[str, tuple[float, float]] = {
    "AK": (61.2181, -149.9003),  # Anchorage
    "AL": (33.5207,  -86.8025),  # Birmingham
    "AR": (34.7465,  -92.2896),  # Little Rock
    "AZ": (33.4484, -112.0740),  # Phoenix
    "CA": (34.0522, -118.2437),  # Los Angeles
    "CO": (39.7392, -104.9903),  # Denver
    "CT": (41.7658,  -72.6851),  # Hartford
    "DC": (38.8951,  -77.0364),  # Washington DC
    "DE": (39.7447,  -75.5484),  # Wilmington
    "FL": (25.7617,  -80.1918),  # Miami
    "GA": (33.7490,  -84.3880),  # Atlanta
    "HI": (21.3069, -157.8583),  # Honolulu
    "IA": (41.5868,  -93.6250),  # Des Moines
    "ID": (43.6150, -116.2023),  # Boise
    "IL": (41.8781,  -87.6298),  # Chicago
    "IN": (39.7684,  -86.1581),  # Indianapolis
    "KS": (37.6872,  -97.3301),  # Wichita
    "KY": (38.2527,  -85.7585),  # Louisville
    "LA": (29.9511,  -90.0715),  # New Orleans
    "MA": (42.3601,  -71.0589),  # Boston
    "MD": (39.2904,  -76.6122),  # Baltimore
    "ME": (43.6591,  -70.2568),  # Portland
    "MI": (42.3314,  -83.0458),  # Detroit
    "MN": (44.9778,  -93.2650),  # Minneapolis
    "MO": (38.6270,  -90.1994),  # St. Louis
    "MS": (32.2988,  -90.1848),  # Jackson
    "MT": (46.8772, -113.9962),  # Missoula
    "NC": (35.2271,  -80.8431),  # Charlotte
    "ND": (46.8772, -100.7896),  # Bismarck
    "NE": (41.2565,  -95.9345),  # Omaha
    "NH": (42.9956,  -71.4548),  # Manchester
    "NJ": (40.7282,  -74.0776),  # Newark
    "NM": (35.0844, -106.6504),  # Albuquerque
    "NV": (36.1540, -115.1537),  # Las Vegas
    "NY": (40.7128,  -74.0060),  # New York City
    "OH": (39.9612,  -82.9988),  # Columbus
    "OK": (35.4676,  -97.5164),  # Oklahoma City
    "OR": (45.5051, -122.6750),  # Portland
    "PA": (39.9526,  -75.1652),  # Philadelphia
    "RI": (41.8240,  -71.4128),  # Providence
    "SC": (32.7765,  -79.9311),  # Charleston
    "SD": (44.0805,  -98.4902),  # Aberdeen
    "TN": (36.1627,  -86.7816),  # Nashville
    "TX": (29.7604,  -95.3698),  # Houston
    "UT": (40.7608, -111.8910),  # Salt Lake City
    "VA": (37.5407,  -77.4360),  # Richmond
    "VT": (44.4759,  -73.2121),  # Burlington
    "WA": (47.6062, -122.3321),  # Seattle
    "WI": (43.0389,  -88.0399),  # Milwaukee
    "WV": (38.3498,  -81.6326),  # Charleston WV
    "WY": (41.1400, -104.8202),  # Cheyenne
}


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
        if not state:
            # National mode: hit every metro coordinate for maximum coverage
            pages_to_try = [
                f"https://maxsold.com/?lat={lat}&lng={lng}&radius=150000"
                for lat, lng in _US_METRO_COORDS
            ]
        else:
            # State-specific mode: use the state's representative coordinates
            state_upper = state.upper()
            coords = _STATE_COORDS.get(state_upper)
            if coords:
                lat, lng = coords
                pages_to_try = [
                    f"https://maxsold.com/?lat={lat}&lng={lng}&radius=200000"
                ]
            else:
                self.logger.warning(
                    f"MaxSold: no coordinate mapping for state '{state}'; "
                    f"falling back to national mode"
                )
                pages_to_try = [
                    f"https://maxsold.com/?lat={lat}&lng={lng}&radius=150000"
                    for lat, lng in _US_METRO_COORDS
                ]

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

                # Build auction_id → lots mapping — try multiple __NEXT_DATA__ shapes
                lots_by_auction: dict[str, list] = {}
                raw_lots = (
                    pp.get("listings", {}).get("listings")       # original shape
                    or pp.get("lots", {}).get("data")            # v2 shape
                    or pp.get("pageData", {}).get("lots", {}).get("data")
                    or pp.get("auctionLots")
                    or []
                )
                for lot in raw_lots:
                    aid = str(lot.get("amAuctionId", "") or lot.get("auctionId", ""))
                    if aid:
                        lots_by_auction.setdefault(aid, []).append(lot)

                # Yield one listing per unique auction — multiple __NEXT_DATA__ shapes
                raw_sales = (
                    pp.get("sales", {}).get("data")              # original shape
                    or pp.get("auctions", {}).get("data")        # v2 shape
                    or pp.get("pageData", {}).get("sales", {}).get("data")
                    or pp.get("saleData")
                    or []
                )
                for sale in raw_sales:
                    sale_id = str(sale.get("amAuctionId") or sale.get("id") or "")
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

    def _sale_to_listing(self, sale, lots=None):
        """Convert a MaxSold sale (auction) to a ScrapedListing.

        ``lots`` is an optional list of individual lot dicts from the same
        __NEXT_DATA__ payload.  Each lot is converted to a ScrapedItem and
        stored in listing.items so the frontend can display a browsable grid.
        """
        try:
            auction_id = str(sale.get("amAuctionId") or sale.get("id") or "")
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
                listing_type="auction",
                category=sale.get("saleCategory"),
                pickup_only=True,
                ships_nationally=sale.get("hasShipping", False),
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
                    raw_paths = lot.get("imagePaths") or []
                    # Prefix relative paths with the CDN/base URL
                    lot_images = [
                        p if p.startswith("http") else f"https://maxsold.com{p}"
                        for p in raw_paths
                        if p
                    ]
                    # currentBid may be 0 (falsy but valid) — don't use `or {}`
                    bid_info = lot.get("currentBid")
                    if not isinstance(bid_info, dict):
                        bid_info = {}
                    price_raw = bid_info.get("amount")
                    lot_title = lot.get("title") or lot.get("name") or ""
                    if not lot_title:
                        continue
                    item = ScrapedItem(
                        title=lot_title,
                        lot_number=str(lot.get("amLotId") or lot.get("id") or "") or None,
                        description=lot.get("description"),
                        current_price=self._parse_price(price_raw),
                        estimate_low=self._parse_price(lot.get("estimateLow")),
                        estimate_high=self._parse_price(lot.get("estimateHigh")),
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

    # _parse_price, _parse_dt, _parse_iso inherited from BaseScraper

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
