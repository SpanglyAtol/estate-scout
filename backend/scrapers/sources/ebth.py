"""
EBTH (Everything But The House) scraper.

EBTH is an online estate sale platform that sells individual items (not auction
catalogs). Each listing is a single item with photos, description, and bidding.

API strategy:
  1. Primary: JSON search API at /api/products/search (React SPA data layer)
     - Returns paginated item objects with full metadata
     - Requires browser-like headers to bypass Cloudflare
  2. Fallback: HTML category pages with embedded JSON-LD or window.__INITIAL_STATE__

Item URL pattern:  https://www.ebth.com/items/{id}
Category pages:    https://www.ebth.com/categories/antiques-collectibles?page=N
"""

import json
import re
from typing import AsyncIterator

from bs4 import BeautifulSoup

from scrapers.base import BaseScraper, ScrapedItem, ScrapedListing


# Estate sale / antique categories available on EBTH
_EBTH_CATEGORIES = [
    "antiques-collectibles",
    "art",
    "jewelry-watches",
    "furniture",
    "home-decor",
    "silver-gold",
    "books-ephemera",
    "coins-currency",
    "clothing-accessories",
    "music-entertainment",
    "toys-games",
    "kitchen-dining",
    "tools-sporting-goods",
]

EBTH_BASE = "https://www.ebth.com"
EBTH_SEARCH_API = "https://www.ebth.com/api/products/search"


