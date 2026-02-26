import json
import re
from datetime import datetime
from typing import AsyncIterator

from bs4 import BeautifulSoup

from scrapers.base import BaseScraper, ScrapedListing


class HibidScraper(BaseScraper):
    """
    Scraper for HiBid.com - regional online auction platform.

    Strategy:
    1. Try __NEXT_DATA__ JSON extraction from search results page
    2. Fall back to HTML card parsing
    3. Use slow rate limit (HiBid has Cloudflare protection)

    HiBid lot URLs:  https://hibid.com/lot/LOTID/title-slug/
    Search URL:      https://hibid.com/catalog-search/?q=QUERY&state=WA
    """

    platform_slug = "hibid"
    base_url = "https://hibid.com"
    default_rate_limit = 0.4

    SEARCH_URL = "https://hibid.com/catalog-search/"

    async def scrape_listings(
        self,
        query: str = "",
        state: str = "",
        radius_miles: int = 100,
        **kwargs,
    ) -> AsyncIterator[ScrapedListing]:
        page = 1
        max_pages = kwargs.get("max_pages", 15)

        while page <= max_pages:
            params: dict = {"page": page, "pageSize": 48}
            if query:
                params["q"] = query
            if state:
                params["state"] = state

            try:
                response = await self._fetch(
                    self.SEARCH_URL,
                    params=params,
                    headers=self._browser_headers(referer="https://hibid.com/"),
                )

                # Try __NEXT_DATA__ JSON extraction first
                json_items = self._extract_next_data(response.text)
                if json_items is not None:
                    if not json_items:
                        break
                    for item in json_items:
                        yield self._normalize_json_item(item)
                    page += 1
                    continue

                # HTML parsing fallback
                soup = BeautifulSoup(response.text, "lxml")
                cards = soup.select(
                    ".lot-card, [data-testid='lot'], [class*='LotCard'], "
                    "article[class*='lot'], div[class*='lot-item'], "
                    ".catalog-item, [class*='catalog-lot']"
                )
                if not cards:
                    self.logger.info(f"HiBid: no more cards at page {page}")
                    break

                for card in cards:
                    listing = self._parse_html_card(card)
                    if listing:
                        yield listing

                page += 1

            except Exception as e:
                self.logger.error(f"HiBid error at page {page}: {e}")
                break

    def _extract_next_data(self, html: str) -> list[dict] | None:
        match = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.DOTALL)
        if not match:
            return None
        try:
            data = json.loads(match.group(1))
            props = data.get("props", {}).get("pageProps", {})
            items = (
                props.get("lots")
                or props.get("items")
                or props.get("catalogLots")
                or props.get("results", {}).get("lots")
                or props.get("catalog", {}).get("lots")
                or props.get("auctions")
                or props.get("searchResults")
                or props.get("data", {}).get("lots")
                or []
            )
            return items if isinstance(items, list) else None
        except (json.JSONDecodeError, KeyError, AttributeError):
            return None

    def _normalize_json_item(self, item: dict) -> ScrapedListing:
        lot_id = str(item.get("lotId", item.get("id", item.get("lotNumber", ""))))
        slug = re.sub(r"[^a-z0-9]+", "-", (item.get("title", "") or "lot").lower()).strip("-")
        external_url = item.get("url") or f"{self.base_url}/lot/{lot_id}/{slug}/"

        img = (
            item.get("imageUrl")
            or item.get("thumbnailUrl")
            or item.get("primaryImageUrl")
        )

        return ScrapedListing(
            platform_slug=self.platform_slug,
            external_id=lot_id,
            external_url=external_url,
            title=item.get("title", item.get("lotTitle", "Unknown")),
            description=item.get("description", item.get("longDescription", "")),
            category=item.get("categoryName", item.get("category", "")),
            current_price=self._parse_price(
                item.get("currentBid", item.get("highBid", item.get("startingBid")))
            ),
            buyers_premium_pct=item.get("buyersPremium", item.get("buyersPremiumPercent")),
            city=item.get("city", item.get("auctionCity", "")),
            state=item.get("state", item.get("stateCode", item.get("auctionState", ""))),
            sale_ends_at=self._parse_datetime(
                item.get("endDate", item.get("dateTimeEnds", item.get("closingDate")))
            ),
            sale_starts_at=self._parse_datetime(
                item.get("startDate", item.get("dateTimeStart", item.get("openingDate")))
            ),
            primary_image_url=img,
            image_urls=item.get("imageUrls", []),
            raw_data=item,
        )

    def _parse_html_card(self, card) -> ScrapedListing | None:
        try:
            link = card.find("a", href=True)
            if not link:
                return None
            href = link["href"]

            id_match = re.search(r"/lot/(\d+)", href)
            if not id_match:
                return None
            lot_id = id_match.group(1)

            title_el = (
                card.find(class_=re.compile(r"title", re.I))
                or card.find(["h2", "h3", "h4"])
            )
            title = title_el.get_text(strip=True) if title_el else "Unknown"

            price_el = card.find(string=re.compile(r"\$[\d,]+"))
            price = self._parse_price(price_el) if price_el else None

            img = card.find("img")
            img_url = None
            if img:
                img_url = img.get("src") or img.get("data-src") or img.get("data-lazy-src")

            loc_el = card.find(class_=re.compile(r"location|city|state", re.I))
            city, state = "", ""
            if loc_el:
                loc_text = loc_el.get_text(strip=True)
                parts = [p.strip() for p in loc_text.split(",")]
                if len(parts) >= 2:
                    city, state = parts[0], parts[1][:2]
                elif len(parts) == 1 and len(parts[0]) == 2:
                    state = parts[0]

            full_url = href if href.startswith("http") else f"{self.base_url}{href}"

            return ScrapedListing(
                platform_slug=self.platform_slug,
                external_id=lot_id,
                external_url=full_url,
                title=title,
                current_price=price,
                city=city,
                state=state,
                primary_image_url=img_url,
                raw_data={"html_parsed": True},
            )
        except Exception as e:
            self.logger.debug(f"HiBid card parse error: {e}")
            return None

    async def scrape_listing_detail(self, external_id: str) -> ScrapedListing | None:
        url = f"{self.base_url}/lot/{external_id}/"
        try:
            response = await self._fetch(url)
            json_items = self._extract_next_data(response.text)
            if json_items:
                return self._normalize_json_item(json_items[0])

            soup = BeautifulSoup(response.text, "lxml")
            json_ld = soup.find("script", type="application/ld+json")
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
        except Exception as e:
            self.logger.error(f"HiBid detail error for {external_id}: {e}")
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
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d",
            "%m/%d/%Y %I:%M %p",
            "%m/%d/%Y",
        ]
        for fmt in formats:
            try:
                return datetime.strptime(str(value), fmt)
            except ValueError:
                continue
        return None
