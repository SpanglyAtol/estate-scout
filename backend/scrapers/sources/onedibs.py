"""
1stDibs Scraper — premium antiques & vintage marketplace.

Strategy
--------
1stDibs is a Next.js SPA.  Their search pages embed a ``__NEXT_DATA__``
JSON block in the HTML <head> that contains the full listing payload for
the first page of results — no JavaScript execution required.

Search URL pattern:
  https://www.1stdibs.com/search/?q=antique+furniture&page=1&sort=recency

Each item in the JSON has:
  - id, title, description, category
  - price (askingPrice.amount / currency)
  - seller location (city, state/country)
  - primaryImage.url
  - pdpUrl (product detail page)

Because 1stDibs caters to dealers, prices are "buy now" asking prices
from vetted dealers — high-quality price reference data.

Rate limit: 1 req/4s — they serve Cloudflare but allow crawling at low
speeds.  Paid dealer accounts exist; we only touch the public search.
"""

import json
import re
from typing import AsyncIterator

from bs4 import BeautifulSoup

from scrapers.base import BaseScraper, ScrapedListing

# Topics that map well to antique estate searches
SEARCH_QUERIES = [
    "antique furniture",
    "vintage ceramics",
    "antique silver",
    "vintage jewelry",
    "antique clocks",
    "vintage art deco",
]


