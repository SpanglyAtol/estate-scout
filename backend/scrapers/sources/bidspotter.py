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

Lot listing URL for a catalog:
  https://www.bidspotter.com/en-us/auction-catalogues/{slug}/lots?lot-page=N
"""

import json
from typing import AsyncIterator

from bs4 import BeautifulSoup

from scrapers.base import BaseScraper, ScrapedItem, ScrapedListing


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
        max_pages = kwargs.get("max_pages", 20)
        fetch_lots = kwargs.get("fetch_lots", True)
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
                # BidSpotter uses data-auction-ref on article elements
                articles = soup.select("article[data-auction-ref]")

                if not articles:
                    self.logger.info(f"BidSpotter: no more articles at page {page}")
                    break

                for article in articles:
                    listing = self._parse_article(article)
                    if listing:
                        if fetch_lots and listing.external_url:
                            lots = await self._fetch_lots(listing.external_url)
                            if lots:
                                listing.items = lots
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
                    state_abbr = self._state_abbrev(raw_state)

            # Dates from JSON-LD
            sale_starts_at = self._parse_iso(ld_data.get("startDate"))
            sale_ends_at = self._parse_iso(ld_data.get("endDate"))

            # Organizer name
            organizer = ld_data.get("organizer") or {}
            organizer_name = organizer.get("name") if isinstance(organizer, dict) else None

            return ScrapedListing(
                platform_slug=self.platform_slug,
                external_id=auction_ref,
                external_url=external_url,
                title=title,
                description=description,
                listing_type="auction",
                item_type="auction_catalog",
                auction_status=self._infer_auction_status(sale_starts_at, sale_ends_at),
                pickup_only=False,
                ships_nationally=True,
                city=city,
                state=state_abbr,
                sale_starts_at=sale_starts_at,
                sale_ends_at=sale_ends_at,
                primary_image_url=image_url,
                raw_data={"json_ld": ld_data, "organizer": organizer_name},
            )
        except Exception as exc:
            self.logger.debug(f"BidSpotter article parse error: {exc}")
            return None

    async def _fetch_lots(
        self, catalog_url: str, max_lot_pages: int = 10
    ) -> list[ScrapedItem]:
        """Fetch lot-level items from a BidSpotter catalog detail page."""
        items: list[ScrapedItem] = []
        lots_base = catalog_url.rstrip("/") + "/lots"

        for lot_page in range(1, max_lot_pages + 1):
            try:
                resp = await self._fetch(
                    lots_base,
                    params={"lot-page": lot_page},
                    headers=self._browser_headers(referer=catalog_url),
                )
                soup = BeautifulSoup(resp.text, "lxml")

                lot_cards = soup.select("article.lot-card, div.lot-item, li.lot-row")
                if not lot_cards:
                    # Try JSON-LD products embedded on page
                    for ld_el in soup.find_all("script", type="application/ld+json"):
                        try:
                            ld = json.loads(ld_el.string or "")
                        except (json.JSONDecodeError, AttributeError):
                            continue
                        if isinstance(ld, dict) and ld.get("@type") == "ItemList":
                            for elem in ld.get("itemListElement") or []:
                                item = self._ld_to_item(elem.get("item") or elem)
                                if item:
                                    items.append(item)
                        elif isinstance(ld, dict) and ld.get("@type") in ("Product", "Offer"):
                            item = self._ld_to_item(ld)
                            if item:
                                items.append(item)
                    # No more pages if nothing found
                    break

                for card in lot_cards:
                    item = self._parse_lot_card(card, catalog_url)
                    if item:
                        items.append(item)

                # If fewer cards than a full page, we're done
                if len(lot_cards) < 20:
                    break

            except Exception as exc:
                self.logger.debug(f"BidSpotter lot page {lot_page} error: {exc}")
                break

        return items

    def _parse_lot_card(self, card, catalog_url: str) -> ScrapedItem | None:
        """Parse a single BidSpotter lot card element."""
        try:
            title_el = card.select_one(".lot-title, h3.lot-name, .lot-description h3")
            title = title_el.get_text(strip=True) if title_el else ""
            if not title:
                return None

            lot_num_el = card.select_one(".lot-number, [data-lot-number]")
            lot_num = ""
            if lot_num_el:
                lot_num = (
                    lot_num_el.get("data-lot-number")
                    or lot_num_el.get_text(strip=True)
                )
                lot_num = lot_num.replace("Lot", "").replace("#", "").strip()

            # Price
            price_el = card.select_one(".lot-price, .current-bid, .bid-amount")
            current_price = None
            if price_el:
                current_price = self._parse_price(price_el.get_text(strip=True))

            # Estimate
            est_el = card.select_one(".lot-estimate, .estimate")
            est_low, est_high = None, None
            if est_el:
                est_text = est_el.get_text(strip=True)
                # Format: "$100 - $200" or "Est: $100–$200"
                parts = [p.strip() for p in est_text.replace("–", "-").split("-") if p.strip()]
                if len(parts) >= 2:
                    est_low = self._parse_price(parts[-2])
                    est_high = self._parse_price(parts[-1])
                elif len(parts) == 1:
                    est_low = self._parse_price(parts[0])

            # Image
            img_el = card.select_one("img.lot-image, .lot-thumbnail img")
            img_url = img_el.get("src") or img_el.get("data-src") if img_el else None

            # URL
            link_el = card.select_one("a.lot-link, a.lot-title-link, h3 a")
            lot_url = None
            if link_el:
                href = link_el.get("href", "")
                lot_url = href if href.startswith("http") else self.base_url + href

            # Description
            desc_el = card.select_one(".lot-description p, .lot-details")
            description = desc_el.get_text(strip=True) if desc_el else None

            return ScrapedItem(
                title=title,
                lot_number=lot_num or None,
                description=description,
                current_price=current_price,
                estimate_low=est_low,
                estimate_high=est_high,
                primary_image_url=img_url,
                image_urls=[img_url] if img_url else [],
                external_url=lot_url or catalog_url,
            )
        except Exception as exc:
            self.logger.debug(f"BidSpotter lot card parse error: {exc}")
            return None

    def _ld_to_item(self, ld: dict) -> ScrapedItem | None:
        """Convert a JSON-LD Product/Offer object to a ScrapedItem."""
        try:
            title = ld.get("name", "").strip()
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

    async def scrape_listing_detail(self, external_id: str) -> ScrapedListing | None:
        """Not implemented — catalog-level data from listing search is sufficient."""
        return None

    # _parse_price, _parse_dt, _parse_iso inherited from BaseScraper

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
