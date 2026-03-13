"""
eBay Sold Listings Scraper — price reference data for antiques & collectibles.

Strategy
--------
eBay's Completed/Sold Listings search is publicly accessible without an API
key.  We scrape the HTML search results page with the LH_Sold=1 filter,
which shows only items that actually sold (green price) — giving us real
market-clearing prices rather than wishful asking prices.

These listings come in as ``is_completed=True`` with ``final_price`` set,
making them immediately useful for the AI valuation engine and the planned
Historical Price Charts feature.

Search URL pattern:
  https://www.ebay.com/sch/i.html
    ?_nkw=antique+furniture     ← keyword
    &LH_Sold=1                  ← sold only
    &LH_Complete=1              ← completed listings
    &_sacat=0                   ← all categories (override with antiques=20081)
    &_sop=13                    ← sort: most recently sold first
    &_pgn=1                     ← page number

Category IDs used:
  20081 = Antiques
  1  = Collectibles
  870 = Pottery & Glass
  11116 = Jewelry & Watches
"""

import re
from datetime import datetime   # kept for _parse_sold_date strptime
from typing import AsyncIterator

from bs4 import BeautifulSoup

from scrapers.base import BaseScraper, ScrapedListing

# (name, eBay sacat ID)
ANTIQUE_CATEGORIES = [
    ("antiques",     "20081"),
    ("collectibles", "1"),
    ("pottery",      "870"),
    ("jewelry",      "11116"),
    ("furniture",    "3197"),
]

# eBay listing URL pattern: /itm/<title>/<item-id>  or  /itm/<item-id>
_ITEM_ID_RE = re.compile(r"/itm/(?:[^/]+/)?(\d{10,13})")


