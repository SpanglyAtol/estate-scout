"""
EstateSales.NET scraper.

Strategy
--------
EstateSales.NET is an Angular SPA; the listing data loads asynchronously
via private API calls.  However, the server-side renders up to 3 JSON-LD
``SaleEvent`` blocks per page in the <head>.  Each block contains all the
fields we need (name, url, startDate, endDate, image, location).

National mode (state=""):
  Iterates through the 10 highest-volume US states, fetching
  ceil(max_pages / 10) pages each, so total page count stays near
  max_pages.  The national homepage (/  ) has no JSON-LD blocks and
  exits immediately, so state-based URLs are required.

State mode (e.g. state="WA"):
  Pages through /WA?page=N up to max_pages.

Typical yield: ~3 JSON-LD blocks per page.

With 17 max_pages across 10 states (2 pages/state) → ~60 listings.
"""

import json
import math
import re
from datetime import datetime
from typing import AsyncIterator

from bs4 import BeautifulSoup
from dateutil import parser as dtp

from scrapers.base import BaseScraper, ScrapedListing

# States ordered by typical estate-sale volume (20 states for better national coverage)
POPULAR_STATES = [
    "CA", "TX", "FL", "NY", "PA", "OH", "IL", "GA", "NC", "MI",
    "NJ", "VA", "WA", "AZ", "MA", "CO", "TN", "IN", "MO", "MN",
]


