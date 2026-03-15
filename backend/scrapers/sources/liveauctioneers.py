"""
LiveAuctioneers Scraper

Strategy (two-layer approach to beat 403 blocks)
-------------------------------------------------
LiveAuctioneers uses Cloudflare WAF + bot-fingerprinting, so plain httpx
requests get 403.  We use two progressively more lenient methods:

1. **Public JSON API** — LiveAuctioneers exposes a search API at
   /c/search that the React SPA calls.  We hit it with full browser
   headers including ``Origin``, ``Referer``, and ``X-Requested-With``.
   This often works in CI because Cloudflare trusts JSON API requests
   that originate from their own domain.

2. **HTML search page** — Falls back to hitting the HTML search page and
   extracting __NEXT_DATA__ or parsing lot cards directly.

   NOTE: Google Cache (webcache.googleusercontent.com) was shut down in
   early 2024 and is no longer used as a fallback.

3. **Sitemap** (last resort) — LiveAuctioneers publishes a sitemap for
   upcoming auctions.  We only use this if both JSON API and HTML fail,
   and only to discover auction IDs — we skip sitemap entries that lack
   enough data to be useful (no price, no date, no location).

If all layers fail, we log a warning and yield nothing rather than crashing
the whole hydrate run.
"""

import json
import re
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
    # 3. Sitemap index (last resort — IDs + URLs only, no price/date data)
    _SITEMAP  = "https://www.liveauctioneers.com/sitemap-auctions.xml"
    _SITEMAP_FALLBACKS = (
        "https://www.liveauctioneers.com/sitemap-auctions.xml",
        "https://www.liveauctioneers.com/sitemap.xml",
    )

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
                if isinstance(lot, dict):
                    listing = self._normalize_item(lot)
                    if listing:
                        yield listing

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

            try:
                resp = await self._fetch(
                    self._SRCH_URL,
                    params=params,
                    headers=self._browser_headers(referer="https://www.liveauctioneers.com/"),
                )
            except Exception as exc:
                raise PermissionError(f"LiveAuctioneers HTML fetch failed: {exc}")

            if resp.status_code == 403:
                raise PermissionError("LiveAuctioneers HTML blocked (403)")

            html = resp.text
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
                    if isinstance(item, dict):
                        listing = self._normalize_item(item)
                        if listing:
                            yield listing

    # ── Layer 3: Sitemap ──────────────────────────────────────────────────────

    async def _scrape_sitemap(self) -> AsyncIterator[ScrapedListing]:
        """
        Parse the auctions sitemap to discover auction IDs when API/HTML are blocked.

        Sitemap entries only contain a URL — no price, date, or location.  We
        attempt a detail-page fetch for each entry so we get real data.  Entries
        that fail the detail fetch are skipped rather than stored as empty shells.
        """
        try:
            url_candidates = await self._collect_sitemap_listing_urls()
            if not url_candidates:
                return

            seen: set[str] = set()
            for url in url_candidates[:200]:
                id_match = re.search(r"/sale/(\d+)", url)
                if not id_match:
                    id_match = re.search(r"/(\d{5,10})/?$", url)
                if not id_match:
                    continue
                auction_id = id_match.group(1)
                if auction_id in seen:
                    continue
                seen.add(auction_id)

                # Attempt to hydrate with real data from the detail page
                detail = await self.scrape_listing_detail(auction_id)
                if detail:
                    yield detail
                # If detail fetch fails, skip — don't store an empty shell

        except Exception as exc:
            self.logger.error(f"LA sitemap parse error: {exc}")

    async def _collect_sitemap_listing_urls(self) -> list[str]:
        """Return auction/detail URLs from the root sitemap or child sitemap indexes."""
        headers = self._browser_headers(referer=self.base_url + "/")
        all_urls: list[str] = []
        queued: list[str] = list(self._SITEMAP_FALLBACKS)
        visited: set[str] = set()

        while queued and len(visited) < 10:
            sitemap_url = queued.pop(0)
            if sitemap_url in visited:
                continue
            visited.add(sitemap_url)

            try:
                resp = await self._fetch(sitemap_url, headers=headers)
            except Exception as exc:
                self.logger.debug(f"LA sitemap fetch error ({sitemap_url}): {exc}")
                continue

            if resp.status_code != 200:
                self.logger.debug(
                    f"LA sitemap unavailable ({sitemap_url}): HTTP {resp.status_code}"
                )
                continue

            try:
                root = ET.fromstring(resp.text)
            except Exception as exc:
                self.logger.debug(f"LA sitemap XML parse error ({sitemap_url}): {exc}")
                continue

            urls, child_sitemaps = self._parse_sitemap_xml(root)
            all_urls.extend(urls)
            for child in child_sitemaps:
                if child not in visited:
                    queued.append(child)

            if all_urls:
                break

        return all_urls

    def _parse_sitemap_xml(self, root: ET.Element) -> tuple[list[str], list[str]]:
        """Parse either `<urlset>` or `<sitemapindex>` XML into URLs and child sitemap links."""
        ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}

        listing_urls = [
            (el.text or "").strip()
            for el in root.findall(".//sm:url/sm:loc", ns)
            if (el.text or "").strip()
        ]
        child_sitemaps = [
            (el.text or "").strip()
            for el in root.findall(".//sm:sitemap/sm:loc", ns)
            if (el.text or "").strip()
        ]

        # Fallback when namespace declarations are absent.
        if not listing_urls:
            listing_urls = [
                (el.text or "").strip()
                for el in root.findall(".//{*}url/{*}loc")
                if (el.text or "").strip()
            ]
        if not child_sitemaps:
            child_sitemaps = [
                (el.text or "").strip()
                for el in root.findall(".//{*}sitemap/{*}loc")
                if (el.text or "").strip()
            ]

        return listing_urls, child_sitemaps

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

    def _normalize_item(self, item: dict) -> ScrapedListing | None:
        lot_id    = str(item.get("lotId", item.get("id", item.get("_id", ""))))
        auction_id = str(item.get("auctionId", item.get("saleId", "")))
        if not lot_id:
            return None
        # Prefix with auction_id to prevent lot-number collisions across auctions
        external_id = f"{auction_id}_{lot_id}" if auction_id else lot_id

        title_raw = item.get("title", item.get("lotTitle", item.get("description", ""))) or ""
        slug      = re.sub(r"[^a-z0-9]+", "-", title_raw.lower()).strip("-")[:60]

        # Prefer full imageUrl over thumbnail when available
        full_image = item.get("imageUrl") or item.get("thumbnailUrl") or ""
        image_urls = item.get("imageUrls", [])
        if full_image and full_image not in image_urls:
            image_urls = [full_image] + image_urls

        # Map API status field to our auction_status vocabulary
        raw_status = (item.get("status") or item.get("auctionStatus") or "").lower()
        if raw_status in ("live", "in_progress", "inprogress"):
            auction_status = "live"
        elif raw_status in ("ended", "completed", "closed", "past"):
            auction_status = "ended"
        elif raw_status in ("upcoming", "preview", "scheduled"):
            auction_status = "upcoming"
        else:
            auction_status = "upcoming"

        return ScrapedListing(
            platform_slug=self.platform_slug,
            external_id=external_id,
            external_url=f"{self.base_url}/item/{lot_id}-{slug}",
            title=title_raw,
            description=item.get("description", item.get("longDescription", "")),
            category=item.get("categoryName", item.get("category", "")),
            listing_type="auction",
            auction_status=auction_status,
            is_completed=auction_status == "ended",
            current_price=self._parse_price(
                item.get("currentBid", item.get("currentBidAmount", item.get("startingBid")))
            ),
            estimate_low=self._parse_price(item.get("lowEstimate", item.get("estimate_low"))),
            estimate_high=self._parse_price(item.get("highEstimate", item.get("estimate_high"))),
            buyers_premium_pct=self._parse_price(
                item.get("buyersPremium", item.get("buyersPremiumPercentage"))
            ),
            city=item.get("city",       item.get("saleCity",  "")),
            state=item.get("stateCode", item.get("saleState", item.get("state", ""))),
            sale_ends_at=self._parse_dt(
                item.get("dateTimeEnds",  item.get("endDate",   item.get("endsAt")))
            ),
            sale_starts_at=self._parse_dt(
                item.get("dateTimeStart", item.get("startDate", item.get("startsAt")))
            ),
            primary_image_url=full_image or None,
            image_urls=image_urls,
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
        # external_id may be "auctionId_lotId" or just a numeric auction/lot id
        # LiveAuctioneers auction pages: /auc/{id}  — lot pages: /item/{id}-{slug}
        bare_id = external_id.split("_")[-1]
        # Try auction catalog page first (more data), then individual item page
        for url_template in (
            f"{self.base_url}/auc/{bare_id}/",
            f"{self.base_url}/item/{bare_id}",
        ):
            try:
                response = await self._fetch(
                    url_template,
                    headers=self._browser_headers(referer=self.base_url + "/"),
                )
                soup = BeautifulSoup(response.text, "lxml")

                # Try __NEXT_DATA__ first (most complete)
                items = self._extract_json_data(response.text)
                if items:
                    return self._normalize_item(items[0])

                # Fall back to JSON-LD
                json_ld = soup.find("script", type="application/ld+json")
                if json_ld and json_ld.string:
                    try:
                        data = json.loads(json_ld.string)
                        if isinstance(data, list):
                            data = data[0]
                        offers = data.get("offers") or {}
                        if isinstance(offers, list):
                            offers = offers[0] if offers else {}
                        images = data.get("image", [])
                        primary_img = (
                            images[0] if isinstance(images, list) and images
                            else images if isinstance(images, str)
                            else None
                        )
                        return ScrapedListing(
                            platform_slug=self.platform_slug,
                            external_id=external_id,
                            external_url=url_template,
                            title=data.get("name", ""),
                            description=data.get("description", ""),
                            listing_type="auction",
                            current_price=self._parse_price(offers.get("price")),
                            primary_image_url=primary_img,
                            raw_data=data,
                        )
                    except Exception:
                        pass
            except Exception as exc:
                self.logger.debug(f"LA detail fetch error ({url_template}): {exc}")
                continue
        return None

    # _parse_price, _parse_dt, _parse_iso inherited from BaseScraper
