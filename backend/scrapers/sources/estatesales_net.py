import re
from datetime import datetime
from typing import AsyncIterator

from bs4 import BeautifulSoup
from dateutil import parser as dtp

from scrapers.base import BaseScraper, ScrapedListing


class EstateSalesNetScraper(BaseScraper):
    """
    Scraper for EstateSales.NET

    EstateSales.NET aggregates physical estate sale listings by location.
    Key difference from auction platforms: these are in-person sales with
    a start date and end date (usually 1-3 days).
    """

    platform_slug = "estatesales_net"
    base_url = "https://www.estatesales.net"
    default_rate_limit = 0.5

    SEARCH_URL = "https://www.estatesales.net/estate-sales"

    async def scrape_listings(
        self,
        state: str = "WA",
        city: str = "",
        zip_code: str = "",
        **kwargs,
    ) -> AsyncIterator[ScrapedListing]:
        """Scrape estate sale listings for a given location."""
        page = 1
        max_pages = kwargs.get("max_pages", 10)

        while page <= max_pages:
            # EstateSales.NET uses URL path for location: /estate-sales/WA/Seattle
            path_parts = [self.SEARCH_URL, state]
            if city:
                path_parts.append(city.replace(" ", "-"))
            url = "/".join(path_parts)

            params = {"page": page}
            try:
                response = await self._fetch(url, params=params)
                soup = BeautifulSoup(response.text, "lxml")

                # Find sale listing cards
                cards = soup.select(
                    "div[class*='sale-card'], article[class*='sale'], "
                    "div[class*='SaleCard'], div[id*='sale-'], "
                    ".results-container > div[class], "
                    "li[class*='sale'], div[class*='listing-card'], "
                    "div[class*='sale-listing'], div[class*='event-card']"
                )

                if not cards:
                    self.logger.info(f"No more sales found at page {page} for {state}/{city}")
                    break

                for card in cards:
                    listing = self._parse_sale_card(card)
                    if listing:
                        yield listing

                page += 1

            except Exception as e:
                self.logger.error(f"Error scraping page {page}: {e}")
                break

    def _parse_sale_card(self, card) -> ScrapedListing | None:
        """Parse a single estate sale listing card."""
        try:
            link = card.find("a", href=True)
            if not link:
                return None
            href = link["href"]

            # EstateSales.NET URLs: /WA/Seattle/12345
            id_match = re.search(r"/(\d+)(?:/|$)", href)
            if not id_match:
                return None
            sale_id = id_match.group(1)

            full_url = href if href.startswith("http") else self.base_url + href

            # Title
            title_el = card.find(["h2", "h3", "h4", "[class*='title']"])
            title = title_el.get_text(strip=True) if title_el else "Estate Sale"

            # Location info
            city, state, zip_code = self._extract_location(card)

            # Dates
            sale_starts_at, sale_ends_at = self._extract_dates(card)

            # Image
            img = card.find("img")
            img_url = None
            if img:
                img_url = img.get("src") or img.get("data-src") or img.get("data-lazy-src")

            # Description snippet
            desc_el = card.find("[class*='description'], [class*='desc'], p")
            description = desc_el.get_text(strip=True) if desc_el else None

            return ScrapedListing(
                platform_slug=self.platform_slug,
                external_id=sale_id,
                external_url=full_url,
                title=title,
                description=description,
                pickup_only=True,  # Estate sales are always in-person
                ships_nationally=False,
                city=city,
                state=state,
                zip_code=zip_code,
                sale_starts_at=sale_starts_at,
                sale_ends_at=sale_ends_at,
                primary_image_url=img_url,
                raw_data={"html_parsed": True, "href": href},
            )
        except Exception as e:
            self.logger.debug(f"Failed to parse sale card: {e}")
            return None

    def _extract_location(self, card) -> tuple[str | None, str | None, str | None]:
        """Extract city, state, zip from a card."""
        location_el = card.find("[class*='location'], [class*='address'], [class*='city']")
        if not location_el:
            return None, None, None
        text = location_el.get_text(strip=True)
        # Common format: "Seattle, WA 98101"
        match = re.search(r"([A-Za-z\s]+),\s*([A-Z]{2})\s*(\d{5})?", text)
        if match:
            return match.group(1).strip(), match.group(2), match.group(3)
        return None, None, None

    def _extract_dates(
        self, card
    ) -> tuple[datetime | None, datetime | None]:
        """Extract sale start/end dates from a card element.

        EstateSales.NET shows dates in several formats:
          "Jan 15 - 17, 2026"
          "Thu Jan 16 - Sun Jan 18, 2026"
          "01/15/2026 - 01/17/2026"
          "January 15-17, 2026"
        """
        # Try multiple selector strategies to find the date element
        date_el = (
            card.find(class_=re.compile(r"date|when|time|schedule|dates", re.I))
            or card.find("time")
            or card.find(attrs={"itemprop": "startDate"})
        )
        if not date_el:
            return None, None

        # Also check for machine-readable datetime attribute
        dt_attr = date_el.get("datetime")
        if dt_attr:
            try:
                start = dtp.parse(dt_attr)
                return start, start
            except Exception:
                pass

        text = date_el.get_text(" ", strip=True)
        if not text:
            return None, None

        # Normalize en-dash and em-dash to hyphen
        text = text.replace("–", "-").replace("—", "-")

        # Split on " - " separator (with optional surrounding spaces)
        parts = re.split(r"\s+-\s+", text, maxsplit=1)

        try:
            start = dtp.parse(parts[0].strip(), fuzzy=True)
        except Exception:
            return None, None

        if len(parts) > 1:
            end_text = parts[1].strip()
            try:
                # End part may be partial like "17, 2026" or "Sun Jan 18, 2026"
                # Use start date as default for missing components
                end = dtp.parse(end_text, default=start, fuzzy=True)
            except Exception:
                end = start
        else:
            end = start

        return start, end

    async def scrape_listing_detail(self, external_id: str) -> ScrapedListing | None:
        """Fetch full detail page for a single estate sale."""
        # EstateSales.NET detail pages have more photos and item descriptions
        url = f"{self.base_url}/estate-sales/{external_id}"
        try:
            response = await self._fetch(url)
            soup = BeautifulSoup(response.text, "lxml")

            title_el = soup.find("h1")
            title = title_el.get_text(strip=True) if title_el else "Estate Sale"

            desc_el = soup.find("[class*='description'], [class*='about']")
            description = desc_el.get_text(strip=True)[:2000] if desc_el else None

            images = [
                img.get("src", img.get("data-src", ""))
                for img in soup.select("[class*='gallery'] img, [class*='photo'] img")
                if img.get("src") or img.get("data-src")
            ]

            return ScrapedListing(
                platform_slug=self.platform_slug,
                external_id=external_id,
                external_url=url,
                title=title,
                description=description,
                pickup_only=True,
                ships_nationally=False,
                primary_image_url=images[0] if images else None,
                image_urls=images,
                raw_data={"detail_scraped": True},
            )
        except Exception as e:
            self.logger.error(f"Failed to fetch detail {external_id}: {e}")
            return None
