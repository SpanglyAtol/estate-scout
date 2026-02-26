"""
Background job scheduler using APScheduler.

Jobs:
  - scrape_all:   runs all active scrapers every 4 hours
  - check_alerts: checks alert matches every 2 hours (after each scrape cycle)

The scheduler is started inside FastAPI's lifespan so it runs
as part of the same process as the API server.

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

logger = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None

# ── Scraper job ───────────────────────────────────────────────────────────────

SCRAPER_TARGETS = [
    {
        "target": "liveauctioneers",
        "class": "scrapers.sources.liveauctioneers.LiveAuctioneersScraper",
        "kwargs": {"state": "WA", "max_pages": 5},
    },
    {
        "target": "estatesales_net",
        "class": "scrapers.sources.estatesales_net.EstateSalesNetScraper",
        "kwargs": {"state": "WA", "city": "Seattle", "max_pages": 5},
    },
    {
        "target": "hibid",
        "class": "scrapers.sources.hibid.HibidScraper",
        "kwargs": {"state": "WA", "max_pages": 5},
    },
    {
        "target": "maxsold",
        "class": "scrapers.sources.maxsold.MaxSoldScraper",
        "kwargs": {"state": "WA", "max_pages": 5},
    },
]


def _load_class(dotpath: str):
    module_path, class_name = dotpath.rsplit(".", 1)
    module = importlib.import_module(module_path)
    return getattr(module, class_name)


async def _make_db_session() -> AsyncSession:
    engine = create_async_engine(settings.database_url, pool_size=2, max_overflow=0)
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    return factory()


async def run_scrapers() -> None:
    """Run all configured scrapers sequentially and store results to DB."""
    from scrapers.rate_limiter import TokenBucketRateLimiter
    from scrapers.storage import ScraperStorage

    logger.info("Scheduler: starting scrape cycle")

    db = await _make_db_session()
    storage = ScraperStorage(db_session=db)
    rate_limiter = TokenBucketRateLimiter(default_rate=0.4)

    total = 0
    for spec in SCRAPER_TARGETS:
        try:
            scraper_cls = _load_class(spec["class"])
            scraper = scraper_cls(rate_limiter=rate_limiter, storage=storage)
            count = await scraper.run(**spec["kwargs"])
            total += count
            logger.info(f"  {spec['target']}: {count} listings")
        except Exception as e:
            logger.error(f"  {spec['target']} failed: {e}")

    await db.close()
    logger.info(f"Scrape cycle complete: {total} listings processed")


async def run_alerts() -> None:
    """Check active alerts against newly scraped listings and send emails."""
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

        # Scrape every 4 hours, starting 60s after launch
        _scheduler.add_job(
            run_scrapers,
            trigger=IntervalTrigger(hours=4),
            id="scrape_all",
            name="Scrape all platforms",
            next_run_time=None,  # don't run immediately on import
            misfire_grace_time=300,
        )

        # Check alerts every 2 hours, offset by 30 minutes
        _scheduler.add_job(
            run_alerts,
            trigger=IntervalTrigger(hours=2),
            id="check_alerts",
            name="Check alert matches",
            misfire_grace_time=120,
        )

    return _scheduler


def start_scheduler() -> None:
    sched = get_scheduler()
    if not sched.running:
        sched.start()
        logger.info("APScheduler started")
        # Schedule first scrape 2 minutes from now so the API has time to boot
        sched.modify_job(
            "scrape_all",
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

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

    async def _main():
        logger.info("Running scrape cycle once…")
        await run_scrapers()
        logger.info("Running alert checks…")
        await run_alerts()

    asyncio.run(_main())
