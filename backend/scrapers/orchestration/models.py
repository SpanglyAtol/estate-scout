from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone


@dataclass
class RunConfig:
    target: str
    max_pages: int = 5
    dry_run: bool = False
    query: str = ""
    state: str = ""
    city: str = ""


@dataclass
class SourceRunResult:
    target: str
    started_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    finished_at: datetime | None = None
    listing_count: int = 0
    success: bool = False
    error: str | None = None

    def finish(self, *, listing_count: int = 0, success: bool = True, error: str | None = None) -> None:
        self.finished_at = datetime.now(timezone.utc)
        self.listing_count = listing_count
        self.success = success
        self.error = error


@dataclass
class PipelineSummary:
    run_mode: str
    started_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    finished_at: datetime | None = None
    results: list[SourceRunResult] = field(default_factory=list)

    @property
    def total_listings(self) -> int:
        return sum(result.listing_count for result in self.results)

    @property
    def failed_targets(self) -> list[str]:
        return [result.target for result in self.results if not result.success]

    def finish(self) -> None:
        self.finished_at = datetime.now(timezone.utc)
