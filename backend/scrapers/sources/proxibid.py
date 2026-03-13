"""
Proxibid Scraper — online auction platform for estates & collectibles.

Strategy
--------
Proxibid lists thousands of upcoming and live auctions from independent
auction houses across the US.  Their auction calendar page renders server-
side HTML that includes event metadata as JSON-LD (Event schema) and
structured HTML cards.

Auction calendar URL:
  https://www.proxibid.com/asp/AuctionCalendar.asp?pgN=1

Each auction event links to a catalog page with individual lots — but for
our purposes, we treat each auction event as a listing (like EstateSales.NET
and BidSpotter treat their events).

JSON-LD Event schema fields available per event:
  name, url, startDate, endDate, image, location (city/state), organizer

Rate limit: 0.5 req/s — conservative for a moderately trafficked site.
"""

import json
import re
from typing import AsyncIterator

from bs4 import BeautifulSoup

from scrapers.base import BaseScraper, ScrapedListing


class ProxibidScraper(BaseScraper):
    """
    Scraper for Proxibid.com auction calendar listings.

    Yields upcoming / live estate auction events, each as a ScrapedListing.
    Location (city + state) and date range are extracted from JSON-LD or HTML.
    """

    platform_slug = "proxibid"
    base_url = "https://www.proxibid.com"
    default_rate_limit = 0.5

    CALENDAR_URL = "https://www.proxibid.com/asp/AuctionCalendar.asp"

    async def scrape_listings(
        self,
        state: str = "",
        **kwargs,
    ) -> AsyncIterator[ScrapedListing]:
        """
        Scrape upcoming auction events from Proxibid's calendar.

        Args:
            state: Optional 2-letter US state filter (e.g. "TX").
                   If empty, scrapes all US events.
        """
        max_pages = kwargs.get("max_pages", 10)
        seen: set[str] = set()

        for page in range(1, max_pages + 1):
            params: dict = {"pgN": str(page)}
            if state:
                params["state"] = state

            try:
                response = await self._fetch(
                    self.CALENDAR_URL,
                    params=params,
                    headers=self._browser_headers(referer=self.base_url + "/"),
                )
                soup = BeautifulSoup(response.text, "lxml")

                # 1. Try JSON-LD Event blocks (preferred)
                events = self._extract_json_ld_events(soup)

                # 2. Fallback to HTML card parsing
                if not events:
                    events = self._parse_html_cards(soup)

                if not events:
                    self.logger.info(f"Proxibid: no more events at page {page}")
                    break

                for event in events:
                    listing = self._normalize_event(event)
                    if listing and listing.external_id not in seen:
                        seen.add(listing.external_id)
                        yield listing

            except Exception as exc:
                self.logger.error(f"Proxibid error (page={page}): {exc}")
                break

    # ── extraction ────────────────────────────────────────────────────────────

    def _extract_json_ld_events(self, soup: BeautifulSoup) -> list[dict]:
        events: list[dict] = []
        for script in soup.find_all("script", type="application/ld+json"):
            try:
                obj = json.loads(script.string or "")
                if isinstance(obj, list):
                    events.extend(obj)
                elif isinstance(obj, dict):
                    t = obj.get("@type", "")
                    if t in ("Event", "SaleEvent", "BusinessEvent"):
                        events.append(obj)
                    elif t in ("ItemList", "SearchResultsPage"):
                        for item in obj.get("itemListElement", []):
                            if isinstance(item, dict):
                                events.append(item.get("item", item))
            except (json.JSONDecodeError, TypeError):
                continue
        return events

    def _parse_html_cards(self, soup: BeautifulSoup) -> list[dict]:
        """Parse HTML auction cards into dicts that _normalize_event can handle."""
        results: list[dict] = []
        # Proxibid uses various class patterns; try broad selectors
        cards = soup.select(
            ".auctionRow, .auction-row, [class*='auction'], article, "
            "li[class*='item'], div[class*='event-card']"
        )
        for card in cards:
            link = card.find("a", href=True)
            if not link:
                continue
            href = link["href"]
            if not href.startswith("http"):
                href = self.base_url + href

            id_match = re.search(r"/(\d{4,12})", href)
            event_id = id_match.group(1) if id_match else href[-10:]

            title_el = card.find(["h2", "h3", "h4", "strong"])
            title = title_el.get_text(strip=True) if title_el else link.get_text(strip=True)

            img = card.find("img")
            img_url = img.get("src") if img else None

            # Try to extract date text
            date_text = ""
            for date_el in card.find_all(text=re.compile(r"\d{1,2}/\d{1,2}/\d{2,4}")):
                date_text = str(date_el).strip()
                break

            # Location
            city, state = None, None
            loc_el = card.find(class_=re.compile(r"location|city|state", re.I))
            if loc_el:
                parts = loc_el.get_text(strip=True).split(",")
                if len(parts) >= 2:
                    city  = parts[0].strip()
                    state = parts[1].strip().split()[0][:2].upper()

            results.append({
                "_html": True,
                "id": event_id,
                "name": title,
                "url": href,
                "image": {"url": img_url} if img_url else {},
                "location": {"address": {"addressLocality": city, "addressRegion": state}},
                "startDate": date_text,
            })
        return results

    # ── normalisation ─────────────────────────────────────────────────────────

    def _normalize_event(self, event: dict) -> ScrapedListing | None:
        try:
            # ID — prefer numeric ID from URL
            url = event.get("url", "")
            id_match = re.search(r"/(\d{4,12})", url)
            event_id = id_match.group(1) if id_match else event.get("id", "")
            event_id = str(event_id)
            if not event_id:
                return None

            title = event.get("name", "")
            if not title:
                return None

            if url and not url.startswith("http"):
                url = self.base_url + url

            # Image
            img_data = event.get("image") or {}
            if isinstance(img_data, str):
                img_url = img_data
            elif isinstance(img_data, dict):
                img_url = img_data.get("url") or img_data.get("contentUrl")
            elif isinstance(img_data, list) and img_data:
                img_url = img_data[0] if isinstance(img_data[0], str) else img_data[0].get("url")
            else:
                img_url = None

            # Location
            location = event.get("location") or {}
            address  = location.get("address") or {}
            city  = address.get("addressLocality") or location.get("addressLocality")
            state_raw = address.get("addressRegion") or location.get("addressRegion") or ""
            state = state_raw[:2].upper() if state_raw else None

            # Dates
            start_dt = self._parse_dt(event.get("startDate"))
            end_dt   = self._parse_dt(event.get("endDate"))

            description = event.get("description")

            return ScrapedListing(
                platform_slug=self.platform_slug,
                external_id=event_id,
                external_url=url,
                title=title,
                description=description,
                listing_type="auction",
                auction_status=self._infer_auction_status(start_dt, end_dt),
                city=city,
                state=state,
                sale_starts_at=start_dt,
                sale_ends_at=end_dt,
                primary_image_url=img_url,
                raw_data=event,
            )
        except Exception as exc:
            self.logger.debug(f"Proxibid normalize error: {exc}")
            return None

    # _parse_price, _parse_dt, _parse_iso inherited from BaseScraper

    async def scrape_listing_detail(self, external_id: str) -> ScrapedListing | None:
        return None
