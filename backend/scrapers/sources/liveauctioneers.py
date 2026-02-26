import re
from datetime import datetime
from typing import AsyncIterator

from bs4 import BeautifulSoup

from scrapers.base import BaseScraper, ScrapedListing


class LiveAuctioneersScraper(BaseScraper):
    """
    Scraper for LiveAuctioneers.com

    Strategy:
    1. Try the JSON search API first (faster, structured data)
    2. Fall back to HTML parsing if JSON is unavailable
    3. Respect rate limits (0.3 req/s - they have anti-bot detection)

    To find the current API endpoint: Open LiveAuctioneers in browser,
    open DevTools → Network → filter XHR, run a search, look for
    requests to /search-api/ or similar JSON endpoints.
    """

    platform_slug = "liveauctioneers"
    base_url = "https://www.liveauctioneers.com"
    default_rate_limit = 0.3  # slower for anti-bot protection

    # NOTE: These URLs may change - inspect network traffic to update
    SEARCH_URL = "https://www.liveauctioneers.com/search/"

    async def scrape_listings(
        self,
        query: str = "",
        state: str = "",
        radius_miles: int = 100,
        **kwargs,
    ) -> AsyncIterator[ScrapedListing]:
        """Scrape search results, yielding normalized listings."""
        page = 1
        max_pages = kwargs.get("max_pages", 20)

        while page <= max_pages:
            params = {
                "keyword": query,
                "page": page,
                "pageSize": 48,
                "status": "live",
            }
            if state:
                params["state"] = state

            try:
                response = await self._fetch(
                    self.SEARCH_URL,
                    params=params,
                    headers=self._browser_headers(referer="https://www.liveauctioneers.com/"),
                )

                # Try to extract embedded JSON data first (faster than HTML parsing)
                listings_from_json = self._extract_json_data(response.text)
                if listings_from_json is not None:
                    if not listings_from_json:
                        break  # No more results
                    for item in listings_from_json:
                        yield self._normalize_item(item)
                    page += 1
                    continue

                # Fallback: HTML parsing
                soup = BeautifulSoup(response.text, "lxml")
                cards = soup.select(
                    "[data-testid='lot-card'], .lot-card, article[class*='lot'], "
                    "div[class*='LotCard'], div[class*='lot-card']"
                )
                if not cards:
                    self.logger.info(f"No more listings found at page {page}")
                    break

                for card in cards:
                    listing = self._parse_html_card(card)
                    if listing:
                        yield listing

                page += 1

            except Exception as e:
                self.logger.error(f"Error scraping page {page}: {e}")
                break

    def _extract_json_data(self, html: str) -> list[dict] | None:
        """
        Many modern sites embed data in __NEXT_DATA__ or window.__data__.
        Returns None if no JSON found (triggers HTML fallback).
        """
        import json

        # Try Next.js data injection
        match = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.DOTALL)
        if match:
            try:
                data = json.loads(match.group(1))
                # Navigate to the listings array - path varies by site version
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
        """Convert a raw API/JSON item to ScrapedListing."""
        lot_id = str(item.get("lotId", item.get("id", item.get("_id", ""))))
        title_raw = item.get("title", item.get("lotTitle", item.get("description", ""))) or ""
        slug = re.sub(r"[^a-z0-9]+", "-", title_raw.lower()).strip("-")[:60]
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
            city=item.get("city", item.get("saleCity", "")),
            state=item.get("stateCode", item.get("saleState", item.get("state", ""))),
            sale_ends_at=self._parse_datetime(
                item.get("dateTimeEnds", item.get("endDate", item.get("endsAt")))
            ),
            sale_starts_at=self._parse_datetime(
                item.get("dateTimeStart", item.get("startDate", item.get("startsAt")))
            ),
            primary_image_url=item.get("thumbnailUrl", item.get("imageUrl", "")),
            image_urls=item.get("imageUrls", []),
            raw_data=item,
        )

    def _parse_html_card(self, card) -> ScrapedListing | None:
        """Parse a single HTML listing card."""
        try:
            # Try to find a link to get the external_id
            link = card.find("a", href=True)
            if not link:
                return None
            href = link["href"]
            # LiveAuctioneers URLs look like /item/12345-item-title
            id_match = re.search(r"/item/(\d+)", href)
            if not id_match:
                return None
            lot_id = id_match.group(1)

            title_el = card.find(["h2", "h3", "[class*='title']"])
            title = title_el.get_text(strip=True) if title_el else "Unknown"

            price_el = card.find(text=re.compile(r"\$[\d,]+"))
            price = self._parse_price(price_el) if price_el else None

            img = card.find("img")
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
        except Exception as e:
            self.logger.debug(f"Failed to parse card: {e}")
            return None

    async def scrape_listing_detail(self, external_id: str) -> ScrapedListing | None:
        """Fetch full detail for a single listing."""
        url = f"{self.base_url}/item/{external_id}-"
        try:
            response = await self._fetch(url)
            soup = BeautifulSoup(response.text, "lxml")

            # Try JSON-LD structured data first
            json_ld = soup.find("script", type="application/ld+json")
            if json_ld:
                import json
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
                        primary_image_url=data.get("image", [None])[0]
                        if isinstance(data.get("image"), list)
                        else data.get("image"),
                        raw_data=data,
                    )
                except Exception:
                    pass

            return None
        except Exception as e:
            self.logger.error(f"Failed to fetch detail {external_id}: {e}")
            return None

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