class EbaySoldListingsScraper(BaseScraper):
    """
    Scrapes eBay's completed/sold listings for antiques & collectibles.

    Each yielded listing has:
      - is_completed = True
      - final_price  = the price it actually sold for
      - listing_type = 'buy_now' (eBay Buy It Now) or 'auction'

    Designed to power the Historical Price Charts feature and the AI
    valuation engine's market-comparison context.
    """

    platform_slug = "ebay"
    base_url = "https://www.ebay.com"
    default_rate_limit = 0.4  # 400 ms between requests

    SEARCH_URL = "https://www.ebay.com/sch/i.html"

    async def scrape_listings(
        self,
        query: str = "antique",
        category_id: str = "20081",   # Antiques by default
        **kwargs,
    ) -> AsyncIterator[ScrapedListing]:
        """
        Yield sold listings.

        Pass ``query`` to override the search term, or ``category_id`` for a
        specific eBay category.  With no args, iterates over ANTIQUE_CATEGORIES
        to give broad coverage.
        """
        max_pages = kwargs.get("max_pages", 5)

        if query and query != "antique":
            # Single targeted search
            async for listing in self._scrape_query(query, category_id, max_pages):
                yield listing
        else:
            # Broad sweep across all antique categories
            for cat_name, cat_id in ANTIQUE_CATEGORIES:
                self.logger.info(f"eBay: scraping category '{cat_name}' (sacat={cat_id})")
                async for listing in self._scrape_query(cat_name, cat_id, max_pages):
                    yield listing

    async def _scrape_query(
        self,
        query: str,
        category_id: str,
        max_pages: int,
    ) -> AsyncIterator[ScrapedListing]:
        seen: set[str] = set()

        for page in range(1, max_pages + 1):
            params = {
                "_nkw":       query,
                "LH_Sold":    "1",
                "LH_Complete": "1",
                "_sacat":     category_id,
                "_sop":       "13",   # most recently sold first
                "_pgn":       str(page),
            }
            try:
                response = await self._fetch(
                    self.SEARCH_URL,
                    params=params,
                    headers={
                        **self._browser_headers(referer="https://www.ebay.com/"),
                        "Accept-Language": "en-US,en;q=0.9",
                        "Cache-Control": "no-cache",
                        "Pragma": "no-cache",
                    },
                )
                soup = BeautifulSoup(response.text, "lxml")

                # eBay wraps each result in <li class="s-item ...">
                cards = soup.select("li.s-item, li[id^='item']")

                # Filter out the ghost "Shop on eBay" header card.
                # Require the link href to contain "/itm/" — this is always
                # present on real listings and absent on the template/ghost card.
                cards = [
                    c for c in cards
                    if c.select_one("a.s-item__link[href*='/itm/']")
                    and not c.select_one(".s-item__title--tagblock")
                ]

                if not cards:
                    snippet = response.text[:400].replace("\n", " ")
                    self.logger.warning(
                        f"eBay [{query}] p{page}: 0 cards — status={response.status_code} "
                        f"snippet={snippet!r}"
                    )
                    break

                for card in cards:
                    listing = self._parse_card(card)
                    if listing and listing.external_id not in seen:
                        seen.add(listing.external_id)
                        yield listing

            except Exception as exc:
                self.logger.error(f"eBay error (query={query}, page={page}): {exc}")
                break

    # ── parsers ──────────────────────────────────────────────────────────────

    def _parse_card(self, card) -> ScrapedListing | None:
        try:
            link_el = card.select_one("a.s-item__link")
            if not link_el:
                return None
            href = link_el.get("href", "")
            id_match = _ITEM_ID_RE.search(href)
            if not id_match:
                return None
            item_id = id_match.group(1)

            title_el = card.select_one(".s-item__title")
            title = title_el.get_text(strip=True) if title_el else ""
            if not title or title.lower() == "shop on ebay":
                return None

            # Sold price (green price text)
            price = None
            for sel in (".s-item__price", ".BOLD"):
                price_el = card.select_one(sel)
                if price_el:
                    price = self._parse_price(price_el.get_text(strip=True))
                    if price:
                        break

            # Image — eBay lazy-loads images; real URL is in data-src, not src
            img_el = card.select_one(".s-item__image-img, img.s-item__image-img, .s-item__image img")
            img_url = None
            if img_el:
                # Prefer data-src (lazy-loaded real URL) over src (placeholder/spinner)
                raw_src = img_el.get("data-src") or img_el.get("src") or ""
                # Discard placeholder URIs (base64 blobs, eBay spinner URLs)
                if raw_src and not raw_src.startswith("data:") and "gif" not in raw_src:
                    img_url = raw_src

            # Condition (e.g. "Pre-Owned", "For parts")
            cond_el = card.select_one(".SECONDARY_INFO, .s-item__subtitle")
            condition = cond_el.get_text(strip=True) if cond_el else None

            # Sale date (shown as "Sold  Dec 15, 2024" on completed listings)
            sold_date: datetime | None = None
            date_el = card.select_one(
                ".s-item__endedDate, .ADDITIONAL_INFO_BOTTOM, "
                ".s-item__title-tag, [class*=endedDate], [class*=ended-date]"
            )
            if date_el:
                date_text = date_el.get_text(strip=True)
                sold_date = self._parse_sold_date(date_text)

            # Detect auction vs BIN from the card — eBay omits this in simple HTML
            listing_type = "buy_now"
            bid_el = card.select_one(".s-item__bidCount")
            if bid_el:
                listing_type = "auction"

            return ScrapedListing(
                platform_slug=self.platform_slug,
                external_id=item_id,
                external_url=f"https://www.ebay.com/itm/{item_id}",
                title=title,
                condition=condition,
                final_price=price,
                current_price=price,
                is_completed=True,
                listing_type=listing_type,
                sale_ends_at=sold_date,
                primary_image_url=img_url,
                ships_nationally=True,
                raw_data={"query_source": "ebay_sold"},
            )
        except Exception as exc:
            self.logger.debug(f"eBay card parse error: {exc}")
            return None

    # _parse_price inherited from BaseScraper (also handles "X to Y" ranges)

    @staticmethod
    def _parse_sold_date(text: str) -> datetime | None:
        """Parse eBay's 'Sold  Dec 15, 2024' or 'Dec 15, 2024' formats."""
        text = re.sub(r"^(sold\s*)", "", text.strip(), flags=re.IGNORECASE)
        for fmt in ("%b %d, %Y", "%B %d, %Y", "%m/%d/%Y"):
            try:
                return datetime.strptime(text, fmt)
            except ValueError:
                continue
        return None

    async def scrape_listing_detail(self, external_id: str) -> ScrapedListing | None:
        """Not needed for price-reference use case — sold listings are complete."""
        return None
