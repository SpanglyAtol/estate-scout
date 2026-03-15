from __future__ import annotations

import logging

from scrapers.monitoring.stats import ScrapeMetricsReporter
from scrapers.orchestration.models import PipelineSummary, SourceRunResult
from scrapers.orchestration.registry import NATIONAL_KWARGS, load_scraper_class

logger = logging.getLogger("scrapers.executor")


async def run_targets(
    *,
    targets: list[str],
    base_kwargs: dict,
    rate_limiter,
    proxy_pool,
    storage,
    run_mode: str,
) -> PipelineSummary:
    summary = PipelineSummary(run_mode=run_mode)

    for target in targets:
        result = SourceRunResult(target=target)
        summary.results.append(result)
        try:
            scraper_cls = load_scraper_class(target)
            scraper = scraper_cls(rate_limiter=rate_limiter, proxy_pool=proxy_pool, storage=storage)
            kwargs = {**base_kwargs, **NATIONAL_KWARGS.get(target, {})}
            count = await scraper.run(**kwargs)
            result.finish(listing_count=count, success=True)
            logger.info("%s completed: %s listings", target, count)
        except Exception as exc:
            result.finish(success=False, error=str(exc))
            logger.exception("%s failed: %s", target, exc)

    summary.finish()
    ScrapeMetricsReporter(logger).emit_summary(summary)
    return summary