class EstateSalesNetScraper(BaseScraper):
    """
    Scraper for EstateSales.NET via JSON-LD extraction.

    Each page at https://www.estatesales.net/{STATE}?page={N} contains up to
    3 ``SaleEvent`` JSON-LD blocks in the ``<head>``, giving title, url,
    images, dates, and location without running JavaScript.
    """

    platform_slug = "estatesales_net"
    base_url = "https://www.estatesales.net"
    default_rate_limit = 0.5

    async def scrape_listings(
        self,
        state: str = "",
        city: str = "",
        **kwargs,
    ) -> AsyncIterator[ScrapedListing]:
        """
        Scrape estate sale listings.

        Args:
            state: 2-letter state abbreviation (e.g. "WA").
                   If empty, scrapes POPULAR_STATES to avoid the national
                   homepage which has no JSON-LD blocks.
            city:  Unused directly; reserved for future city-level filtering.
            **kwargs: max_pages (default 10).
        """
        max_pages = kwargs.get("max_pages", 10)
        seen_ids: set[str] = set()

        if state:
            states_to_scrape = [(state.upper(), max_pages)]
        else:
            # Distribute pages across popular states
            pages_each = max(1, math.ceil(max_pages / len(POPULAR_STATES)))
            states_to_scrape = [(s, pages_each) for s in POPULAR_STATES]

        for target_state, pages in states_to_scrape:
            for page in range(1, pages + 1):
                url = f"{self.base_url}/{target_state}"
                params = {"page": page}

                try:
                    response = await self._fetch(url, params=params)
                    soup = BeautifulSoup(response.text, "lxml")

                    # Extract all JSON-LD SaleEvent blocks
                    json_lds = soup.find_all("script", type="application/ld+json")
                    found_on_page = 0

                    for jld in json_lds:
                        if not jld.string:
                            continue
                        try:
                            data = json.loads(jld.string)
                        except json.JSONDecodeError:
                            continue

                        # Handle both single objects and arrays
                        items = data if isinstance(data, list) else [data]
                        for item in items:
                            if item.get("@type") != "SaleEvent":
                                continue

                            listing = self._normalize(item)
                            if listing and listing.external_id not in seen_ids:
                                seen_ids.add(listing.external_id)
                                found_on_page += 1
                                yield listing

                    self.logger.info(
                        f"EstateSales.NET {target_state} page {page}: "
                        f"{found_on_page} new listings"
                    )

                    # Stop early for this state if no listings found on page
                    if found_on_page == 0:
                        break

                except Exception as exc:
                    self.logger.error(
                        f"EstateSales.NET {target_state} error at page {page}: {exc}"
                    )
                    break

    def _normalize(self, data: dict) -> ScrapedListing | None:
        """Convert a JSON-LD SaleEvent dict to a ScrapedListing."""
        try:
            url: str = data.get("url", "")
            if not url:
                return None

            # Sale ID is the last numeric segment of the URL.
            # URL format: /STATE/City-Name/Zip/SALEID  or  /STATE/City/SALEID
            id_match = re.search(r"/(\d+)(?:/[^/]*)?$", url)
            if not id_match:
                return None
            sale_id = id_match.group(1)

            title: str = (data.get("name") or "Estate Sale").strip()

            # Images
            raw_images = data.get("image", [])
            if isinstance(raw_images, str):
                raw_images = [raw_images]
            images = [img for img in raw_images if img]

            # Dates
            start_date = self._parse_dt(data.get("startDate"))
            end_date = self._parse_dt(data.get("endDate"))

            # Location — try JSON-LD first
            location = data.get("location", {})
            address = location.get("address", {}) if isinstance(location, dict) else {}
            city = (address.get("addressLocality") or "").strip() or None
            state = (address.get("addressRegion") or "").strip() or None
            zip_code = (address.get("postalCode") or "").strip() or None

            # Fallback: parse city/state/zip from the URL path
            # Pattern: /STATE/City-Name/ZIPCODE/SALEID
            # Example: /NY/North-Babylon/11703/4816437
            if not (city and state and zip_code):
                full_url = url if url.startswith("http") else self.base_url + url
                loc_match = re.search(
                    r"/([A-Z]{2})/([^/]+)/(\d{5})/", full_url
                )
                if loc_match:
                    state = state or loc_match.group(1)
                    city = city or loc_match.group(2).replace("-", " ").title()
                    zip_code = zip_code or loc_match.group(3)
                else:
                    # Shorter pattern: /STATE/City/SALEID (no zip in path)
                    short_match = re.search(
                        r"/([A-Z]{2})/([A-Za-z][^/]+)/\d+$", full_url
                    )
                    if short_match:
                        state = state or short_match.group(1)
                        city = city or short_match.group(2).replace("-", " ").title()

            # Description
            description = (data.get("description") or "").strip() or None

            return ScrapedListing(
                platform_slug=self.platform_slug,
                external_id=sale_id,
                external_url=url if url.startswith("http") else self.base_url + url,
                title=title,
                description=description,
                listing_type="estate_sale",
                pickup_only=True,   # Physical estate sales require in-person
                ships_nationally=False,
                city=city,
                state=state,
                zip_code=zip_code,
                sale_starts_at=start_date,
                sale_ends_at=end_date,
                primary_image_url=images[0] if images else None,
                image_urls=images,
                raw_data={"json_ld": True, "organizer": data.get("organizer", {})},
            )
        except Exception as exc:
            self.logger.debug(f"EstateSales.NET _normalize error: {exc}")
            return None

    @staticmethod
    def _parse_dt(value) -> datetime | None:
        if not value:
            return None
        try:
            return dtp.parse(str(value))
        except Exception:
            return None

    async def scrape_listing_detail(self, external_id: str) -> ScrapedListing | None:
        """Fetch the detail page for a single estate sale for enriched data."""
        url = f"{self.base_url}/estate-sales/{external_id}"
        try:
            response = await self._fetch(url)
            soup = BeautifulSoup(response.text, "lxml")

            # Try JSON-LD on detail page
            for jld in soup.find_all("script", type="application/ld+json"):
                if not jld.string:
                    continue
                try:
                    data = json.loads(jld.string)
                    items = data if isinstance(data, list) else [data]
                    for item in items:
                        if item.get("@type") == "SaleEvent":
                            return self._normalize(item)
                except json.JSONDecodeError:
                    continue
            return None
        except Exception as exc:
            self.logger.error(
                f"EstateSales.NET detail fetch error for {external_id}: {exc}"
            )
            return None
