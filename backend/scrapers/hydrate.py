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
                            - BidSpotter: 17 × 60  = ~1020 listings
                            - HiBid: 17 × 100      = ~1700 auctions (GraphQL)
                            - EstateSales.NET: 17 × 3 = ~51 listings (JSON-LD)
                            - eBay: 5 × 48 × 5 cats = ~1200 sold comps (price data)
                            - Proxibid: 10 × ~20   = ~200 auction events
                            - 1stDibs: 3 pages × 6 queries = ~price reference data
  --out PATH              Output JSON path (default: apps/web/src/data/scraped-listings.json)
  --national              Shortcut: all public scrapers, state="" (national)
  --targets bs,hi,es,ms  Comma-separated scrapers (default: bs,hi,es,ms)
                            ms=maxsold      – HTML scraper, WA only
                            bs=bidspotter   – JSON API, all US
                            hi=hibid        – GraphQL API, all US (now with lot items)
                            es=estatesales  – JSON-LD, all US (~3/page)
                            la=liveauctioneers – 3-layer anti-403 strategy
                            eb=ebay         – sold listings price comps
                            pb=proxibid     – auction calendar events
                            1d=1stdibs      – premium antiques asking prices
                            et=ebth         – Everything But The House estate items
                            iv=invaluable   – Invaluable auction aggregator
                            az=auctionzip   – AuctionZip local auctioneer directory
                            dc=discovery    – regional/local sites (Handbid, AuctionFlex, NAA directory, DDG search)

Notes:
  - LiveAuctioneers now uses a 3-layer fallback (JSON API → HTML → sitemap).
  - eBay/Proxibid/1stDibs are new; add them to --targets to enable.
  - Run this periodically (e.g., daily via GitHub Actions) to keep data fresh.
