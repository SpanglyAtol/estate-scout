"""
Background job scheduler using APScheduler.

Scraper tiers
─────────────
Fast tier  (every 30 min)  — quick JSON / JSON-LD scrapers that produce fresh
                              listings within seconds of finishing.

  bs = BidSpotter       JSON API, broad US coverage, ~1-2 min
  es = EstateSales.NET  JSON-LD, national, ~1-3 min
  eb = eBay sold        HTML, price comp data for AI valuation, ~2-3 min

Deep tier  (nightly 01:00 UTC) — slow scrapers that fetch lot-level data or
                              iterate many geo-coordinates.

  hi = HiBid            GraphQL + concurrent lots, ~2-5 min
  ms = MaxSold          13 metro coords, ~5-10 min
  la = LiveAuctioneers  3-layer fallback, ~3-5 min
  pb = Proxibid         auction calendar, ~2-3 min
  et = EBTH             estate items, ~2-3 min
  iv = Invaluable       auction aggregator, ~3-5 min
  az = AuctionZip       local auctioneer directory, ~2-3 min
  dc = Discovery        regional sites, ~5-10 min
  1d = 1stDibs          premium asking prices, ~2-3 min

Archive job (every hour)
─────────────────────────
Copies completed/ended public.listings older than 2 days into archive.listings
(the archive schema added in migration 0004), then marks archived_at on the
public row so the website stops serving stale data.

This keeps public.listings small and fast (only live/upcoming listings) while
archive.listings grows as an unlimited historical record used by the AI
valuation service, market price index, and item fingerprint tracking.

Other scheduled jobs
─────────────────────
  check_alerts         every 2 h — match new listings against user alerts
  refresh_market_index nightly 02:00 UTC — aggregate price_snapshots

To run standalone (without the API):
    python -m app.scheduler
"""

import asyncio
import importlib
import logging
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.services.alert_service import run_alert_checks
from app.services.market_index_service import refresh_market_index

logger = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None

# ── Scraper definitions ───────────────────────────────────────────────────────

FAST_SCRAPERS = [
    {
        "target": "bidspotter",
        "class": "scrapers.sources.bidspotter.BidSpotterScraper",
        "kwargs": {"state": None, "max_pages": 17},
    },
    {
        "target": "estatesales_net",
        "class": "scrapers.sources.estatesales_net.EstateSalesNetScraper",
        "kwargs": {"state": "", "city": "", "max_pages": 10},
    },
    {
        "target": "ebay",
        "class": "scrapers.sources.ebay.EbaySoldListingsScraper",
        "kwargs": {"max_pages": 5},
    },
]

DEEP_SCRAPERS = [
    {
        "target": "hibid",
        "class": "scrapers.sources.hibid.HibidScraper",
        "kwargs": {"state": "", "country": "USA", "max_pages": 17},
    },
    {
        "target": "maxsold",
        "class": "scrapers.sources.maxsold.MaxSoldScraper",
        "kwargs": {"state": "", "max_pages": 5},
    },
    {
        "target": "liveauctioneers",
        "class": "scrapers.sources.liveauctioneers.LiveAuctioneersScraper",
        "kwargs": {"state": "", "max_pages": 10},
    },
    {
        "target": "proxibid",
        "class": "scrapers.sources.proxibid.ProxibidScraper",
        "kwargs": {"state": "", "max_pages": 10},
    },
    {
        "target": "ebth",
        "class": "scrapers.sources.ebth.EbthScraper",
        "kwargs": {"max_pages": 5},
    },
    {
        "target": "invaluable",
        "class": "scrapers.sources.invaluable.InvaluableScraper",
        "kwargs": {"max_pages": 5},
    },
    {
        "target": "auctionzip",
        "class": "scrapers.sources.auctionzip.AuctionZipScraper",
        "kwargs": {"max_pages": 5},
    },
    {
        "target": "discovery",
        "class": "scrapers.sources.discovery.DiscoveryScraper",
        "kwargs": {"max_pages": 3},
    },
    {
        "target": "1stdibs",
        "class": "scrapers.sources.onedibs.OneDibsScraper",
        "kwargs": {"max_pages": 3},
    },
]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _load_class(dotpath: str):
    module_path, class_name = dotpath.rsplit(".", 1)
    module = importlib.import_module(module_path)
    return getattr(module, class_name)


async def _make_db_session() -> AsyncSession:
    engine = create_async_engine(settings.database_url, pool_size=2, max_overflow=0)
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    return factory()


