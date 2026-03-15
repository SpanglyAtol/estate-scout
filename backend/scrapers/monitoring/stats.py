from __future__ import annotations

import json
import logging
from dataclasses import asdict

from scrapers.orchestration.models import PipelineSummary


class ScrapeMetricsReporter:
    """Structured run metrics logger for scraper orchestration runs."""

    def __init__(self, logger: logging.Logger) -> None:
        self.logger = logger

    def emit_summary(self, summary: PipelineSummary) -> None:
        payload = {
            "run_mode": summary.run_mode,
            "total_listings": summary.total_listings,
            "failed_targets": summary.failed_targets,
            "started_at": summary.started_at.isoformat(),
            "finished_at": summary.finished_at.isoformat() if summary.finished_at else None,
            "sources": [
                {
                    **asdict(result),
                    "started_at": result.started_at.isoformat(),
                    "finished_at": result.finished_at.isoformat() if result.finished_at else None,
                }
                for result in summary.results
            ],
        }
        self.logger.info("scrape_pipeline_summary=%s", json.dumps(payload, ensure_ascii=False))
