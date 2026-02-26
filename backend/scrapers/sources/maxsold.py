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

from scrapers.base import BaseScraper, ScrapedListing


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
        We try the main homepage and also pass lat/lng coords for WA if
        a state filter is requested.
        """
        pages_to_try = [self.HOME_URL]

        # Seattle-area coordinates as a fallback search anchor
        if state.upper() in ("WA", ""):
            pages_to_try.append(
                "https://maxsold.com/?lat=47.6062&lng=-122.3321&radius=150000"
            )

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

                # Build a map from saleEntityId to sale metadata for date/location
                sales_by_id = {}
                for sale in pp.get("sales", {}).get("data", []):
                    eid = sale.get("saleEntityId", "")
                    if eid:
                        sales_by_id[eid] = sale

                # Yield individual lots
                lots = pp.get("listings", {}).get("listings", [])
                for lot in lots:
                    lot_id = str(lot.get("amLotId", ""))
                    if not lot_id or lot_id in seen_ids:
                        continue
                    seen_ids.add(lot_id)

                    sale = sales_by_id.get(lot.get("saleEntityId", ""), {})
                    listing = self._lot_to_listing(lot, sale)
                    if listing:
                        yield listing

                # Also yield sale-level listings for any auction not yet covered
                for sale in pp.get("sales", {}).get("data", []):
                    sale_id = str(sale.get("amAuctionId", ""))
                    key = f"sale_{sale_id}"
                    if not sale_id or key in seen_ids:
                        continue
                    seen_ids.add(key)
                    listing = self._sale_to_listing(sale)
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

    def _sale_to_listing(self, sale):
        """Convert a MaxSold sale (auction) to a ScrapedListing."""
        try:
            auction_id = str(sale.get("amAuctionId", ""))
            if not auction_id:
                return None

            images = sale.get("images", [])
            primary_img = images[0] if images else None

            addr = sale.get("address", {})
            state = addr.get("regionCode", "").upper()

            return ScrapedListing(
                platform_slug=self.platform_slug,
                external_id=f"sale_{auction_id}",
                external_url=f"{self.base_url}/auction/{auction_id}",
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
