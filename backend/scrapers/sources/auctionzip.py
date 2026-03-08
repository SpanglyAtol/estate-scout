"""
AuctionZip scraper — directory of 25,000+ local auctioneers with listings.

AuctionZip is a US-focused auction directory that aggregates listings from
small regional auctioneers who often don't have their own online presence.
This is a valuable source for estate/antique lots that aren't on larger platforms.

Strategy:
  1. Browse auction listings by state via HTML search pages
  2. Parse individual auction pages for lot-level items
  3. Fall back to sitemap for URL discovery

Auction list:  https://www.auctionzip.com/Auction-Listings/{state-code}/
Auction page:  https://www.auctionzip.com/listings/{auction-id}/
Item/lot URL:  https://www.auctionzip.com/listings/{auction-id}/lot/{lot-id}/
"""

import json
import re
import xml.etree.ElementTree as ET
from datetime import datetime
from typing import AsyncIterator

from bs4 import BeautifulSoup

from scrapers.base import BaseScraper, ScrapedItem, ScrapedListing


AUCTIONZIP_BASE = "https://www.auctionzip.com"

# 2-letter US state codes for state-by-state browsing
_US_STATES = [
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
    "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
    "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
    "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
    "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
]

# Keywords to filter for antique/estate content (drop industrial/vehicle auctions)
_RELEVANT_KEYWORDS = [
    "estate", "antique", "collectible", "jewelry", "furniture",
    "art", "coin", "silver", "gold", "china", "crystal", "vintage",
    "auction", "houseold", "personal property",
]
_IRRELEVANT_KEYWORDS = [
    "vehicle", "truck", "car auction", "auto auction", "equipment",
    "machinery", "farm", "industrial", "real estate only",
]


