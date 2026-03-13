"""
EstateSales.NET scraper.

Strategy
--------
EstateSales.NET is an Angular SPA; the listing data loads asynchronously
via private API calls.  However, the server-side renders up to 3 JSON-LD
``SaleEvent`` blocks per page in the <head>.  Each block contains all the
fields we need (name, url, startDate, endDate, image, location).

National mode (state=""):
  Iterates through all 50 US states, fetching pages_per_state pages each.
  pages_per_state defaults to max_pages (e.g. 50 via --max-pages 50),
  but early-exit on empty pages keeps wall-clock time reasonable.

State mode (e.g. state="WA"):
  Pages through /WA?page=N up to max_pages.

Detail page item scraping:
  Sale detail pages embed individual item data in the HTML (items listed
  below the sale info panel).  We attempt to extract item title, image,
  and price from the rendered HTML.
"""

import json
import re
from typing import AsyncIterator

from bs4 import BeautifulSoup

from scrapers.base import BaseScraper, ScrapedItem, ScrapedListing

# All 50 US states ordered roughly by estate-sale volume
ALL_STATES = [
    "CA", "TX", "FL", "NY", "PA", "OH", "IL", "GA", "NC", "MI",
    "NJ", "VA", "WA", "AZ", "MA", "CO", "TN", "IN", "MO", "MN",
    "WI", "MD", "OR", "SC", "KY", "AL", "LA", "CT", "OK", "UT",
    "NV", "AR", "MS", "KS", "NE", "ID", "NM", "WV", "HI", "ME",
    "NH", "RI", "MT", "DE", "SD", "ND", "AK", "VT", "WY", "DC",
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
            state:          2-letter state abbreviation (e.g. "WA").
                            If empty, scrapes all 50 US states.
            city:           Unused directly; reserved for future city-level filtering.
            **kwargs:
                max_pages (int):       Max pages per state in state mode (default 20).
                pages_per_state (int): Pages per state in national mode (default 3).
                fetch_items (bool):    Whether to fetch item-level data from detail
                                       pages (default False — slow).
        """
        max_pages = kwargs.get("max_pages", 20)
        # In national mode, pages_per_state defaults to max_pages so that
        # --max-pages 50 (set in the GitHub workflow) actually takes effect.
        # Previously it defaulted to 3 regardless, capping output at ~51 listings.
        pages_per_state = kwargs.get("pages_per_state", max_pages)
        fetch_items = kwargs.get("fetch_items", False)
        seen_ids: set[str] = set()

        if state:
            states_to_scrape = [(state.upper(), max_pages)]
        else:
            states_to_scrape = [(s, pages_per_state) for s in ALL_STATES]

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
                        entries = data if isinstance(data, list) else [data]
                        for entry in entries:
                            if entry.get("@type") != "SaleEvent":
                                continue

                            listing = self._normalize(entry)
                            if listing and listing.external_id not in seen_ids:
                                seen_ids.add(listing.external_id)
                                found_on_page += 1
                                if fetch_items:
                                    items = await self._fetch_sale_items(
                                        listing.external_url
                                    )
                                    if items:
                                        listing.items = items
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

            # Organizer
            organizer = data.get("organizer") or {}
            organizer_name = organizer.get("name") if isinstance(organizer, dict) else None

            return ScrapedListing(
                platform_slug=self.platform_slug,
                external_id=sale_id,
                external_url=url if url.startswith("http") else self.base_url + url,
                title=title,
                description=description,
                listing_type="estate_sale",
                item_type="estate_sale",
                auction_status=self._infer_auction_status(start_date, end_date),
                pickup_only=True,   # Physical estate sales require in-person
                ships_nationally=False,
                city=city,
                state=state,
                zip_code=zip_code,
                sale_starts_at=start_date,
                sale_ends_at=end_date,
                primary_image_url=images[0] if images else None,
                image_urls=images,
                raw_data={"json_ld": True, "organizer": organizer_name},
            )
        except Exception as exc:
            self.logger.debug(f"EstateSales.NET _normalize error: {exc}")
            return None

    async def _fetch_sale_items(self, sale_url: str) -> list[ScrapedItem]:
        """
        Fetch individual items from a sale detail page.

        EstateSales.NET renders a list of items in the HTML for the sale
        detail page under `.items-container` or similar selectors.
        Returns an empty list if the page uses JS-only rendering.
        """
        items: list[ScrapedItem] = []
        try:
            resp = await self._fetch(
                sale_url,
                headers=self._browser_headers(referer=self.base_url + "/"),
            )
            soup = BeautifulSoup(resp.text, "lxml")

            # Try structured item cards
            cards = soup.select(
                ".item-card, .sale-item, article.item, li.item-listing"
            )
            for card in cards:
                item = self._parse_item_card(card, sale_url)
                if item:
                    items.append(item)

            if not items:
                # Fallback: try JSON-LD Product items embedded on detail page
                for ld_el in soup.find_all("script", type="application/ld+json"):
                    try:
                        ld = json.loads(ld_el.string or "")
                    except (json.JSONDecodeError, AttributeError):
                        continue
                    entries = ld if isinstance(ld, list) else [ld]
                    for entry in entries:
                        if entry.get("@type") in ("Product", "Offer"):
                            item = self._ld_to_item(entry)
                            if item:
                                items.append(item)

        except Exception as exc:
            self.logger.debug(f"EstateSales.NET item fetch error for {sale_url}: {exc}")

        return items

    def _parse_item_card(self, card, sale_url: str) -> ScrapedItem | None:
        """Parse a single item card from a sale detail page."""
        try:
            title_el = card.select_one(".item-title, h3, h4, .item-name")
            title = title_el.get_text(strip=True) if title_el else ""
            if not title:
                return None

            price_el = card.select_one(".item-price, .price, .asking-price")
            current_price = None
            if price_el:
                current_price = self._parse_price(price_el.get_text(strip=True))

            img_el = card.select_one("img")
            img_url = img_el.get("src") or img_el.get("data-src") if img_el else None

            link_el = card.select_one("a")
            item_url = None
            if link_el:
                href = link_el.get("href", "")
                item_url = href if href.startswith("http") else self.base_url + href

            return ScrapedItem(
                title=title,
                current_price=current_price,
                primary_image_url=img_url,
                image_urls=[img_url] if img_url else [],
                external_url=item_url or sale_url,
            )
        except Exception:
            return None

    def _ld_to_item(self, ld: dict) -> ScrapedItem | None:
        """Convert a JSON-LD Product/Offer to a ScrapedItem."""
        try:
            title = (ld.get("name") or "").strip()
            if not title:
                return None
            offers = ld.get("offers") or {}
            if isinstance(offers, list):
                offers = offers[0] if offers else {}
            price = self._parse_price(offers.get("price"))
            img = ld.get("image")
            if isinstance(img, list):
                img = img[0] if img else None
            return ScrapedItem(
                title=title,
                description=(ld.get("description") or "").strip() or None,
                current_price=price,
                primary_image_url=img,
                image_urls=[img] if img else [],
                external_url=ld.get("url"),
            )
        except Exception:
            return None

    # _parse_price, _parse_dt, _parse_iso inherited from BaseScraper

    async def scrape_listing_detail(self, external_id: str) -> ScrapedListing | None:
        """Fetch the detail page for a single estate sale for enriched data.

        EstateSales.NET sale URLs embed state/city in the path which we don't
        retain at list time.  The ``/estate-sale/{id}`` shortlink redirects to
        the full canonical URL (follow_redirects=True handles this automatically).
        """
        url = f"{self.base_url}/estate-sale/{external_id}"
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