class OneDibsScraper(BaseScraper):
    """
    Scraper for 1stDibs.com — premium antiques & vintage marketplace.

    Yields 'buy_now' listings with asking prices from vetted dealers.
    Useful for establishing high-end market comps for the AI valuation engine.
    """

    platform_slug = "1stdibs"
    base_url = "https://www.1stdibs.com"
    default_rate_limit = 0.25   # 1 request per 4 seconds — polite for Cloudflare

    SEARCH_URL = "https://www.1stdibs.com/search/"

    async def scrape_listings(
        self,
        query: str = "",
        **kwargs,
    ) -> AsyncIterator[ScrapedListing]:
        """
        Yield 1stDibs product listings.

        With no query, iterates over SEARCH_QUERIES for broad coverage.
        Pass a specific query to narrow results.
        """
        max_pages = kwargs.get("max_pages", 3)

        queries = [query] if query else SEARCH_QUERIES

        for q in queries:
            self.logger.info(f"1stDibs: scraping '{q}'")
            async for listing in self._scrape_query(q, max_pages):
                yield listing

    async def _scrape_query(self, query: str, max_pages: int) -> AsyncIterator[ScrapedListing]:
        seen: set[str] = set()

        for page in range(1, max_pages + 1):
            params = {
                "q":    query,
                "page": str(page),
                "sort": "recency",
            }
            try:
                response = await self._fetch(
                    self.SEARCH_URL,
                    params=params,
                    headers=self._browser_headers(referer="https://www.1stdibs.com/"),
                )

                items = self._extract_items(response.text)
                if not items:
                    self.logger.info(f"1stDibs [{query}]: no items at page {page}")
                    break

                for item in items:
                    listing = self._normalize(item)
                    if listing and listing.external_id not in seen:
                        seen.add(listing.external_id)
                        yield listing

            except Exception as exc:
                self.logger.error(f"1stDibs error (query={query}, page={page}): {exc}")
                break

    # ── data extraction ───────────────────────────────────────────────────────

    def _extract_items(self, html: str) -> list[dict]:
        """Try __NEXT_DATA__ JSON first, then fall back to HTML cards."""
        # 1. __NEXT_DATA__ (preferred — structured)
        match = re.search(
            r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.DOTALL
        )
        if match:
            try:
                data = json.loads(match.group(1))
                props = data.get("props", {}).get("pageProps", {})
                # Path varies by Next.js build; try common locations
                results = (
                    props.get("searchResults", {}).get("items")
                    or props.get("results", {}).get("items")
                    or props.get("items")
                    or props.get("initialData", {}).get("searchResults", {}).get("items")
                    or []
                )
                if results:
                    return results
            except (json.JSONDecodeError, AttributeError):
                pass

        # 2. HTML fallback — structured data in ld+json blocks
        items: list[dict] = []
        soup = BeautifulSoup(html, "lxml")
        for script in soup.find_all("script", type="application/ld+json"):
            try:
                obj = json.loads(script.string or "")
                if isinstance(obj, list):
                    items.extend(obj)
                elif isinstance(obj, dict):
                    items.append(obj)
            except (json.JSONDecodeError, TypeError):
                continue

        if items:
            return items

        # 3. HTML card parsing as last resort
        cards = soup.select("[data-tn='search-result-container'], .search-result-item, article")
        return [{"_html_card": str(card)} for card in cards] if cards else []

    def _normalize(self, item: dict) -> ScrapedListing | None:
        """Convert a raw 1stDibs item dict to ScrapedListing."""
        try:
            # Handle ld+json Product schema
            if item.get("@type") in ("Product", "Offer"):
                return self._from_json_ld(item)

            # Handle raw HTML card (best-effort)
            if "_html_card" in item:
                return self._from_html_card(item["_html_card"])

            # Handle 1stDibs internal search result schema
            item_id = str(
                item.get("id")
                or item.get("productId")
                or item.get("itemId")
                or ""
            )
            if not item_id:
                return None

            title = (
                item.get("title")
                or item.get("name")
                or item.get("productTitle")
                or ""
            )

            # Price — can be nested or flat
            price: float | None = None
            price_data = item.get("price") or item.get("askingPrice") or {}
            if isinstance(price_data, dict):
                raw_price = price_data.get("amount") or price_data.get("value")
                price = self._parse_price(raw_price)
            elif isinstance(price_data, (int, float, str)):
                price = self._parse_price(price_data)

            # Images
            img_url: str | None = None
            img = item.get("primaryImage") or item.get("image") or {}
            if isinstance(img, dict):
                img_url = img.get("url") or img.get("src")
            elif isinstance(img, str):
                img_url = img
            elif isinstance(img, list) and img:
                img_url = img[0].get("url") if isinstance(img[0], dict) else img[0]

            # Location
            seller = item.get("seller") or item.get("dealer") or {}
            location = seller.get("location") or {}
            city  = location.get("city")  or item.get("city")
            state = location.get("state") or item.get("state")

            # URL
            pdp_url = item.get("pdpUrl") or item.get("url") or item.get("productUrl") or ""
            if pdp_url and not pdp_url.startswith("http"):
                pdp_url = self.base_url + pdp_url

            category = (
                item.get("category")
                or item.get("categoryPath", [""])[0]
                if isinstance(item.get("categoryPath"), list)
                else item.get("category")
            )

            return ScrapedListing(
                platform_slug=self.platform_slug,
                external_id=item_id,
                external_url=pdp_url or f"{self.base_url}/furniture/antique/",
                title=title,
                description=item.get("description"),
                category=str(category) if category else None,
                current_price=price,
                buy_now_price=price,
                listing_type="buy_now",
                city=city,
                state=state,
                primary_image_url=img_url,
                ships_nationally=True,
                raw_data=item,
            )
        except Exception as exc:
            self.logger.debug(f"1stDibs normalize error: {exc}")
            return None

    def _from_json_ld(self, item: dict) -> ScrapedListing | None:
        """Parse a JSON-LD Product/Offer schema object."""
        try:
            name = item.get("name", "")
            if not name:
                return None
            url = item.get("url", "")
            item_id = re.search(r"/(\d+)[^/]*$", url)
            external_id = item_id.group(1) if item_id else re.sub(r"\W", "", name)[:20]

            offer = item.get("offers") or {}
            if isinstance(offer, list):
                offer = offer[0] if offer else {}
            price = self._parse_price(offer.get("price") or offer.get("lowPrice"))

            images = item.get("image", [])
            img_url = images[0] if isinstance(images, list) and images else (
                images if isinstance(images, str) else None
            )

            return ScrapedListing(
                platform_slug=self.platform_slug,
                external_id=external_id,
                external_url=url,
                title=name,
                description=item.get("description"),
                current_price=price,
                buy_now_price=price,
                listing_type="buy_now",
                primary_image_url=img_url,
                ships_nationally=True,
                raw_data=item,
            )
        except Exception:
            return None

    def _from_html_card(self, html: str) -> ScrapedListing | None:
        """Best-effort parse from an HTML card string."""
        try:
            soup = BeautifulSoup(html, "lxml")
            link = soup.find("a", href=True)
            if not link:
                return None
            href = link["href"]
            if not href.startswith("http"):
                href = self.base_url + href

            id_match = re.search(r"/(\d{6,12})", href)
            item_id = id_match.group(1) if id_match else href[-12:]

            title_el = soup.find(["h2", "h3", "h4"]) or soup.find(class_=re.compile(r"title", re.I))
            title = title_el.get_text(strip=True) if title_el else "Unknown"

            price_el = soup.find(text=re.compile(r"\$[\d,]+"))
            price = self._parse_price(str(price_el)) if price_el else None

            img = soup.find("img")
            img_url = img.get("src") if img else None

            return ScrapedListing(
                platform_slug=self.platform_slug,
                external_id=item_id,
                external_url=href,
                title=title,
                current_price=price,
                buy_now_price=price,
                listing_type="buy_now",
                primary_image_url=img_url,
                ships_nationally=True,
            )
        except Exception:
            return None

    # _parse_price, _parse_dt, _parse_iso inherited from BaseScraper

    async def scrape_listing_detail(self, external_id: str) -> ScrapedListing | None:
        return None
