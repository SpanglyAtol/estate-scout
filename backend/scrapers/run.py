"""
CLI entry point for running scrapers.

Usage:
    python -m scrapers.run --target liveauctioneers --query "ceramics" --state WA
    python -m scrapers.run --target estatesales_net --state WA --city Seattle
    python -m scrapers.run --target liveauctioneers --dry-run  # print only, no DB writes
    python -m scrapers.run --list  # show available scrapers
"""

import argparse
import asyncio
import logging
import sys
from pathlib import Path

# Add backend/ to path so imports work when run from project root
sys.path.insert(0, str(Path(__file__).parent.parent))

from scrapers.rate_limiter import TokenBucketRateLimiter
from scrapers.proxy_pool import ProxyPool
from scrapers.storage import ScraperStorage

SCRAPERS = {
    "liveauctioneers": "scrapers.sources.liveauctioneers.LiveAuctioneersScraper",
    "estatesales_net": "scrapers.sources.estatesales_net.EstateSalesNetScraper",
    "hibid":           "scrapers.sources.hibid.HibidScraper",
    "maxsold":         "scrapers.sources.maxsold.MaxSoldScraper",
    "bidspotter":      "scrapers.sources.bidspotter.BidSpotterScraper",
    "ebay":            "scrapers.sources.ebay.EbaySoldListingsScraper",
    "proxibid":        "scrapers.sources.proxibid.ProxibidScraper",
    "1stdibs":         "scrapers.sources.onedibs.OneDibsScraper",
    "ebth":            "scrapers.sources.ebth.EbthScraper",
    "invaluable":      "scrapers.sources.invaluable.InvaluableScraper",
    "auctionzip":      "scrapers.sources.auctionzip.AuctionZipScraper",
    "discovery":       "scrapers.sources.discovery.DiscoveryScraper",
}

# Curated "national" run: all broadly-available public sources.
NATIONAL_TARGETS = [
    "bidspotter",
    "hibid",
    "estatesales_net",
    "maxsold",
    "ebay",
    "proxibid",
    "ebth",
    "invaluable",
    "auctionzip",
    "discovery",
]

# Per-target kwargs used for national runs.
NATIONAL_KWARGS = {
    "bidspotter": {"state": None},
    "hibid": {"state": "", "country": "USA"},
    "estatesales_net": {"state": ""},
    "maxsold": {"state": ""},
    "proxibid": {"state": ""},
}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("scrapers.run")


def load_scraper_class(dotpath: str):
    module_path, class_name = dotpath.rsplit(".", 1)
    import importlib
    module = importlib.import_module(module_path)
    return getattr(module, class_name)


async def run(args):
    if args.list:
        print("Available scrapers:")
        for name in SCRAPERS:
            print(f"  {name}")
        print("  national")
        return

    if args.target != "national" and args.target not in SCRAPERS:
        logger.error(f"Unknown scraper target: {args.target}")
        logger.error(f"Available: {', '.join(list(SCRAPERS.keys()) + ['national'])}")
        sys.exit(1)

    # Set up infrastructure
    rate_limiter = TokenBucketRateLimiter(default_rate=0.5)

    proxy_pool = None
    if args.proxy_urls:
        proxy_pool = ProxyPool.from_csv(args.proxy_urls)
        logger.info(f"Using {proxy_pool.total_count} proxies")

    storage = None
    if not args.dry_run:
        if args.jsonl_output:
            storage = ScraperStorage(jsonl_path=args.jsonl_output)
            logger.info(f"Writing to JSONL: {args.jsonl_output}")
        else:
            # DB mode - requires DATABASE_URL env var
            import os
            from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
            db_url = os.environ.get("DATABASE_URL", "")
            if not db_url:
                logger.error("DATABASE_URL not set. Use --dry-run or --jsonl-output for offline mode.")
                sys.exit(1)
            engine = create_async_engine(db_url)
            session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
            async with session_factory() as session:
                storage = ScraperStorage(db_session=session)
                if args.target == "national":
                    await _run_national(args, rate_limiter, proxy_pool, storage)
                else:
                    await _run_scraper(args, rate_limiter, proxy_pool, storage)
            await engine.dispose()
            return

    if args.target == "national":
        await _run_national(args, rate_limiter, proxy_pool, storage)
        return

    await _run_scraper(args, rate_limiter, proxy_pool, storage)


async def _run_national(args, rate_limiter, proxy_pool, storage):
    total = 0
    logger.info(f"Starting national scrape across {len(NATIONAL_TARGETS)} sources")

    for target in NATIONAL_TARGETS:
        scraper_cls = load_scraper_class(SCRAPERS[target])
        scraper = scraper_cls(rate_limiter=rate_limiter, proxy_pool=proxy_pool, storage=storage)
        kwargs = {
            "max_pages": args.max_pages,
            **NATIONAL_KWARGS.get(target, {}),
        }
        logger.info(f"Starting {target} scraper {'(dry run)' if args.dry_run else ''}")
        count = await scraper.run(**kwargs)
        total += count
        logger.info(f"Done {target}: {count} listings")

    logger.info(f"National scrape complete. Processed {total} listings across all sources.")


async def _run_scraper(args, rate_limiter, proxy_pool, storage):
    scraper_cls = load_scraper_class(SCRAPERS[args.target])
    scraper = scraper_cls(
        rate_limiter=rate_limiter,
        proxy_pool=proxy_pool,
        storage=storage,
    )

    kwargs = {}
    if hasattr(args, "query") and args.query:
        kwargs["query"] = args.query
    if hasattr(args, "state") and args.state:
        kwargs["state"] = args.state
    if hasattr(args, "city") and args.city:
        kwargs["city"] = args.city
    if hasattr(args, "max_pages") and args.max_pages:
        kwargs["max_pages"] = args.max_pages

    logger.info(f"Starting {args.target} scraper {'(dry run)' if args.dry_run else ''}")
    count = await scraper.run(**kwargs)
    logger.info(f"Done. Processed {count} listings.")


def main():
    parser = argparse.ArgumentParser(description="Estate Scout scraper CLI")
    parser.add_argument("--target", help="Scraper to run (e.g. liveauctioneers, national)")
    parser.add_argument("--list", action="store_true", help="List available scrapers")
    parser.add_argument("--dry-run", action="store_true", help="Print listings without saving")
    parser.add_argument("--query", default="", help="Search query")
    parser.add_argument("--state", default="WA", help="State abbreviation (e.g. WA)")
    parser.add_argument("--city", default="", help="City name")
    parser.add_argument("--max-pages", type=int, default=5, help="Max pages to scrape")
    parser.add_argument("--proxy-urls", default="", help="Comma-separated proxy URLs")
    parser.add_argument("--jsonl-output", default="", help="Path to write JSONL output file")
    args = parser.parse_args()

    if not args.list and not args.target:
        parser.print_help()
        sys.exit(1)

    asyncio.run(run(args))


if __name__ == "__main__":
    main()