class EbthScraper(BaseScraper):
    """
    Scraper for EBTH.com — individual estate sale items with bidding.

    EBTH sells single items (not auction lots), making it ideal for
    price comp data. Items have estimate ranges and final hammer prices.
    """

    platform_slug = "ebth"
    base_url = EBTH_BASE
    default_rate_limit = 0.4  # Cloudflare — be conservative

    async def scrape_listings(
        self,
        categories: list[str] | None = None,
        max_pages: int = 5,
        **kwargs,
    ) -> AsyncIterator[ScrapedListing]:
        """
        Yield individual item listings from EBTH.

        Args:
            categories: List of EBTH category slugs to scrape.
                        Defaults to top antique/estate categories.
            max_pages:  Pages per category (default 5; each page ≈ 48 items).
        """
        cats = categories or _EBTH_CATEGORIES  # all estate/antique categories

        seen_ids: set[str] = set()

        for category in cats:
            for page in range(1, max_pages + 1):
                try:
                    listings = await self._fetch_category_page(category, page)
                    if not listings:
                        break
                    for item in listings:
                        item_id = str(item.get("id") or item.get("slug") or "")
                        if not item_id or item_id in seen_ids:
                            continue
                        seen_ids.add(item_id)
                        scraped = self._item_to_listing(item, category)
                        if scraped:
                            yield scraped
                except Exception as exc:
                    self.logger.warning(f"EBTH {category} page {page}: {exc}")
                    break

    async def _fetch_category_page(self, category: str, page: int) -> list[dict]:
        """Try JSON API endpoints first, fall back to HTML scraping."""
        # Attempt 1: JSON search API (try multiple endpoint patterns)
        api_endpoints = [
            (EBTH_SEARCH_API, {"category": category, "page": page, "per_page": 48, "status": "active", "sort": "ending_soon"}),
            (f"{EBTH_BASE}/api/v2/products", {"category": category, "page": page, "per_page": 48}),
            (f"{EBTH_BASE}/api/items", {"category_slug": category, "page": page, "limit": 48}),
        ]
        for api_url, params in api_endpoints:
            try:
                response = await self._fetch(
                    api_url,
                    params=params,
                    headers={
                        **self._browser_headers(referer=f"{EBTH_BASE}/categories/{category}"),
                        "Accept": "application/json",
                        "X-Requested-With": "XMLHttpRequest",
                    },
                )
                if response.status_code == 200:
                    data = response.json()
                    items = (
                        data.get("products")
                        or data.get("items")
                        or data.get("data")
                        or data.get("results")
                        or []
                    )
                    if items:
                        self.logger.info(f"EBTH API {api_url} {category} p{page}: {len(items)} items")
                        return items
            except Exception as exc:
                self.logger.debug(f"EBTH API {api_url} failed ({exc})")

        # Attempt 2: HTML category page with embedded JSON
        self.logger.debug(f"EBTH JSON API failed for {category} p{page}, trying HTML fallback")
        try:
            url = f"{EBTH_BASE}/categories/{category}?page={page}"
            response = await self._fetch(
                url,
                headers=self._browser_headers(referer=EBTH_BASE + "/"),
            )
            return self._parse_html_category(response.text)
        except Exception as exc:
            self.logger.debug(f"EBTH HTML fallback failed: {exc}")
            return []

    def _parse_html_category(self, html: str) -> list[dict]:
        """Extract items from EBTH HTML category page (JSON-LD or embedded JSON)."""
        items: list[dict] = []

        # Try __NEXT_DATA__ (Next.js SSR — EBTH's actual framework)
        nd_match = re.search(
            r'<script[^>]+id=["\']__NEXT_DATA__["\'][^>]*>(.*?)</script>',
            html,
            re.DOTALL,
        )
        if nd_match:
            try:
                nd = json.loads(nd_match.group(1))
                pp = nd.get("props", {}).get("pageProps", {})
                for path in [
                    ["products"],
                    ["items"],
                    ["listings"],
                    ["catalog", "products"],
                    ["initialData", "products"],
                    ["categoryPage", "products"],
                    ["searchResults", "items"],
                    ["data", "products"],
                    ["data", "items"],
                ]:
                    node = pp
                    for key in path:
                        node = node.get(key, {}) if isinstance(node, dict) else {}
                    if isinstance(node, list) and node:
                        return node
                # Also check top-level nd (some builds put data outside pageProps)
                for path in [["props", "items"], ["props", "products"]]:
                    node = nd
                    for key in path:
                        node = node.get(key, {}) if isinstance(node, dict) else {}
                    if isinstance(node, list) and node:
                        return node
            except (json.JSONDecodeError, AttributeError):
                pass

        # Try window.__INITIAL_STATE__ or similar embedded JSON
        match = re.search(
            r'window\.__(?:INITIAL_STATE|APP_STATE)__\s*=\s*({.*?});',
            html,
            re.DOTALL,
        )
        if match:
            try:
                state = json.loads(match.group(1))
                # Path varies by React version — try common paths
                for path in [
                    ["products", "items"],
                    ["items", "data"],
                    ["catalog", "products"],
                ]:
                    node = state
                    for key in path:
                        node = node.get(key, {}) if isinstance(node, dict) else {}
                    if isinstance(node, list) and node:
                        return node
            except (json.JSONDecodeError, AttributeError):
                pass

        # Try JSON-LD structured data
        soup = BeautifulSoup(html, "lxml")
        for script in soup.find_all("script", type="application/ld+json"):
            try:
                data = json.loads(script.string or "")
                if isinstance(data, list):
                    data = data[0]
                if data.get("@type") in ("Product", "Offer", "ItemList"):
                    items.append(data)
            except (json.JSONDecodeError, AttributeError):
                pass

        if items:
            return items

        # Last resort: scrape individual product cards from HTML
        for card in soup.select(".product-card, .item-card, [data-item-id]"):
            try:
                item_id = card.get("data-item-id") or card.get("data-product-id", "")
                title_el = card.select_one("h2, h3, .item-title, .product-title")
                price_el = card.select_one(".price, .current-bid, [class*=price]")
                img_el = card.select_one("img")
                link_el = card.select_one("a[href]")
                if title_el and item_id:
                    items.append({
                        "id": item_id,
                        "title": title_el.get_text(strip=True),
                        "current_price": self._parse_price(price_el.get_text() if price_el else ""),
                        "primary_image": img_el.get("src") or img_el.get("data-src") if img_el else None,
                        "url": link_el.get("href") if link_el else None,
                    })
            except Exception:
                pass

        return items

    def _item_to_listing(self, item: dict, category_hint: str = "") -> ScrapedListing | None:
        """Convert an EBTH item dict to a ScrapedListing."""
        try:
            item_id = str(item.get("id") or item.get("slug") or item.get("identifier", ""))
            if not item_id:
                return None

            title = (
                item.get("title")
                or item.get("name")
                or item.get("@name")
                or ""
            ).strip()
            if not title:
                return None

            # URL
            url_path = item.get("url") or item.get("path") or item.get("slug") or ""
            if url_path and not url_path.startswith("http"):
                external_url = f"{EBTH_BASE}{url_path}" if url_path.startswith("/") else f"{EBTH_BASE}/items/{url_path}"
            elif url_path:
                external_url = url_path
            else:
                external_url = f"{EBTH_BASE}/items/{item_id}"

            # Images
            images: list[str] = []
            for key in ("images", "photos", "image_urls", "media"):
                raw = item.get(key, [])
                if isinstance(raw, list):
                    for img in raw:
                        if isinstance(img, str):
                            images.append(img)
                        elif isinstance(img, dict):
                            src = img.get("url") or img.get("src") or img.get("large") or img.get("medium") or ""
                            if src:
                                images.append(src)
            # Single image fallbacks
            for key in ("primary_image", "thumbnail", "image", "photo"):
                val = item.get(key)
                if isinstance(val, str) and val and val not in images:
                    images.insert(0, val)
                elif isinstance(val, dict):
                    src = val.get("url") or val.get("large") or val.get("original") or ""
                    if src and src not in images:
                        images.insert(0, src)

            # Pricing — EBTH has estimate + current bid + final hammer
            # Use _parse_price directly on raw values to avoid `or ""` eating 0
            current_bid = self._parse_price(
                item.get("current_bid") if item.get("current_bid") is not None
                else item.get("currentBid")
            )
            hammer_price = self._parse_price(
                item.get("hammer_price") if item.get("hammer_price") is not None
                else item.get("final_price")
            )
            est_low = self._parse_price(
                item.get("estimate_low") if item.get("estimate_low") is not None
                else item.get("low_estimate")
            )
            est_high = self._parse_price(
                item.get("estimate_high") if item.get("estimate_high") is not None
                else item.get("high_estimate")
            )

            is_completed = bool(item.get("ended") or item.get("sold") or item.get("status") == "ended")

            # Location — EBTH shows the sale location
            location = item.get("location") or item.get("sale_location") or {}
            if isinstance(location, str):
                city_str = location
                state_str = ""
            else:
                city_str = location.get("city", "")
                state_str = location.get("state", "")

            # Dates
            end_at = self._parse_dt(
                item.get("end_time") or item.get("endTime") or item.get("ends_at")
            )
            start_at = self._parse_dt(
                item.get("start_time") or item.get("startTime") or item.get("starts_at")
            )

            # Category — prefer item's own category field
            cat = (
                item.get("category")
                or item.get("categories", [None])[0] if isinstance(item.get("categories"), list) else None
                or category_hint
            )
            if isinstance(cat, dict):
                cat = cat.get("name") or cat.get("slug") or category_hint

            return ScrapedListing(
                platform_slug=self.platform_slug,
                external_id=item_id,
                external_url=external_url,
                title=title,
                description=item.get("description") or item.get("details"),
                category=cat,
                condition=item.get("condition"),
                current_price=current_bid,
                final_price=hammer_price,
                estimate_low=est_low,
                estimate_high=est_high,
                is_completed=is_completed,
                auction_status="ended" if is_completed else "live",
                listing_type="estate_sale",
                pickup_only=bool(item.get("pickup_only") or item.get("local_pickup_only")),
                ships_nationally=bool(item.get("shipping_available", True)),
                city=city_str or None,
                state=state_str or None,
                sale_starts_at=start_at,
                sale_ends_at=end_at,
                primary_image_url=images[0] if images else None,
                image_urls=images,
                raw_data=item,
            )
        except Exception as exc:
            self.logger.debug(f"EBTH item parse error: {exc}")
            return None

    async def scrape_listing_detail(self, external_id: str) -> ScrapedListing | None:
        """Fetch a single EBTH item page for enriched detail."""
        url = f"{EBTH_BASE}/items/{external_id}"
        try:
            response = await self._fetch(
                url,
                headers=self._browser_headers(referer=EBTH_BASE + "/"),
            )
            soup = BeautifulSoup(response.text, "lxml")

            # Try JSON-LD first
            ld_tag = soup.find("script", type="application/ld+json")
            if ld_tag:
                try:
                    data = json.loads(ld_tag.string or "")
                    if isinstance(data, list):
                        data = data[0]
                    return self._item_to_listing(data)
                except (json.JSONDecodeError, AttributeError):
                    pass

            # Fallback: parse HTML directly
            title_el = soup.select_one("h1.item-title, h1.product-title, h1")
            title = title_el.get_text(strip=True) if title_el else ""
            if not title:
                return None

            desc_el = soup.select_one(".item-description, .product-description, [class*=description]")
            desc = desc_el.get_text(strip=True) if desc_el else None

            images = [
                img["src"]
                for img in soup.select(".item-image img, .product-image img, [class*=gallery] img")
                if img.get("src")
            ]

            return ScrapedListing(
                platform_slug=self.platform_slug,
                external_id=external_id,
                external_url=url,
                title=title,
                description=desc,
                primary_image_url=images[0] if images else None,
                image_urls=images,
                raw_data={"url": url},
            )
        except Exception as exc:
            self.logger.error(f"EBTH detail error for {external_id}: {exc}")
            return None

    # _parse_price, _parse_dt, _parse_iso inherited from BaseScraper
