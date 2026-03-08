"""
Invaluable scraper — one of the largest fine art & antiques auction aggregators.

Invaluable aggregates auctions from thousands of auction houses worldwide.
The site runs on ColdFusion; their partner API is restricted. We use a
multi-layer HTML + sitemap strategy similar to LiveAuctioneers.

Strategy:
  Layer 1: JSON search API at /api/search/lots (React SPA data endpoint)
           Filters: category, status=upcoming|live, country=US
  Layer 2: HTML category browse pages — parse product cards from server HTML
  Layer 3: XML sitemap index for auction listing URLs

Auction URLs:  https://www.invaluable.com/catalog/{slug}/
Lot URLs:      https://www.invaluable.com/catalog/{slug}/lot/{lot-number}/
"""

import json
import re
import xml.etree.ElementTree as ET
from datetime import datetime
from typing import AsyncIterator

from bs4 import BeautifulSoup

from scrapers.base import BaseScraper, ScrapedItem, ScrapedListing


INVALUABLE_BASE = "https://www.invaluable.com"
# Key category slugs from Invaluable's browse menu
_INVALUABLE_CATEGORIES = [
    "antiques",
    "decorative-art",
    "fine-art",
    "jewelry-watches",
    "silver-objects-of-vertu",
    "furniture",
    "asian-art-antiques",
    "books-manuscripts",
    "ceramics-glass",
    "clocks-scientific",
    "coins-currency",
    "rugs-carpets",
    "silver",
]


