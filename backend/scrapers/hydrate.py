"""
Estate Scout — Scraper Hydration Script
========================================
Runs all scrapers and writes real listing data to a JSON file that the
Next.js frontend loads automatically (falling back to mock data if the
file doesn't exist).

Quick-start (from the project root):
  pip install httpx beautifulsoup4 lxml python-dateutil
  python backend/scrapers/hydrate.py

Options:
  --state WA              State abbreviation used by MaxSold (default: WA)
  --city Seattle          Optionally filter to a single city (MaxSold/EstateSales)
  --max-pages 17          Pages per scraper (default: 17)
                            - BidSpotter: 17 × 60 = ~1020 listings
                            - HiBid: 17 × 100 = ~1700 auctions (GraphQL)
                            - EstateSales.NET: 17 × 3  = ~51 listings (JSON-LD)
  --out PATH              Output JSON path (default: apps/web/src/data/scraped-listings.json)
  --targets ms,bs,hi,es   Comma-separated scrapers (default: ms,bs,hi,es)
                            ms=maxsold      – HTML scraper, WA only
                            bs=bidspotter   – JSON API, all US
                            hi=hibid        – GraphQL API, all US
                            es=estatesales  – JSON-LD, all US (~3/page)
                            la=liveauctioneers – blocked (403), skip for now

Notes:
  - LiveAuctioneers returns 403; omit "la" from --targets.
  - Run this periodically (e.g., daily via GitHub Actions) to keep data fresh.
"""

import argparse
import asyncio
import json
import logging
import sys
from dataclasses import asdict
from datetime import datetime, date
from pathlib import Path

# Windows cmd/PowerShell may default to cp1252 which can't encode the box-drawing
# and tick/cross characters used in the summary output.  Force UTF-8 early.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# Make sure 'backend/' is on the import path whether run from project root or backend/
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))          # backend/
sys.path.insert(0, str(HERE.parent.parent))   # project root

from scrapers.rate_limiter import TokenBucketRateLimiter
from scrapers.sources.liveauctioneers import LiveAuctioneersScraper
from scrapers.sources.estatesales_net import EstateSalesNetScraper
from scrapers.sources.hibid import HibidScraper
from scrapers.sources.maxsold import MaxSoldScraper
from scrapers.sources.bidspotter import BidSpotterScraper
from scrapers.base import ScrapedListing

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("hydrate")

# ── Default output path ───────────────────────────────────────────────────────
DEFAULT_OUT = (
    HERE.parent.parent / "apps" / "web" / "src" / "data" / "scraped-listings.json"
)

# ── Platform PLATFORM_META for MockListing platform field ────────────────────
PLATFORM_META = {
    "liveauctioneers": {
        "id": 1,
        "name": "liveauctioneers",
        "display_name": "LiveAuctioneers",
        "base_url": "https://www.liveauctioneers.com",
        "logo_url": None,
    },
    "estatesales_net": {
        "id": 2,
        "name": "estatesales_net",
        "display_name": "EstateSales.NET",
        "base_url": "https://www.estatesales.net",
        "logo_url": None,
    },
    "hibid": {
        "id": 3,
        "name": "hibid",
        "display_name": "HiBid",
        "base_url": "https://hibid.com",
        "logo_url": None,
    },
    "maxsold": {
        "id": 4,
        "name": "maxsold",
        "display_name": "MaxSold",
        "base_url": "https://maxsold.com",
        "logo_url": None,
    },
    "bidspotter": {
        "id": 5,
        "name": "bidspotter",
        "display_name": "BidSpotter",
        "base_url": "https://www.bidspotter.com",
        "logo_url": None,
    },
}

_listing_id_counter = 1