async def _run_scraper_list(specs: list[dict], tier_name: str) -> None:
    """Run a list of scraper specs sequentially, storing results to the DB."""
    from scrapers.rate_limiter import TokenBucketRateLimiter
    from scrapers.storage import ScraperStorage

    logger.info(f"Scheduler [{tier_name}]: starting ({len(specs)} scrapers)")

    db = await _make_db_session()
    storage = ScraperStorage(db_session=db)
    rate_limiter = TokenBucketRateLimiter(default_rate=0.4)

    total = 0
    for spec in specs:
        try:
            scraper_cls = _load_class(spec["class"])
            scraper = scraper_cls(rate_limiter=rate_limiter, storage=storage)
            count = await scraper.run(**spec["kwargs"])
            total += count
            logger.info(f"  [{tier_name}] {spec['target']}: {count} listings")
        except Exception as e:
            logger.error(f"  [{tier_name}] {spec['target']} failed: {e}")

    await db.close()
    logger.info(f"[{tier_name}] complete: {total} listings processed")


# ── Scheduled job functions ───────────────────────────────────────────────────

async def run_fast_scrapers() -> None:
    """Fast tier: BidSpotter, EstateSales.NET, eBay sold — every 30 min."""
    await _run_scraper_list(FAST_SCRAPERS, "fast")


async def run_deep_scrapers() -> None:
    """Deep tier: HiBid, MaxSold, LiveAuctioneers, etc — nightly."""
    await _run_scraper_list(DEEP_SCRAPERS, "deep")


async def run_archive_job() -> None:
    """
    Move ended/completed public.listings (>2 days old) into archive.listings.
    Keeps public.listings small; archive grows as the historical record for AI.
    Runs every hour.
    """
    logger.info("Scheduler [archive]: starting")
    db = await _make_db_session()
    try:
        from scrapers.storage import ScraperStorage
        storage = ScraperStorage(db_session=db)
        count = await storage.batch_archive_ended(cutoff_days=2)
        logger.info(f"[archive] moved {count} listings to archive.listings")
    except Exception as e:
        logger.error(f"[archive] failed: {e}")
    finally:
        await db.close()


async def run_market_index() -> None:
    """Nightly: aggregate price_snapshots → market_price_index."""
    logger.info("Scheduler: refreshing market price index")
    db = await _make_db_session()
    try:
        summary = await refresh_market_index(db)
        logger.info("Market index refresh done: %s", summary)
    except Exception as e:
        logger.error("Market index refresh failed: %s", e)
    finally:
        await db.close()


async def run_alerts() -> None:
    """Check active alerts against newly scraped listings."""
    logger.info("Scheduler: running alert checks")
    db = await _make_db_session()
    try:
        count = await run_alert_checks(db)
        logger.info(f"Alert check done: {count} notifications sent")
    finally:
        await db.close()


# ── Scheduler lifecycle ───────────────────────────────────────────────────────

def get_scheduler() -> AsyncIOScheduler:
    global _scheduler
    if _scheduler is None:
        _scheduler = AsyncIOScheduler(timezone="UTC")

        # Fast tier: every 30 minutes
        _scheduler.add_job(
            run_fast_scrapers,
            trigger=IntervalTrigger(minutes=30),
            id="scrape_fast",
            name="Fast scrapers (BidSpotter, EstateSales, eBay)",
            next_run_time=None,  # first run set explicitly in start_scheduler()
            misfire_grace_time=300,
        )

        # Deep tier: nightly at 01:00 UTC
        _scheduler.add_job(
            run_deep_scrapers,
            trigger="cron",
            hour=1,
            minute=0,
            id="scrape_deep",
            name="Deep scrapers (HiBid, MaxSold, LiveAuctioneers, …)",
            misfire_grace_time=3600,
        )

        # Archive job: every hour
        _scheduler.add_job(
            run_archive_job,
            trigger=IntervalTrigger(hours=1),
            id="archive_ended",
            name="Archive ended listings → archive.listings",
            misfire_grace_time=300,
        )

        # Alert checks: every 2 hours
        _scheduler.add_job(
            run_alerts,
            trigger=IntervalTrigger(hours=2),
            id="check_alerts",
            name="Check alert matches",
            misfire_grace_time=120,
        )

        # Market price index: nightly at 02:00 UTC (after deep scrape)
        _scheduler.add_job(
            run_market_index,
            trigger="cron",
            hour=2,
            minute=0,
            id="refresh_market_index",
            name="Nightly market price index refresh",
            misfire_grace_time=3600,
        )

    return _scheduler


def start_scheduler() -> None:
    sched = get_scheduler()
    if not sched.running:
        sched.start()
        logger.info("APScheduler started (fast/deep tier + archive job)")
        # First fast scrape fires 2 minutes after boot
        sched.modify_job(
            "scrape_fast",
            next_run_time=datetime.now(timezone.utc)
            .__class__.fromtimestamp(
                datetime.now(timezone.utc).timestamp() + 120, tz=timezone.utc
            ),
        )


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        logger.info("APScheduler stopped")


# ── Standalone mode ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys
    from pathlib import Path

    sys.path.insert(0, str(Path(__file__).parent.parent))

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    async def _main():
        logger.info("Running fast scrape cycle once…")
        await run_fast_scrapers()
        logger.info("Running archive job…")
        await run_archive_job()
        logger.info("Running alert checks…")
        await run_alerts()

    asyncio.run(_main())