class InvaluableScraper(BaseScraper):
    """
    Scraper for Invaluable.com auction listings.

    Uses a 3-layer fallback:
      1. JSON search API (preferred — structured data)
      2. HTML browse pages (fallback — parse React-rendered cards)
      3. XML sitemap (last resort — gets auction URLs then detail-fetches)
    """

    platform_slug = "invaluable"
    base_url = INVALUABLE_BASE
    default_rate_limit = 0.3  # Invaluable has aggressive bot detection

    async def scrape_listings(
        self,
        categories: list[str] | None = None,
        max_pages: int = 5,
        **kwargs,
    ) -> AsyncIterator[ScrapedListing]:
        """
        Yield auction listings from Invaluable.

        Args:
            categories: Invaluable category slugs to scrape.
            max_pages:  Pages per category (default 5; ≈40 results/page).
        """
        cats = categories or _INVALUABLE_CATEGORIES[:5]
        seen_ids: set[str] = set()

        for category in cats:
            self.logger.info(f"Invaluable: scraping category '{category}'")
            found_any = False

            # Layer 1: JSON API
            for page in range(1, max_pages + 1):
                try:
                    items = await self._fetch_json_api(category, page)
                    if not items:
                        break
                    found_any = True
                    for item in items:
                        item_id = self._extract_id(item)
                        if not item_id or item_id in seen_ids:
                            continue
                        seen_ids.add(item_id)
                        listing = self._normalize_api_item(item)
                        if listing:
                            yield listing
                except Exception as exc:
                    self.logger.debug(f"Invaluable JSON API {category} p{page}: {exc}")
                    break

            if found_any:
                continue

            # Layer 2: HTML category pages
            self.logger.info(f"Invaluable: falling back to HTML for '{category}'")
            for page in range(1, max_pages + 1):
                try:
                    items = await self._fetch_html_page(category, page)
                    if not items:
                        break
                    for item in items:
                        item_id = self._extract_id(item)
                        if not item_id or item_id in seen_ids:
                            continue
                        seen_ids.add(item_id)
                        listing = self._normalize_api_item(item)
                        if listing:
                            yield listing
                except Exception as exc:
                    self.logger.debug(f"Invaluable HTML {category} p{page}: {exc}")
                    break

        # Layer 3: Sitemap fallback (only if both layers produced nothing)
        if not seen_ids:
            self.logger.info("Invaluable: falling back to sitemap")
            async for listing in self._scrape_via_sitemap(max_pages=max_pages):
                if listing.external_id not in seen_ids:
                    seen_ids.add(listing.external_id)
                    yield listing

    # ── Layer 1: JSON API ─────────────────────────────────────────────────────

    async def _fetch_json_api(self, category: str, page: int) -> list[dict]:
        """Call Invaluable's internal search API."""
        params = {
            "query": "",
            "categories": category,
            "upcoming": "true",
            "supportsShipping": "false",
            "page": page,
            "size": 40,
            "sort": "auctionStartDate:asc",
            "countryCode": "US",
        }
        headers = {
            **self._browser_headers(referer=f"{INVALUABLE_BASE}/c/{category}/"),
            "Accept": "application/json",
            "X-Requested-With": "XMLHttpRequest",
        }
        # Try several known API endpoint patterns
        for api_path in ("/api/lots/search", "/api/search/lots", "/api/v2/lots"):
            try:
                response = await self._fetch(
                    f"{INVALUABLE_BASE}{api_path}",
                    params=params,
                    headers=headers,
                )
                data = response.json()
                hits = (
                    data.get("hits", {}).get("hits")
                    or data.get("results")
                    or data.get("data")
                    or data.get("lots")
                    or []
                )
                if hits:
                    self.logger.info(f"Invaluable API {api_path} {category} p{page}: {len(hits)} items")
                    return hits
            except Exception:
                continue
        return []

    # ── Layer 2: HTML browse pages ────────────────────────────────────────────

    async def _fetch_html_page(self, category: str, page: int) -> list[dict]:
        """Parse Invaluable HTML category/browse page."""
        url = f"{INVALUABLE_BASE}/c/{category}/?page={page}"
        try:
            response = await self._fetch(
                url,
                headers=self._browser_headers(referer=INVALUABLE_BASE + "/"),
            )
        except Exception:
            # Try alternate URL pattern
            url = f"{INVALUABLE_BASE}/search/{category}/?page={page}"
            response = await self._fetch(
                url,
                headers=self._browser_headers(referer=INVALUABLE_BASE + "/"),
            )

        html = response.text
        items: list[dict] = []

        # Check for embedded React/Next state
        for pattern in (
            r'window\.__INITIAL_STATE__\s*=\s*({.*?});\s*</script>',
            r'window\.__APP_STATE__\s*=\s*({.*?});\s*</script>',
            r'"lots"\s*:\s*(\[.*?\])\s*[,}]',
        ):
            match = re.search(pattern, html, re.DOTALL)
            if match:
                try:
                    raw = json.loads(match.group(1))
                    if isinstance(raw, list):
                        return raw
                    # Walk known paths in state objects
                    for path in [["lots"], ["search", "lots"], ["catalog", "lots"]]:
                        node = raw
                        for key in path:
                            node = node.get(key, {}) if isinstance(node, dict) else {}
                        if isinstance(node, list) and node:
                            return node
                except (json.JSONDecodeError, AttributeError):
                    pass

        # Parse product cards from server-rendered HTML
        soup = BeautifulSoup(html, "lxml")
        for card in soup.select(
            "[class*=lot-card], [class*=lotCard], [class*=auction-lot], "
            "[data-lot-ref], [data-lot-id], .lot-list-item"
        ):
            try:
                lot_id = (
                    card.get("data-lot-ref")
                    or card.get("data-lot-id")
                    or card.get("data-id")
                    or ""
                )
                title_el = card.select_one("h2, h3, [class*=title], [class*=name]")
                price_el = card.select_one("[class*=price], [class*=estimate], [class*=bid]")
                img_el = card.select_one("img")
                link_el = card.select_one("a[href]")
                auctioneer_el = card.select_one("[class*=auctioneer], [class*=house]")

                if title_el:
                    href = link_el.get("href", "") if link_el else ""
                    items.append({
                        "id": lot_id or href,
                        "title": title_el.get_text(strip=True),
                        "estimate": price_el.get_text(strip=True) if price_el else "",
                        "thumbnail": img_el.get("src") or img_el.get("data-src", "") if img_el else "",
                        "url": href,
                        "auctioneer": auctioneer_el.get_text(strip=True) if auctioneer_el else "",
                        "category": category,
                    })
            except Exception:
                pass

        if items:
            self.logger.info(f"Invaluable HTML {category} p{page}: {len(items)} cards")
        return items

    # ── Layer 3: Sitemap fallback ─────────────────────────────────────────────

    async def _scrape_via_sitemap(self, max_pages: int = 3) -> AsyncIterator[ScrapedListing]:
        """Walk the XML sitemap to discover auction catalog URLs."""
        sitemap_index = f"{INVALUABLE_BASE}/sitemap_index.xml"
        try:
            resp = await self._fetch(
                sitemap_index,
                headers=self._browser_headers(referer=INVALUABLE_BASE + "/"),
            )
            root = ET.fromstring(resp.text)
            ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}

            # Filter sitemap files that look like auction catalogs
            catalog_sitemaps = [
                elem.text.strip()
                for elem in root.findall(".//sm:loc", ns)
                if "catalog" in (elem.text or "").lower()
            ][:max_pages]

            for sitemap_url in catalog_sitemaps:
                try:
                    resp2 = await self._fetch(
                        sitemap_url,
                        headers=self._browser_headers(referer=INVALUABLE_BASE + "/"),
                    )
                    sub_root = ET.fromstring(resp2.text)
                    urls = [
                        elem.text.strip()
                        for elem in sub_root.findall(".//sm:loc", ns)
                        if elem.text
                    ][:20]  # Sample first 20 from each sitemap

                    for page_url in urls:
                        listing = await self.scrape_listing_detail_from_url(page_url)
                        if listing:
                            yield listing
                except Exception as exc:
                    self.logger.debug(f"Invaluable sitemap {sitemap_url}: {exc}")
        except Exception as exc:
            self.logger.warning(f"Invaluable sitemap index failed: {exc}")

    # ── Normalization ─────────────────────────────────────────────────────────

    def _extract_id(self, item: dict) -> str:
        """Extract a stable unique ID from an item dict."""
        for key in ("refNum", "ref", "lotRef", "id", "lotId", "catalogRef"):
            val = item.get(key)
            if val:
                return str(val)
        # Fall back to URL slug
        url = item.get("url") or item.get("lotUrl") or item.get("href") or ""
        if url:
            slug = url.rstrip("/").split("/")[-1]
            return slug or url
        return ""

    def _normalize_api_item(self, item: dict) -> ScrapedListing | None:
        """Convert an Invaluable API or HTML-parsed item to ScrapedListing."""
        try:
            item_id = self._extract_id(item)
            if not item_id:
                return None

            # Title
            title = (
                item.get("title")
                or item.get("lotTitle")
                or item.get("name")
                or item.get("description")
                or ""
            ).strip()
            if not title:
                return None

            # URL
            url_raw = item.get("url") or item.get("lotUrl") or item.get("href") or ""
            if url_raw and not url_raw.startswith("http"):
                external_url = INVALUABLE_BASE + url_raw
            elif url_raw:
                external_url = url_raw
            else:
                # Reconstruct from catalog slug if available
                catalog = item.get("catalogRef") or item.get("auctionRef") or ""
                lot_num = item.get("lotNum") or item.get("lotNumber") or item_id
                external_url = (
                    f"{INVALUABLE_BASE}/catalog/{catalog}/lot/{lot_num}/"
                    if catalog
                    else f"{INVALUABLE_BASE}/lot/{item_id}/"
                )

            # Images
            images: list[str] = []
            for key in ("images", "photos", "thumbnails"):
                raw = item.get(key, [])
                if isinstance(raw, list):
                    for img in raw:
                        src = img if isinstance(img, str) else (img.get("url") or img.get("src") or "")
                        if src and src not in images:
                            images.append(src)
            for key in ("thumbnail", "image", "photo", "primaryImage"):
                val = item.get(key)
                if isinstance(val, str) and val:
                    images.insert(0, val)
                elif isinstance(val, dict):
                    src = val.get("url") or val.get("src") or ""
                    if src:
                        images.insert(0, src)

            # Pricing — Invaluable has low/high estimates + hammer price
            est_str = item.get("estimate") or item.get("priceRealised") or ""
            est_low, est_high = self._parse_estimate(str(est_str))
            hammer = self._parse_price(
                str(item.get("hammerPrice") or item.get("priceRealised") or item.get("hammer_price") or "")
            )
            current = self._parse_price(
                str(item.get("currentBid") or item.get("current_bid") or "")
            )

            # Buyer's premium
            premium_pct = None
            bp_raw = item.get("buyersPremium") or item.get("buyers_premium")
            if bp_raw:
                m = re.search(r"(\d+(?:\.\d+)?)", str(bp_raw))
                if m:
                    premium_pct = float(m.group(1))

            # Status
            status_raw = (item.get("status") or item.get("auctionStatus") or "").lower()
            is_completed = status_raw in ("ended", "completed", "past", "closed")

            # Dates
            end_at = self._parse_dt(
                item.get("endTime") or item.get("bidCloseDateTime") or item.get("endDate")
            )
            start_at = self._parse_dt(
                item.get("startTime") or item.get("bidOpenDateTime") or item.get("startDate")
            )

            # Location
            auctioneer = item.get("auctioneer") or item.get("auctionHouse") or {}
            if isinstance(auctioneer, str):
                city_str = ""
                state_str = ""
            else:
                city_str = auctioneer.get("city") or auctioneer.get("location", "").split(",")[0].strip()
                state_str = auctioneer.get("state") or (
                    auctioneer.get("location", "").split(",")[-1].strip()
                    if "," in auctioneer.get("location", "")
                    else ""
                )

            cat = item.get("category") or item.get("categoryName") or ""
            if isinstance(cat, list):
                cat = cat[0] if cat else ""

            # Build lot items if available (Invaluable sometimes nests lots)
            sub_items: list[ScrapedItem] = []
            for lot in item.get("lots", []):
                try:
                    lot_title = lot.get("title") or lot.get("lotTitle") or ""
                    if lot_title:
                        lot_imgs = []
                        for img in lot.get("images", []):
                            src = img if isinstance(img, str) else img.get("url", "")
                            if src:
                                lot_imgs.append(src)
                        sub_items.append(ScrapedItem(
                            title=lot_title,
                            lot_number=str(lot.get("lotNum") or lot.get("lotNumber") or ""),
                            description=lot.get("description"),
                            current_price=self._parse_price(str(lot.get("currentBid") or "")),
                            estimate_low=self._parse_price(str(lot.get("estimateLow") or "")),
                            estimate_high=self._parse_price(str(lot.get("estimateHigh") or "")),
                            primary_image_url=lot_imgs[0] if lot_imgs else None,
                            image_urls=lot_imgs,
                        ))
                except Exception:
                    pass

            listing = ScrapedListing(
                platform_slug=self.platform_slug,
                external_id=item_id,
                external_url=external_url,
                title=title,
                description=item.get("description") or item.get("longDescription"),
                category=cat or None,
                current_price=current,
                final_price=hammer,
                estimate_low=est_low,
                estimate_high=est_high,
                buyers_premium_pct=premium_pct,
                is_completed=is_completed,
                auction_status="ended" if is_completed else "upcoming",
                listing_type="auction",
                ships_nationally=bool(item.get("supportsShipping", True)),
                city=city_str or None,
                state=state_str or None,
                sale_starts_at=start_at,
                sale_ends_at=end_at,
                primary_image_url=images[0] if images else None,
                image_urls=images,
                items=sub_items,
                raw_data=item,
            )
            return listing
        except Exception as exc:
            self.logger.debug(f"Invaluable normalize error: {exc}")
            return None

    async def scrape_listing_detail_from_url(self, url: str) -> ScrapedListing | None:
        """Fetch and parse an individual Invaluable catalog/lot page."""
        try:
            response = await self._fetch(
                url,
                headers=self._browser_headers(referer=INVALUABLE_BASE + "/"),
            )
            html = response.text

            # Try JSON-LD first
            soup = BeautifulSoup(html, "lxml")
            for tag in soup.find_all("script", type="application/ld+json"):
                try:
                    data = json.loads(tag.string or "")
                    if isinstance(data, list):
                        data = data[0]
                    if data.get("@type") in ("Product", "Offer", "AuctionEvent"):
                        item = self._normalize_api_item(data)
                        if item:
                            item.external_url = url
                            return item
                except (json.JSONDecodeError, AttributeError):
                    pass

            # Parse HTML directly
            title_el = soup.select_one("h1.lot-title, h1.auction-title, h1")
            if not title_el:
                return None

            slug = url.rstrip("/").split("/")[-1]
            return ScrapedListing(
                platform_slug=self.platform_slug,
                external_id=slug,
                external_url=url,
                title=title_el.get_text(strip=True),
                raw_data={"url": url},
            )
        except Exception as exc:
            self.logger.debug(f"Invaluable detail parse error for {url}: {exc}")
            return None

    async def scrape_listing_detail(self, external_id: str) -> ScrapedListing | None:
        url = f"{INVALUABLE_BASE}/lot/{external_id}/"
        return await self.scrape_listing_detail_from_url(url)

    # ── Helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def _parse_price(value: str) -> float | None:
        if not value or value.strip() in ("", "N/A", "-", "—"):
            return None
        cleaned = re.sub(r"[^\d.]", "", value)
        try:
            return float(cleaned) if cleaned else None
        except ValueError:
            return None

    @classmethod
    def _parse_estimate(cls, raw: str) -> tuple[float | None, float | None]:
        """Parse estimate strings like '$500 - $800' or '500/800' → (500, 800)."""
        if not raw:
            return None, None
        # Replace any separator between two numbers
        nums = re.findall(r"[\d,]+(?:\.\d+)?", raw.replace(",", ""))
        if len(nums) >= 2:
            try:
                return float(nums[0]), float(nums[1])
            except ValueError:
                pass
        elif len(nums) == 1:
            val = cls._parse_price(nums[0])
            return val, val
        return None, None

    @staticmethod
    def _parse_dt(value) -> datetime | None:
        if not value:
            return None
        for fmt in (
            "%Y-%m-%dT%H:%M:%SZ",
            "%Y-%m-%dT%H:%M:%S.%fZ",
            "%Y-%m-%dT%H:%M:%S%z",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d",
        ):
            try:
                return datetime.strptime(str(value), fmt)
            except ValueError:
                continue
        return None
