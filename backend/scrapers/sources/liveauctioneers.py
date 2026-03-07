"""
LiveAuctioneers Scraper

Strategy (three-layer approach to beat 403 blocks)
---------------------------------------------------
LiveAuctioneers uses Cloudflare WAF + bot-fingerprinting, so plain httpx
requests get 403.  We use three progressively more lenient methods:

1. **Public JSON API** — LiveAuctioneers exposes a search API at
   /c/search that the React SPA calls.  We hit it with full browser
   headers including ``Origin``, ``Referer``, and ``X-Requested-With``.
   This often works in CI because Cloudflare trusts JSON API requests
   that originate from their own domain.

2. **Google Cache** — Request the cached version of the search page via
   ``https://webcache.googleusercontent.com/search?q=cache:<url>``.
   Google's cache bypasses the site's WAF entirely and usually contains
   the __NEXT_DATA__ block.

3. **Sitemap / RSS** — LiveAuctioneers publishes a sitemap and RSS feeds
   for upcoming auctions.  These are always accessible and give us IDs
   + titles we can enrich later.

If all three fail, we log a warning and yield nothing rather than crashing
the whole hydrate run.
"""

import json
import re
from datetime import datetime
from typing import AsyncIterator
from xml.etree import ElementTree as ET

from bs4 import BeautifulSoup

from scrapers.base import BaseScraper, ScrapedListing


