"""
BidSpotter scraper — online estate and specialty auction catalogs.

BidSpotter (bidspotter.com) lists timed and live auction catalogs from
independent auctioneers.  Each catalog page embeds full JSON-LD structured
data with title, image, dates, URL, and organizer.  Location (city/state)
is visible in the `.auction-location span` element.

Search URL (state-filtered):
  https://www.bidspotter.com/en-us/auction-catalogues?country=us&state=WA&p=1
Search URL (country-wide, state=None):
  https://www.bidspotter.com/en-us/auction-catalogues?country=us&p=1
"""

import json
import re
from datetime import datetime
from typing import AsyncIterator

from bs4 import BeautifulSoup

from scrapers.base import BaseScraper, ScrapedListing


class BidSpotterScraper(BaseScraper):
    platform_slug = "bidspotter"
    base_url = "https://www.bidspotter.com"
    default_rate_limit = 0.5

    SEARCH_URL = "https://www.bidspotter.com/en-us/auction-catalogues"

    async def scrape_listings(
        self,
        state: str | None = None,
        **kwargs,
    ) -> AsyncIterator[ScrapedListing]:
        """Yield auction catalog listings.

        Pass state="WA" to restrict to one US state.
        Omit state (or pass None) to scrape all US listings.
        """
        max_pages = kwargs.get("max_pages", 3)
        page = 1

        while page <= max_pages:
            params: dict = {"country": "us", "p": page}
            if state:
                params["state"] = state
            try:
                response = await self._fetch(
                    self.SEARCH_URL,
                    params=params,
                    headers=self._browser_headers(referer=self.base_url + "/"),
                )
                soup = BeautifulSoup(response.text, "lxml")
                articles = soup.select("article[data-auction-id]")

                if not articles:
                    self.logger.info(f"BidSpotter: no more articles at page {page}")
                    break

                for article in articles:
                    listing = self._parse_article(article)
                    if listing:
                        yield listing

                page += 1

            except Exception as exc:
                self.logger.error(f"BidSpotter error at page {page}: {exc}")
                break

    # ── helpers ──────────────────────────────────────────────────────────────

    def _parse_article(self, article) -> ScrapedListing | None:
        """Parse a single BidSpotter auction article."""
        try:
            auction_ref = article.get("data-auction-ref", "")
            if not auction_ref:
                return None

            # JSON-LD is the primary data source (structured, reliable)
            ld_data = {}
            ld_el = article.find("script", type="application/ld+json")
            if ld_el and ld_el.string:
                try:
                    ld_data = json.loads(ld_el.string)
                except json.JSONDecodeError:
                    pass

            title = ld_data.get("name") or article.select_one(".auction-title a")
            if hasattr(title, "get_text"):
                title = title.get_text(strip=True)
            if not title:
                return None

            external_url = ld_data.get("url", "")
            if not external_url:
                link = article.select_one("a.auction-image-container, .auction-title a")
                if link:
                    href = link.get("href", "")
                    external_url = href if href.startswith("http") else self.base_url + href
            if not external_url:
                return None

            image_url = ld_data.get("image")
            description = ld_data.get("description")

            # Location — visible in the HTML card as "City, State"
            city, state_abbr = None, None
            loc_el = article.select_one(".auction-location span")
            if loc_el:
                loc_text = loc_el.get_text(strip=True)
                # Format: "Seattle, Washington" or "Seattle, WA"
                parts = [p.strip() for p in loc_text.split(",")]
                if len(parts) >= 2:
                    city = parts[0]
                    raw_state = parts[1].strip()
                    # Convert full state names to abbreviations
                    state_abbr = self._state_abbrev(raw_state)

            # Dates from JSON-LD
            sale_starts_at = self._parse_iso(ld_data.get("startDate"))
            sale_ends_at = self._parse_iso(ld_data.get("endDate"))

            return ScrapedListing(
                platform_slug=self.platform_slug,
                external_id=auction_ref,
                external_url=external_url,
                title=title,
                description=description,
                pickup_only=False,      # BidSpotter auctions usually allow shipping
                ships_nationally=True,
                city=city,
                state=state_abbr,
                sale_starts_at=sale_starts_at,
                sale_ends_at=sale_ends_at,
                primary_image_url=image_url,
                raw_data={"json_ld": ld_data},
            )
        except Exception as exc:
            self.logger.debug(f"BidSpotter article parse error: {exc}")
            return None

    @staticmethod
    def _parse_iso(value: str | None) -> datetime | None:
        if not value:
            return None
        try:
            return datetime.fromisoformat(str(value))
        except Exception:
            return None

    # US state name → 2-letter abbreviation
    _STATES = {
        "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR",
        "california": "CA", "colorado": "CO", "connecticut": "CT", "delaware": "DE",
        "florida": "FL", "georgia": "GA", "hawaii": "HI", "idaho": "ID",
        "illinois": "IL", "indiana": "IN", "iowa": "IA", "kansas": "KS",
        "kentucky": "KY", "louisiana": "LA", "maine": "ME", "maryland": "MD",
        "massachusetts": "MA", "michigan": "MI", "minnesota": "MN", "mississippi": "MS",
        "missouri": "MO", "montana": "MT", "nebraska": "NE", "nevada": "NV",
        "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
        "north carolina": "NC", "north dakota": "ND", "ohio": "OH", "oklahoma": "OK",
        "oregon": "OR", "pennsylvania": "PA", "rhode island": "RI", "south carolina": "SC",
        "south dakota": "SD", "tennessee": "TN", "texas": "TX", "utah": "UT",
        "vermont": "VT", "virginia": "VA", "washington": "WA", "west virginia": "WV",
        "wisconsin": "WI", "wyoming": "WY",
    }

    def _state_abbrev(self, raw: str) -> str:
        """Convert 'Washington' or 'WA' to 'WA'."""
        clean = raw.strip()
        if len(clean) == 2:
            return clean.upper()
        return self._STATES.get(clean.lower(), clean[:2].upper())

    async def scrape_listing_detail(self, external_id: str) -> ScrapedListing | None:
        """BidSpotter catalog pages have JSON-LD; reuse parse logic."""
        return None  # Detail scraping not needed for catalog-level listings