class AuctionZipScraper(BaseScraper):
    """
    Scraper for AuctionZip.com — local auctioneer directory.

    Scrapes auction listings state by state, then fetches individual auction
    pages to extract lot-level items (where available).
    """

    platform_slug = "auctionzip"
    base_url = AUCTIONZIP_BASE
    default_rate_limit = 0.4

    async def scrape_listings(
        self,
        states: list[str] | None = None,
        max_pages: int = 3,
        **kwargs,
    ) -> AsyncIterator[ScrapedListing]:
        """
        Yield auction listings from AuctionZip.

        Args:
            states:     List of 2-letter state codes to scrape.
                        Defaults to top 10 states by estate sale volume.
            max_pages:  Pages per state (default 3; ≈20 auctions/page).
        """
        target_states = states or [
            "CA", "NY", "TX", "FL", "PA", "OH", "IL", "MA", "NJ", "GA",
            "NC", "VA", "WA", "CO", "MI", "TN", "MO", "MD", "CT", "IN",
        ]

        seen_ids: set[str] = set()

        for state in target_states:
            self.logger.info(f"AuctionZip: scraping state {state}")
            for page in range(1, max_pages + 1):
                try:
                    auctions = await self._fetch_state_page(state, page)
                    if not auctions:
                        break
                    for auction_stub in auctions:
                        auction_id = auction_stub.get("id", "")
                        if not auction_id or auction_id in seen_ids:
                            continue
                        seen_ids.add(auction_id)
                        # Fetch full auction page for lot-level detail
                        listing = await self._fetch_auction_detail(auction_stub)
                        if listing:
                            yield listing
                except Exception as exc:
                    self.logger.warning(f"AuctionZip {state} p{page}: {exc}")
                    break

    # ── State listing pages ───────────────────────────────────────────────────

    async def _fetch_state_page(self, state: str, page: int) -> list[dict]:
        """Scrape the AuctionZip state listing page for auction stubs."""
        url = f"{AUCTIONZIP_BASE}/Auction-Listings/{state}/?page={page}"
        try:
            response = await self._fetch(
                url,
                headers=self._browser_headers(referer=AUCTIONZIP_BASE + "/"),
            )
        except Exception as exc:
            self.logger.debug(f"AuctionZip state page error: {exc}")
            return []

        html = response.text
        stubs: list[dict] = []
        soup = BeautifulSoup(html, "lxml")

        # Look for auction listing rows / cards
        for row in soup.select(
            ".listing-row, .auction-listing, [class*=auction-item], "
            "[class*=auctionListing], li.clearfix"
        ):
            try:
                title_el = row.select_one("h2, h3, h4, .title, [class*=title]")
                link_el = row.select_one("a[href*='/listings/'], a[href*='/auction/']")
                date_el = row.select_one("[class*=date], time, .when")
                loc_el = row.select_one("[class*=location], [class*=city], .where")
                desc_el = row.select_one("[class*=desc], p.description, .preview")

                if not (title_el and link_el):
                    continue

                title = title_el.get_text(strip=True)
                # Relevance filter — skip clearly off-topic
                title_lower = title.lower()
                if any(kw in title_lower for kw in _IRRELEVANT_KEYWORDS):
                    continue

                href = link_el.get("href", "")
                if not href.startswith("http"):
                    href = AUCTIONZIP_BASE + href

                # Extract numeric auction ID from URL
                id_match = re.search(r"/listings?/(\d+)", href)
                auction_id = id_match.group(1) if id_match else href

                location_text = loc_el.get_text(strip=True) if loc_el else ""
                city, state_code = self._parse_location(location_text, state)

                stubs.append({
                    "id": auction_id,
                    "title": title,
                    "url": href,
                    "date_text": date_el.get_text(strip=True) if date_el else "",
                    "city": city,
                    "state": state_code,
                    "description": desc_el.get_text(strip=True) if desc_el else "",
                })
            except Exception:
                pass

        # Also try JSON-LD embedded data
        if not stubs:
            for script in soup.find_all("script", type="application/ld+json"):
                try:
                    data = json.loads(script.string or "")
                    if isinstance(data, list):
                        for item in data:
                            stub = self._ld_to_stub(item, state)
                            if stub:
                                stubs.append(stub)
                    elif isinstance(data, dict):
                        stub = self._ld_to_stub(data, state)
                        if stub:
                            stubs.append(stub)
                except (json.JSONDecodeError, AttributeError):
                    pass

        if stubs:
            self.logger.info(f"AuctionZip {state} p{page}: {len(stubs)} auctions found")
        return stubs

    def _ld_to_stub(self, data: dict, state: str) -> dict | None:
        """Convert a JSON-LD item to an auction stub dict."""
        try:
            schema_type = data.get("@type", "")
            if schema_type not in ("Event", "SaleEvent", "AuctionEvent"):
                return None
            url = data.get("url") or data.get("@id") or ""
            id_match = re.search(r"/listings?/(\d+)", url)
            if not id_match:
                return None
            return {
                "id": id_match.group(1),
                "title": data.get("name", ""),
                "url": url,
                "date_text": data.get("startDate", ""),
                "city": (data.get("location") or {}).get("address", {}).get("addressLocality", ""),
                "state": (data.get("location") or {}).get("address", {}).get("addressRegion", state),
                "description": data.get("description", ""),
            }
        except Exception:
            return None

    # ── Auction detail pages (for lot-level items) ────────────────────────────

    async def _fetch_auction_detail(self, stub: dict) -> ScrapedListing | None:
        """Fetch the full auction page and extract lot items."""
        url = stub.get("url", "")
        auction_id = stub.get("id", "")
        if not url or not auction_id:
            return None

        # First build a base listing from the stub
        title = stub.get("title") or f"AuctionZip Auction #{auction_id}"
        city = stub.get("city", "")
        state = stub.get("state", "")
        end_at = self._parse_date_text(stub.get("date_text", ""))

        listing = ScrapedListing(
            platform_slug=self.platform_slug,
            external_id=auction_id,
            external_url=url,
            title=title,
            description=stub.get("description") or None,
            listing_type="auction",
            city=city or None,
            state=state or None,
            sale_ends_at=end_at,
            raw_data=stub,
        )

        # Fetch the auction page to get lot-level detail + better metadata
        try:
            response = await self._fetch(
                url,
                headers=self._browser_headers(referer=AUCTIONZIP_BASE + "/"),
            )
            html = response.text
            soup = BeautifulSoup(html, "lxml")

            # Update listing with richer data from the auction page
            self._enrich_from_auction_page(listing, soup, html)

            # Extract individual lot items
            listing.items = self._extract_lots(soup, url)
            if listing.items:
                self.logger.info(
                    f"AuctionZip {auction_id}: {len(listing.items)} lots found"
                )
        except Exception as exc:
            self.logger.debug(f"AuctionZip detail fetch failed for {auction_id}: {exc}")

        return listing

    def _enrich_from_auction_page(
        self, listing: ScrapedListing, soup: BeautifulSoup, html: str
    ) -> None:
        """Update listing fields with data from the auction detail HTML page."""
        # Images
        images = []
        for img in soup.select(".auction-images img, .lot-images img, .gallery img, img[class*=main]"):
            src = img.get("src") or img.get("data-src") or ""
            if src and src not in images and not src.endswith((".gif", ".svg")):
                images.append(src)
        if images:
            listing.primary_image_url = images[0]
            listing.image_urls = images

        # Description — look for the full auction description block
        desc_el = soup.select_one(
            ".auction-description, .sale-description, [class*=auctionDesc], .listing-description"
        )
        if desc_el and not listing.description:
            listing.description = desc_el.get_text(separator=" ", strip=True)

        # Auctioneer / location info
        loc_el = soup.select_one(".auctioneer-location, .location-info, [class*=location]")
        if loc_el and not listing.city:
            city, state = self._parse_location(loc_el.get_text(strip=True), listing.state or "")
            listing.city = city or listing.city
            listing.state = state or listing.state

        # Pickup-only detection
        full_text = soup.get_text().lower()
        if "pickup only" in full_text or "local pickup" in full_text:
            listing.pickup_only = True

        # Date refinement
        date_el = soup.select_one("time, [class*=date], [class*=when]")
        if date_el and not listing.sale_ends_at:
            date_text = date_el.get("datetime") or date_el.get_text(strip=True)
            listing.sale_ends_at = self._parse_date_text(date_text)

    def _extract_lots(self, soup: BeautifulSoup, auction_url: str) -> list[ScrapedItem]:
        """Extract individual lot items from an auction detail page."""
        items: list[ScrapedItem] = []

        # Try structured lot containers first
        for lot_el in soup.select(
            ".lot-item, .lot-row, [class*=lot-listing], [class*=lotItem], "
            "[data-lot-id], .item-listing, .auction-lot"
        ):
            try:
                title_el = lot_el.select_one("h3, h4, [class*=title], [class*=name]")
                price_el = lot_el.select_one("[class*=price], [class*=bid], [class*=estimate]")
                img_el = lot_el.select_one("img")
                link_el = lot_el.select_one("a[href]")
                lot_num_el = lot_el.select_one("[class*=lot-num], [class*=lotNum], .lot-number")
                desc_el = lot_el.select_one("[class*=desc], p")

                if not title_el:
                    continue

                lot_title = title_el.get_text(strip=True)
                if not lot_title:
                    continue

                lot_url = None
                if link_el:
                    href = link_el.get("href", "")
                    lot_url = AUCTIONZIP_BASE + href if href.startswith("/") else href or None

                img_src = None
                if img_el:
                    img_src = img_el.get("src") or img_el.get("data-src") or None
                    if img_src and img_src.endswith((".gif", ".svg")):
                        img_src = None

                price = self._parse_price(price_el.get_text() if price_el else "")
                lot_number = lot_num_el.get_text(strip=True) if lot_num_el else None
                desc_text = desc_el.get_text(strip=True) if desc_el else None

                items.append(ScrapedItem(
                    title=lot_title,
                    lot_number=lot_number,
                    description=desc_text,
                    current_price=price,
                    primary_image_url=img_src,
                    image_urls=[img_src] if img_src else [],
                    external_url=lot_url,
                ))
            except Exception:
                pass

        return items

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _parse_location(self, text: str, default_state: str = "") -> tuple[str, str]:
        """Parse 'City, ST' or 'City, State' text into (city, state_code)."""
        if not text:
            return "", default_state
        parts = [p.strip() for p in text.split(",")]
        if len(parts) >= 2:
            city = parts[0]
            state_part = parts[-1].strip().upper()
            # Extract 2-letter code if spelled out
            if len(state_part) > 2:
                state_part = default_state
            return city, state_part
        return text.strip(), default_state

    @staticmethod
    def _parse_price(value: str) -> float | None:
        if not value:
            return None
        cleaned = re.sub(r"[^\d.]", "", value.strip())
        try:
            return float(cleaned) if cleaned else None
        except ValueError:
            return None

    @staticmethod
    def _parse_date_text(text: str) -> datetime | None:
        """Best-effort parse of human date strings from auction listings."""
        if not text:
            return None
        # ISO format first
        for fmt in (
            "%Y-%m-%dT%H:%M:%SZ",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%d",
        ):
            try:
                return datetime.strptime(text.strip(), fmt)
            except ValueError:
                pass
        # Try dateutil if available
        try:
            from dateutil import parser as du
            return du.parse(text, fuzzy=True)
        except Exception:
            pass
        return None

    async def scrape_listing_detail(self, external_id: str) -> ScrapedListing | None:
        """Fetch a single AuctionZip auction page."""
        stub = {"id": external_id, "url": f"{AUCTIONZIP_BASE}/listings/{external_id}/", "title": ""}
        return await self._fetch_auction_detail(stub)