class LiveAuctioneersScraper(BaseScraper):
    platform_slug = "liveauctioneers"
    base_url = "https://www.liveauctioneers.com"
    default_rate_limit = 0.25   # 4 s between requests — cautious

    # 1. React SPA's internal search endpoint (JSON)
    _API_URL  = "https://www.liveauctioneers.com/c/search"
    # 2. HTML search page (fallback)
    _SRCH_URL = "https://www.liveauctioneers.com/search/"
    # 3. Sitemap index (last resort)
    _SITEMAP  = "https://www.liveauctioneers.com/sitemap-auctions.xml"
    # Google cache prefix
    _GCACHE   = "https://webcache.googleusercontent.com/search?q=cache:"

    # ── Full Chrome-107+ headers ──────────────────────────────────────────────
    def _la_api_headers(self) -> dict:
        return {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            "Origin": "https://www.liveauctioneers.com",
            "Referer": "https://www.liveauctioneers.com/search/",
            "X-Requested-With": "XMLHttpRequest",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
            "Sec-Ch-Ua": '"Chromium";v="124","Google Chrome";v="124","Not-A.Brand";v="99"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
            "Connection": "keep-alive",
        }

    async def scrape_listings(
        self,
        query: str = "",
        state: str = "",
        **kwargs,
    ) -> AsyncIterator[ScrapedListing]:
        max_pages = kwargs.get("max_pages", 10)

        # Layer 1: JSON API
        yielded = False
        try:
            async for listing in self._scrape_json_api(query, state, max_pages):
                yielded = True
                yield listing
        except Exception as exc:
            self.logger.warning(f"LA JSON API failed: {exc}")

        if yielded:
            return

        # Layer 2: HTML search page (with Google Cache fallback)
        try:
            async for listing in self._scrape_html(query, state, max_pages):
                yielded = True
                yield listing
        except Exception as exc:
            self.logger.warning(f"LA HTML scrape failed: {exc}")

        if yielded:
            return

        # Layer 3: Sitemap (always accessible)
        self.logger.info("LA: falling back to sitemap")
        try:
            async for listing in self._scrape_sitemap():
                yield listing
        except Exception as exc:
            self.logger.error(f"LA sitemap failed: {exc}")

    # ── Layer 1: JSON API ─────────────────────────────────────────────────────

    async def _scrape_json_api(
        self, query: str, state: str, max_pages: int
    ) -> AsyncIterator[ScrapedListing]:
        for page in range(1, max_pages + 1):
            params: dict = {
                "keyword":  query,
                "page":     page,
                "pageSize": 48,
                "status":   "upcoming|live",
            }
            if state:
                params["state"] = state

            resp = await self._fetch(
                self._API_URL, params=params, headers=self._la_api_headers()
            )

            if resp.status_code == 403:
                raise PermissionError("LiveAuctioneers API returned 403")

            try:
                data = resp.json()
            except Exception:
                raise ValueError("LiveAuctioneers API returned non-JSON")

            lots = (
                data.get("lots")
                or data.get("results", {}).get("lots")
                or data.get("data", {}).get("lots")
                or []
            )
            if not lots:
                break
            for lot in lots:
                yield self._normalize_item(lot)

    # ── Layer 2: HTML + __NEXT_DATA__ ─────────────────────────────────────────

    async def _scrape_html(
        self, query: str, state: str, max_pages: int
    ) -> AsyncIterator[ScrapedListing]:
        for page in range(1, max_pages + 1):
            params: dict = {
                "keyword":  query,
                "page":     page,
                "pageSize": 48,
                "status":   "live",
            }
            if state:
                params["state"] = state

            # Try direct first, then Google Cache
            html = None
            for url_fn in [
                lambda p: (self._SRCH_URL, p),
                lambda p: (self._GCACHE + self._SRCH_URL, p),
            ]:
                url, p = url_fn(params)
                try:
                    resp = await self._fetch(
                        url,
                        params=p,
                        headers=self._browser_headers(referer="https://www.liveauctioneers.com/"),
                    )
                    if resp.status_code != 403:
                        html = resp.text
                        break
                except Exception:
                    continue

            if not html:
                raise PermissionError("LiveAuctioneers HTML blocked (403)")

            items = self._extract_json_data(html)
            if items is None:
                soup = BeautifulSoup(html, "lxml")
                cards = soup.select(
                    "[data-testid='lot-card'], .lot-card, article[class*='lot'], "
                    "div[class*='LotCard'], div[class*='lot-card']"
                )
                if not cards:
                    break
                for card in cards:
                    listing = self._parse_html_card(card)
                    if listing:
                        yield listing
            else:
                if not items:
                    break
                for item in items:
                    yield self._normalize_item(item)

    # ── Layer 3: Sitemap ──────────────────────────────────────────────────────

    async def _scrape_sitemap(self) -> AsyncIterator[ScrapedListing]:
        """
        Parse the auctions sitemap and yield lightweight listings (title + URL).
        These won't have price/date info but give us IDs for later enrichment.
        """
        try:
            resp = await self._fetch(
                self._SITEMAP,
                headers=self._browser_headers(referer=self.base_url + "/"),
            )
            root = ET.fromstring(resp.text)
            ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
            urls = root.findall(".//sm:url/sm:loc", ns)
            if not urls:
                # Namespace-free fallback
                urls = root.findall(".//{*}loc")

            for loc_el in urls[:200]:   # cap at 200 from sitemap
                url = loc_el.text or ""
                # URLs look like /auc/AUCTIONEER-NAME/SLUG/sale/12345/
                id_match = re.search(r"/sale/(\d+)", url)
                if not id_match:
                    id_match = re.search(r"/(\d{5,10})/?$", url)
                if not id_match:
                    continue
                auction_id = id_match.group(1)
                slug_part  = url.rstrip("/").split("/")[-2] if not id_match else ""
                title = re.sub(r"[-_]", " ", slug_part).title() or f"Auction #{auction_id}"

                yield ScrapedListing(
                    platform_slug=self.platform_slug,
                    external_id=auction_id,
                    external_url=url if url.startswith("http") else self.base_url + url,
                    title=title,
                    listing_type="auction",
                    raw_data={"source": "sitemap"},
                )
        except Exception as exc:
            self.logger.error(f"LA sitemap parse error: {exc}")

    # ── normalisers ───────────────────────────────────────────────────────────

    def _extract_json_data(self, html: str) -> list[dict] | None:
        match = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.DOTALL)
        if match:
            try:
                data  = json.loads(match.group(1))
                props = data.get("props", {}).get("pageProps", {})
                items = (
                    props.get("lots")
                    or props.get("items")
                    or props.get("results", {}).get("lots")
                    or props.get("data", {}).get("lots")
                    or props.get("searchResults", {}).get("lots")
                    or props.get("catalog", {}).get("lots")
                    or []
                )
                return items if isinstance(items, list) else None
            except (json.JSONDecodeError, KeyError):
                pass
        return None

    def _normalize_item(self, item: dict) -> ScrapedListing:
        lot_id    = str(item.get("lotId", item.get("id", item.get("_id", ""))))
        title_raw = item.get("title", item.get("lotTitle", item.get("description", ""))) or ""
        slug      = re.sub(r"[^a-z0-9]+", "-", title_raw.lower()).strip("-")[:60]
        return ScrapedListing(
            platform_slug=self.platform_slug,
            external_id=lot_id,
            external_url=f"{self.base_url}/item/{lot_id}-{slug}",
            title=title_raw,
            description=item.get("description", item.get("longDescription", "")),
            category=item.get("categoryName", item.get("category", "")),
            current_price=self._parse_price(
                item.get("currentBid", item.get("currentBidAmount", item.get("startingBid")))
            ),
            buyers_premium_pct=item.get("buyersPremium", item.get("buyersPremiumPercentage")),
            city=item.get("city",      item.get("saleCity",  "")),
            state=item.get("stateCode", item.get("saleState", item.get("state", ""))),
            sale_ends_at=self._parse_datetime(
                item.get("dateTimeEnds",  item.get("endDate",   item.get("endsAt")))
            ),
            sale_starts_at=self._parse_datetime(
                item.get("dateTimeStart", item.get("startDate", item.get("startsAt")))
            ),
            primary_image_url=item.get("thumbnailUrl", item.get("imageUrl", "")),
            image_urls=item.get("imageUrls", []),
            raw_data=item,
        )

    def _parse_html_card(self, card) -> ScrapedListing | None:
        try:
            link = card.find("a", href=True)
            if not link:
                return None
            href    = link["href"]
            id_match = re.search(r"/item/(\d+)", href)
            if not id_match:
                return None
            lot_id = id_match.group(1)

            title_el = card.find(["h2", "h3", "[class*='title']"])
            title    = title_el.get_text(strip=True) if title_el else "Unknown"

            price_el = card.find(text=re.compile(r"\$[\d,]+"))
            price    = self._parse_price(price_el) if price_el else None

            img     = card.find("img")
            img_url = img.get("src", img.get("data-src", "")) if img else None

            return ScrapedListing(
                platform_slug=self.platform_slug,
                external_id=lot_id,
                external_url=f"{self.base_url}{href}",
                title=title,
                current_price=price,
                primary_image_url=img_url,
                raw_data={"html_parsed": True},
            )
        except Exception as exc:
            self.logger.debug(f"LA HTML card parse error: {exc}")
            return None

    async def scrape_listing_detail(self, external_id: str) -> ScrapedListing | None:
        url = f"{self.base_url}/item/{external_id}-"
        try:
            response = await self._fetch(url)
            soup     = BeautifulSoup(response.text, "lxml")
            json_ld  = soup.find("script", type="application/ld+json")
            if json_ld:
                try:
                    data = json.loads(json_ld.string)
                    if isinstance(data, list):
                        data = data[0]
                    return ScrapedListing(
                        platform_slug=self.platform_slug,
                        external_id=external_id,
                        external_url=url,
                        title=data.get("name", ""),
                        description=data.get("description", ""),
                        current_price=self._parse_price(
                            data.get("offers", {}).get("price")
                        ),
                        primary_image_url=(
                            data.get("image", [None])[0]
                            if isinstance(data.get("image"), list)
                            else data.get("image")
                        ),
                        raw_data=data,
                    )
                except Exception:
                    pass
            return None
        except Exception as exc:
            self.logger.error(f"LA detail fetch error ({external_id}): {exc}")
            return None

    # ── static helpers ────────────────────────────────────────────────────────

    @staticmethod
    def _parse_price(value) -> float | None:
        if value is None:
            return None
        if isinstance(value, (int, float)):
            return float(value)
        cleaned = re.sub(r"[^\d.]", "", str(value))
        try:
            return float(cleaned) if cleaned else None
        except ValueError:
            return None

    @staticmethod
    def _parse_datetime(value) -> datetime | None:
        if not value:
            return None
        formats = [
            "%Y-%m-%dT%H:%M:%SZ",
            "%Y-%m-%dT%H:%M:%S.%fZ",
            "%Y-%m-%dT%H:%M:%S%z",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d",
        ]
        for fmt in formats:
            try:
                return datetime.strptime(str(value), fmt)
            except ValueError:
                continue
        return None