"""

import argparse
import asyncio
import json
import logging
import os
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
from scrapers.sources.ebay import EbaySoldListingsScraper
from scrapers.sources.proxibid import ProxibidScraper
from scrapers.sources.onedibs import OneDibsScraper
from scrapers.sources.ebth import EbthScraper
from scrapers.sources.invaluable import InvaluableScraper
from scrapers.sources.auctionzip import AuctionZipScraper
from scrapers.sources.discovery import DiscoveryScraper
from scrapers.base import ScrapedListing
from scrapers.geocoder import geocode_listings
from scrapers.enricher import enrich, auto_categorize, CATEGORY_KEYWORDS

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
    "ebay": {
        "id": 6,
        "name": "ebay",
        "display_name": "eBay",
        "base_url": "https://www.ebay.com",
        "logo_url": None,
    },
    "proxibid": {
        "id": 7,
        "name": "proxibid",
        "display_name": "Proxibid",
        "base_url": "https://www.proxibid.com",
        "logo_url": None,
    },
    "1stdibs": {
        "id": 8,
        "name": "1stdibs",
        "display_name": "1stDibs",
        "base_url": "https://www.1stdibs.com",
        "logo_url": None,
    },
    "ebth": {
        "id": 9,
        "name": "ebth",
        "display_name": "EBTH",
        "base_url": "https://www.ebth.com",
        "logo_url": None,
    },
    "invaluable": {
        "id": 10,
        "name": "invaluable",
        "display_name": "Invaluable",
        "base_url": "https://www.invaluable.com",
        "logo_url": None,
    },
    "auctionzip": {
        "id": 11,
        "name": "auctionzip",
        "display_name": "AuctionZip",
        "base_url": "https://www.auctionzip.com",
        "logo_url": None,
    },
    "discovery": {
        "id": 12,
        "name": "discovery",
        "display_name": "Regional Auction (Discovered)",
        "base_url": "",
        "logo_url": None,
    },
}


def _get_platform_meta(platform_slug: str, site_url: str = "") -> dict:
    """
    Resolve platform metadata for a given slug.

    Known platforms return their static PLATFORM_META entry.
    Dynamically discovered sites (platform_slug starts with 'discovery_')
    have their metadata constructed on the fly from the slug so the frontend
    always has a valid display_name / base_url.
    """
    if platform_slug in PLATFORM_META:
        return PLATFORM_META[platform_slug]
    if platform_slug.startswith("discovery_"):
        # discovery_grafeauction_com → "Grafeauction Com"
        domain_label = (
            platform_slug
            .replace("discovery_", "", 1)
            .replace("_", " ")
            .replace("-", " ")
            .title()
        )
        return {
            "id": abs(hash(platform_slug)) % 9000 + 1000,
            "name": platform_slug,
            "display_name": domain_label,
            "base_url": site_url or "",
            "logo_url": None,
        }
    return {
        "id": 99,
        "name": platform_slug,
        "display_name": platform_slug,
        "base_url": "",
        "logo_url": None,
    }

_listing_id_counter = 1

# ── US state validation ───────────────────────────────────────────────────────
_US_STATES = {
    "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN",
    "IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV",
    "NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN",
    "TX","UT","VT","VA","WA","WV","WI","WY","DC",
}

# ── Relevance filtering ───────────────────────────────────────────────────────
# Keywords that indicate non-antique / non-estate-sale content to exclude.
# Match is on lowercased title — partial substring match.
_EXCLUDE_TITLE_KEYWORDS = [
    # Vehicles (broad)
    "pickup truck", "box van", "motorhome", "caravan", "forklift",
    "excavator", "tractor", "crane", "bulldozer", "backhoe",
    "motorcycle", " quad ", "atv ", "snowmobile",
    "van clearance", "van auction", "car auction", "vehicle auction",
    "truck auction", "fleet auction", "auto auction",
    "transit van", "luton van", "panel van", "tipper truck",
    # Heavy industrial
    "cnc machine", "hydraulic press", "metal lathe", " lathe ",
    "compressor", "warehouse equipment", "industrial machinery",
    "pallet rack", "conveyor", "generator set",
    "diesel generator", "air compressor", "milling machine",
    "industrial equipment", "factory equipment", "plant equipment",
    # Commercial / restaurant
    "restaurant equipment", "commercial kitchen", "catering equipment",
    "deep fryer", "commercial oven", "walk-in cooler",
    # Construction / site
    "scaffolding", "concrete mixer", "power tool lot",
    "site closure", "site clearance", "plant hire",
    "closing down sale", "liquidation sale", "clearance auction",
    "business liquidation", "company liquidation",
    # Real estate / property
    "real estate", "land for sale", "acre lot", "building lot",
    "commercial property", "residential property",
    # Livestock / agricultural
    "cattle", "livestock", " hay ", "grain bin", "farm equipment",
    # Electronics bulk / telecom
    "pallet of electronics", "bulk phones", "sim cards", "refurbished phones",
    # Clearly off-topic UK auction terms
    "luton", "pickups, box", "vans, motorhome",
    # Generic low-value bulk
    "pallet lot", "truckload", "mixed pallet",
]

# City / location strings that are NOT real place names — placeholder text that
# scrapers sometimes copy verbatim from listing descriptions.
_GARBAGE_CITY_PATTERNS = [
    "see description", "check description", "call for", "contact us",
    "tbd", "t.b.d", "varies", "multiple locations", "various locations",
    "see listing", "see details", "view listing", "refer to",
    "location tba", "location tbd", "nationwide", "pick up only",
    "no location", "not specified", "please read", "see auction",
]

# Platform-level listing_type overrides (these platforms always produce a
# specific type regardless of what the scraper sets)
_PLATFORM_LISTING_TYPE: dict[str, str] = {
    "estatesales_net": "estate_sale",
    "maxsold":         "estate_sale",
}

# Keywords suggesting a listing covers multiple items (a "lot")
_LOT_KEYWORDS = [
    "lot of", " lots ", "group of", "collection of", "box of",
    "set of ", "pair of", "assorted", "various ", "multiple ",
    "estate contents", "entire contents", "household items",
    "box lot", "tray lot", "shelf lot",
]


def _clean_location(city: str | None, state: str | None) -> tuple[str | None, str | None]:
    """
    Return (clean_city, clean_state).
    If city is a garbage placeholder string, returns (None, state) so the
    listing isn't given a fake location that breaks map / proximity features.
    """
    if city:
        city_lower = city.lower().strip()
        for pattern in _GARBAGE_CITY_PATTERNS:
            if pattern in city_lower:
                return None, state
        # Also reject very long city strings — real city names are < 40 chars
        if len(city.strip()) > 40:
            return None, state
    return city, state


def _is_relevant(listing: dict) -> bool:
    """Return False for listings that are clearly off-topic or non-US."""
    title = (listing.get("title") or "").lower()

    # Reject known off-topic title patterns
    for kw in _EXCLUDE_TITLE_KEYWORDS:
        if kw in title:
            return False

    # Reject non-US listings: if state is set it must be a valid US abbreviation
    state = (listing.get("state") or "").strip().upper()
    if state and state not in _US_STATES:
        return False

    # Reject listings with absolutely no useful data (no image, no price, no description)
    has_image = bool(listing.get("primary_image_url"))
    has_price = (
        listing.get("current_price") is not None
        or listing.get("estimate_low") is not None
        or listing.get("buy_now_price") is not None
    )
    has_description = bool(listing.get("description") or listing.get("title", "").strip())
    if not has_image and not has_price and not has_description:
        return False

    return True


# _CATEGORY_KEYWORDS and _auto_categorize have been replaced by enricher.py.
# Import CATEGORY_KEYWORDS and auto_categorize from there if needed for reference.


def _compute_status(scraped: ScrapedListing) -> str:
    """Derive auction_status from dates and is_completed flag.

    Timezone handling: scrapers that preserve tz info (e.g. EstateSales.NET via
    dateutil) will have aware datetimes and compare correctly against UTC now.
    Scrapers that strip tz info (e.g. HiBid's custom strptime loop) yield naive
    datetimes.  We treat those as UTC — the most common case for US auctions —
    but apply a ±12-hour grace window when marking a naive-datetime listing as
    "ended" to avoid false positives caused by local-time offsets.
    """
    from datetime import timedelta, timezone
    if scraped.is_completed:
        return "completed"
    now = datetime.now(timezone.utc)

    def _utc(dt):
        if dt is None:
            return None
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)

    def _is_naive(dt) -> bool:
        return dt is not None and dt.tzinfo is None

    starts = _utc(scraped.sale_starts_at)
    ends = _utc(scraped.sale_ends_at)

    if starts and starts > now:
        return "upcoming"
    # Apply 12-hour grace window for naive end-datetimes to absorb timezone
    # uncertainty before declaring a listing ended.
    grace = timedelta(hours=12) if _is_naive(scraped.sale_ends_at) else timedelta(0)
    if ends and ends + grace < now:
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

    platform = _get_platform_meta(scraped.platform_slug, scraped.external_url)

    price = scraped.current_price
    premium_pct = scraped.buyers_premium_pct
    total_estimate: float | None = None
    if price is not None and premium_pct is not None:
        total_estimate = round(price * (1 + premium_pct / 100), 2)

    # Derive listing-level estimate from item estimates if not explicitly set
    item_lows  = [i.estimate_low  for i in scraped.items if i.estimate_low  is not None]
    item_highs = [i.estimate_high for i in scraped.items if i.estimate_high is not None]
    est_low  = scraped.estimate_low  if scraped.estimate_low  is not None else (min(item_lows)  if item_lows  else None)
    est_high = scraped.estimate_high if scraped.estimate_high is not None else (max(item_highs) if item_highs else None)

    # ── listing_type ─────────────────────────────────────────────────────────
    # Platform override takes priority (EstateSales.NET / MaxSold are always
    # estate sales regardless of what the scraper field says)
    lt = _PLATFORM_LISTING_TYPE.get(scraped.platform_slug) or scraped.listing_type or "auction"
    if scraped.buy_now_price is not None and lt == "auction":
        lt = "buy_now"

    # ── item_type ─────────────────────────────────────────────────────────────
    # Classifies what kind of thing this listing IS, which drives homepage
    # section placement:
    #   individual_item  → featured items grid (single antique/collectible)
    #   lot              → box/group of items auctioned together
    #   estate_sale      → in-person or timed estate sale event
    #   auction_catalog  → multi-lot auction house catalog
    title_lower = (scraped.title or "").lower()
    if lt == "estate_sale":
        item_type = "estate_sale"
    elif scraped.items and len(scraped.items) > 1:
        # Has embedded item list — it's an auction catalog or estate sale
        item_type = "auction_catalog"
    elif any(kw in title_lower for kw in _LOT_KEYWORDS):
        item_type = "lot"
    else:
        item_type = "individual_item"

    # Use scraped category if present, otherwise auto-detect from title/description
    category = scraped.category or auto_categorize(scraped.title, scraped.description)

    # Enrich with structured attributes (maker, brand, period, etc.)
    # If the ScrapedListing was already enriched at scrape time, these fields
    # will be set; otherwise we run enrichment here.
    if not scraped.maker and not scraped.attributes:
        enriched = enrich(scraped.title, scraped.description, category)
    else:
        enriched = {
            "maker": scraped.maker,
            "brand": scraped.brand,
            "collaboration_brands": scraped.collaboration_brands,
            "period": scraped.period,
            "country_of_origin": scraped.country_of_origin,
            "attributes": scraped.attributes,
        }

    # Write enrichment + category back onto the ScrapedListing so the DB write
    # (which works from the raw object) gets the fully-enriched version.
    scraped.category = category
    scraped.maker = enriched.get("maker") or scraped.maker
    scraped.brand = enriched.get("brand") or scraped.brand
    scraped.period = enriched.get("period") or scraped.period
    scraped.country_of_origin = enriched.get("country_of_origin") or scraped.country_of_origin
    scraped.collaboration_brands = enriched.get("collaboration_brands") or scraped.collaboration_brands or []
    scraped.attributes = enriched.get("attributes") or scraped.attributes or {}

    mock: dict = {
        "id": _listing_id_counter,
        "platform": platform,
        "external_id": scraped.external_id,
        "external_url": scraped.external_url,
        "title": scraped.title or "Untitled",
        "description": scraped.description,
        "category": category,
        "condition": scraped.condition,
        "listing_type": lt,
        "item_type": item_type,
        "current_price": price,
        "buy_now_price": scraped.buy_now_price,
        "estimate_low": est_low,
        "estimate_high": est_high,
        "final_price": scraped.final_price,
        "is_completed": scraped.is_completed,
        "buyers_premium_pct": premium_pct,
        "total_cost_estimate": total_estimate,
        "auction_status": _compute_status(scraped),
        "pickup_only": scraped.pickup_only,
        "ships_nationally": scraped.ships_nationally,
        # Clean location: null out garbage placeholder city strings
        **dict(zip(("city", "state"), _clean_location(scraped.city, scraped.state))),
        "zip_code": scraped.zip_code,
        "sale_ends_at": _dt(scraped.sale_ends_at),
        "sale_starts_at": _dt(scraped.sale_starts_at),
        "primary_image_url": scraped.primary_image_url,
        "image_urls": scraped.image_urls or [],
        "latitude": scraped.latitude,
        "longitude": scraped.longitude,
        "scraped_at": datetime.utcnow().isoformat(),
        "is_sponsored": False,
        # ── Enriched structured fields ─────────────────────────────────────────
        "maker": enriched.get("maker"),
        "brand": enriched.get("brand"),
        "collaboration_brands": enriched.get("collaboration_brands") or [],
        "period": enriched.get("period"),
        "country_of_origin": enriched.get("country_of_origin"),
        "sub_category": enriched.get("sub_category"),
        "attributes": enriched.get("attributes") or {},
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


async def run_scraper(scraper_cls, rate_limiter, max_pages: int, **kwargs) -> tuple[list[ScrapedListing], list[dict]]:
    """Run one scraper; returns (raw ScrapedListing objects, MockListing dicts)."""
    raw: list[ScrapedListing] = []
    results: list[dict] = []
    scraper = scraper_cls(rate_limiter=rate_limiter)
    try:
        async with scraper:
            async for listing in scraper.scrape_listings(max_pages=max_pages, **kwargs):
                if listing.title and listing.external_url:
                    raw.append(listing)
                    results.append(_to_mock_listing(listing))  # also enriches listing in-place
    except Exception as exc:
        logger.warning(f"{scraper_cls.__name__} failed: {exc}")
    return raw, results


async def run_scraper_with_label(
    scraper_cls,
    rate_limiter: TokenBucketRateLimiter,
    max_pages: int,
    **kwargs,
) -> tuple[str, list[ScrapedListing], list[dict]]:
    """Run one scraper concurrently; returns (label, raw listings, dicts)."""
    label = scraper_cls.__name__.replace("Scraper", "")
    logger.info(f"▶ Starting {label} …")
    raw, results = await run_scraper(scraper_cls, rate_limiter, max_pages, **kwargs)
    icon = "✓" if results else "✗"
    logger.info(f"  {icon} {label}: {len(results)} listings")
    return label, raw, results


async def _write_to_db(database_url: str, listings: list[ScrapedListing]) -> None:
    """Batch-upsert scraped listings into Supabase / PostgreSQL."""
    try:
        from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
        from sqlalchemy.pool import NullPool
        from scrapers.storage import ScraperStorage
    except ImportError:
        logger.warning("DB deps not installed (asyncpg/sqlalchemy) — skipping DB write")
        return

    connect_args: dict = {}
    if "supabase.co" in database_url:
        connect_args["ssl"] = "require"

    engine = create_async_engine(database_url, connect_args=connect_args, poolclass=NullPool)
    SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    try:
        async with SessionLocal() as session:
            storage = ScraperStorage(db_session=session)
            ok = await storage.batch_upsert(listings)
            logger.info(f"DB: upserted {ok}/{len(listings)} listings → Supabase")
    except Exception as e:
        logger.error(f"DB write failed: {e}")
    finally:
        await engine.dispose()


async def hydrate(args):
    # Each platform gets its own per-domain bucket inside the shared limiter,
    # so running scrapers in parallel is safe — they don't share tokens.
    rate_limiter = TokenBucketRateLimiter(default_rate=0.4)

    # Map short names → (class, extra kwargs)
    target_map = {
        "la": (LiveAuctioneersScraper,   {"state": args.state}),
        "es": (EstateSalesNetScraper,    {"state": "",         "city": args.city}),  # national
        "hi": (HibidScraper,             {"state": "",         "country": "USA"}),   # all US via GraphQL
        "ms": (MaxSoldScraper,           {"state": args.state}),
        "bs": (BidSpotterScraper,        {"state": None}),    # country-wide (all US)
        "eb": (EbaySoldListingsScraper,  {}),                  # eBay sold comps (all antique cats)
        "pb": (ProxibidScraper,          {"state": ""}),       # all US auction events
        "1d": (OneDibsScraper,           {}),                  # 1stDibs premium asking prices
        "et": (EbthScraper,              {}),                  # EBTH estate sale items
        "iv": (InvaluableScraper,        {}),                  # Invaluable auction aggregator
        "az": (AuctionZipScraper,        {}),                  # AuctionZip local auctioneer directory
        "dc": (DiscoveryScraper,         {}),                  # discovery: regional/local auction sites
    }

    chosen = [t.strip() for t in args.targets.split(",") if t.strip() in target_map]
    if not chosen:
        logger.error(f"No valid targets in '{args.targets}'. Use: la,es,hi,ms,bs,eb,pb,1d,et,iv,az,dc")
        sys.exit(1)

    # ── Parallel execution ────────────────────────────────────────────────────
    # Each scraper uses a different domain key inside the TokenBucketRateLimiter,
    # so they can run simultaneously without violating per-platform rate limits.
    # asyncio.gather() runs all coroutines concurrently within the single event loop.
    logger.info(f"Running {len(chosen)} scrapers in parallel: {', '.join(chosen)}")

    tasks = [
        run_scraper_with_label(
            target_map[key][0],   # scraper class
            rate_limiter,
            args.max_pages,
            **target_map[key][1], # extra kwargs
        )
        for key in chosen
    ]

    # Return results as they finish (gather preserves task order)
    reports: list[tuple[str, list[ScrapedListing], list[dict]]] = await asyncio.gather(*tasks)

    all_raw: list[ScrapedListing] = []
    all_listings: list[dict] = []
    summary: list[str] = []
    for label, raw, results in reports:
        count = len(results)
        all_raw.extend(raw)
        all_listings.extend(results)
        icon = "✓" if count > 0 else "✗"
        summary.append(f"  {icon}  {label}: {count} listings")

    # Geocode city+state → lat/lon (cached; only new cities hit the API)
    logger.info("Running geocoder …")
    all_listings = await geocode_listings(all_listings)

    # Remove off-topic / non-US listings
    before_filter = len(all_listings)
    all_listings = [l for l in all_listings if _is_relevant(l)]
    filtered_out = before_filter - len(all_listings)
    if filtered_out:
        logger.info(f"Relevance filter: removed {filtered_out} off-topic/non-US listings")

    # Write to Supabase if DATABASE_URL is configured
    database_url = os.environ.get("DATABASE_URL", "")
    if database_url:
        await _write_to_db(database_url, all_raw)
    else:
        logger.info("DATABASE_URL not set — skipping DB write (JSON only)")

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
    parser.add_argument("--state",     default="",
                        help="State for state-filtered scrapers (default: '' = national mode)")
    parser.add_argument("--city",      default="",         help="City to filter (optional)")
    parser.add_argument("--max-pages", type=int, default=17,
                        help="Pages per scraper (default: 17; 17×60=~1020 BidSpotter listings)")
    parser.add_argument("--national",  action="store_true",
                        help="Shortcut: run all national scrapers (bs,hi,es,ms,eb,pb) with state=''")
    parser.add_argument("--targets",   default="bs,hi,es,ms",
                        help="Comma-separated scrapers: la,es,hi,ms,bs,eb,pb,1d (default: bs,hi,es,ms)")
    parser.add_argument("--out",       default=str(DEFAULT_OUT),
                        help=f"Output JSON path (default: {DEFAULT_OUT})")
    args = parser.parse_args()

    # --national shortcut: all public scrapers with no state filter
    if args.national:
        args.targets = "bs,hi,es,ms,eb,pb,et,iv,az,dc"
        args.state = ""

    asyncio.run(hydrate(args))


if __name__ == "__main__":
    main()