# ── Auto-categorization ───────────────────────────────────────────────────────
# Maps our standard category slugs to keyword lists.
# Keywords are matched (case-insensitive substring) against title + description.
_CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "furniture": [
        "furniture", "chair", "sofa", "couch", " table", "desk", "dresser",
        "cabinet", "bookcase", "armchair", "ottoman", "sideboard", "credenza",
        "wardrobe", "hutch", "buffet", "chest of drawers", "nightstand",
        "headboard", "recliner", "loveseat", "chaise", "settee",
    ],
    "jewelry": [
        "jewelry", "jewellery", " ring", "necklace", "bracelet", "earring",
        "pendant", "diamond", "sapphire", "ruby", "emerald", "pearl",
        "brooch", " watch", " chain", "locket", "cufflink", "gemstone",
        "opal", "amethyst", "turquoise",
    ],
    "art": [
        "painting", "watercolor", "lithograph", "etching", "sculpture",
        " print", "artwork", "portrait", "canvas", "oil on", "gouache",
        "pastel", "acrylic", "framed art",
    ],
    "ceramics": [
        "ceramic", "pottery", "vase", "porcelain", "stoneware", "earthenware",
        "majolica", "wedgwood", "meissen", "imari", "figurine", "platter",
        "teapot", "gravy boat",
    ],
    "glass": [
        " glass", "crystal", "stemware", "decanter", "art glass",
        "blown glass", "pressed glass",
    ],
    "silver": [
        "silver", "sterling", "silverware", "flatware", "candlestick",
        "tea set", "coffee set", "epns",
    ],
    "collectibles": [
        "collectible", "vintage", "antique", " coin", "stamp", "memorabilia",
        "comic", "trading card", "baseball card", "sports card", "action figure",
        "model train", "die-cast", "cast iron bank",
    ],
    "books": [
        " book", "encyclopedia", "manuscript", "magazine", "library",
        "first edition", "hardcover", "paperback",
    ],
    "clothing": [
        "clothing", "apparel", " dress", "jacket", "coat", "handbag",
        " purse", " shoes", "boots", "hat", "scarf", "fur coat",
    ],
    "tools": [
        "tool", "drill", "lathe", " saw", "wrench", "workbench",
        "grinder", "welder", "compressor", "router",
    ],
    "electronics": [
        "camera", "laptop", "computer", "television", "stereo",
        " audio", "speaker", "amplifier", "turntable",
    ],
    "toys": [
        " toy", "lego", "board game", "puzzle", "train set", "teddy bear",
    ],
}


def _auto_categorize(title: str, description: str | None) -> str | None:
    """
    Keyword-match a listing's title + description to a standard category slug.
    Returns None if no category can be inferred.
    """
    text = (title or "").lower()
    if description:
        text += " " + description[:400].lower()
    for category, keywords in _CATEGORY_KEYWORDS.items():
        for kw in keywords:
            if kw in text:
                return category
    return None


def _compute_status(scraped: ScrapedListing) -> str:
    """Derive auction_status from dates and is_completed flag."""
    from datetime import timezone
    if scraped.is_completed:
        return "completed"
    now = datetime.now(timezone.utc)

    def _utc(dt):
        if dt is None:
            return None
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)

    starts = _utc(scraped.sale_starts_at)
    ends = _utc(scraped.sale_ends_at)
    if starts and starts > now:
        return "upcoming"
    if ends and ends < now:
        return "ended"
    return "live"


def _to_mock_listing(scraped: ScrapedListing) -> dict:
    """Convert a ScrapedListing to the MockListing dict shape used by Next.js."""
    global _listing_id_counter

    def _dt(value) -> str | None:
        if value is None:
            return None
        if isinstance(value, (datetime, date)):
            return value.isoformat()
        return str(value)

    platform = PLATFORM_META.get(scraped.platform_slug, {
        "id": 99,
        "name": scraped.platform_slug,
        "display_name": scraped.platform_slug,
        "base_url": "",
        "logo_url": None,
    })

    price = scraped.current_price
    premium_pct = scraped.buyers_premium_pct
    total_estimate: float | None = None
    if price is not None and premium_pct is not None:
        total_estimate = round(price * (1 + premium_pct / 100), 2)

    # Use scraped category if present, otherwise auto-detect from title/description
    category = scraped.category or _auto_categorize(scraped.title, scraped.description)

    mock: dict = {
        "id": _listing_id_counter,
        "platform": platform,
        "external_id": scraped.external_id,
        "external_url": scraped.external_url,
        "title": scraped.title or "Untitled",
        "description": scraped.description,
        "category": category,
        "condition": scraped.condition,
        "current_price": price,
        "final_price": scraped.final_price,
        "is_completed": scraped.is_completed,
        "buyers_premium_pct": premium_pct,
        "total_cost_estimate": total_estimate,
        "auction_status": _compute_status(scraped),
        "pickup_only": scraped.pickup_only,
        "ships_nationally": scraped.ships_nationally,
        "city": scraped.city,
        "state": scraped.state,
        "zip_code": scraped.zip_code,
        "sale_ends_at": _dt(scraped.sale_ends_at),
        "sale_starts_at": _dt(scraped.sale_starts_at),
        "primary_image_url": scraped.primary_image_url,
        "image_urls": scraped.image_urls or [],
        "scraped_at": datetime.utcnow().isoformat(),
        "is_sponsored": False,
        "items": [
            {
                "title": item.title,
                "lot_number": item.lot_number,
                "description": item.description,
                "current_price": item.current_price,
                "estimate_low": item.estimate_low,
                "estimate_high": item.estimate_high,
                "primary_image_url": item.primary_image_url,
                "image_urls": item.image_urls,
                "category": item.category,
                "condition": item.condition,
                "external_url": item.external_url,
            }
            for item in scraped.items
        ],
    }
    _listing_id_counter += 1
    return mock


async def run_scraper(scraper_cls, rate_limiter, max_pages: int, **kwargs) -> list[dict]:
    """Run one scraper and return a list of MockListing dicts."""
    results: list[dict] = []
    scraper = scraper_cls(rate_limiter=rate_limiter)
    try:
        async with scraper:
            async for listing in scraper.scrape_listings(max_pages=max_pages, **kwargs):
                if listing.title and listing.external_url:
                    results.append(_to_mock_listing(listing))
    except Exception as exc:
        logger.warning(f"{scraper_cls.__name__} failed: {exc}")
    return results


async def hydrate(args):
    rate_limiter = TokenBucketRateLimiter(default_rate=0.4)
    all_listings: list[dict] = []
    summary: list[str] = []

    # Map short names → (class, extra kwargs)
    target_map = {
        "la": (LiveAuctioneersScraper,  {"state": args.state}),
        "es": (EstateSalesNetScraper,   {"state": "",         "city": args.city}),  # national (3 per page × max_pages)
        "hi": (HibidScraper,            {"state": "",         "country": "USA"}),   # all US via GraphQL
        "ms": (MaxSoldScraper,          {"state": args.state}),
        "bs": (BidSpotterScraper,       {"state": None}),   # country-wide (all US)
    }

    chosen = [t.strip() for t in args.targets.split(",") if t.strip() in target_map]
    if not chosen:
        logger.error(f"No valid targets in '{args.targets}'. Use: la,es,hi,ms,bs")
        sys.exit(1)

    for key in chosen:
        cls, extra = target_map[key]
        logger.info(f"▶ Running {cls.__name__} (max_pages={args.max_pages}) …")
        results = await run_scraper(cls, rate_limiter, args.max_pages, **extra)
        count = len(results)
        all_listings.extend(results)
        icon = "✓" if count > 0 else "✗"
        label = cls.__name__.replace("Scraper", "")
        summary.append(f"  {icon}  {label}: {count} listings")
        logger.info(f"   {icon} {label}: {count}")

    # Write output
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(all_listings, f, ensure_ascii=False, indent=2)

    print("\n── Hydration Complete ─────────────────────────────────")
    for line in summary:
        print(line)
    print(f"\n  Total : {len(all_listings)} listings")
    print(f"  Output: {out_path.resolve()}")
    print("\n  Restart your Next.js dev server or wait for hot-reload.")
    print("  The app will now serve real scraped data instead of mock data.")
    print("──────────────────────────────────────────────────────\n")


def main():
    parser = argparse.ArgumentParser(
        description="Run Estate Scout scrapers and write real listing data to JSON."
    )
    parser.add_argument("--state",     default="WA",       help="State to scrape for state-filtered scrapers (default: WA)")
    parser.add_argument("--city",      default="",         help="City to filter (optional)")
    parser.add_argument("--max-pages", type=int, default=17, help="Pages per scraper (default: 17; 17×60=1020 BidSpotter listings)")
    parser.add_argument("--targets",   default="ms,bs,hi,es",
                        help="Comma-separated scrapers: la,es,hi,ms,bs (default: ms,bs,hi,es)")
    parser.add_argument("--out",       default=str(DEFAULT_OUT),
                        help=f"Output JSON path (default: {DEFAULT_OUT})")
    args = parser.parse_args()

    asyncio.run(hydrate(args))


if __name__ == "__main__":
    main()
