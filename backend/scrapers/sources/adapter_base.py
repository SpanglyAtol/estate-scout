from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, AsyncIterator

from scrapers.base import ScrapedListing


@dataclass
class AdapterStats:
    pages_fetched: int = 0
    records_seen: int = 0
    listings_emitted: int = 0


class SourceAdapter(ABC):
    """Standard adapter interface for high-volume source integration."""

    def __init__(self, *, platform_slug: str):
        self.platform_slug = platform_slug
        self.stats = AdapterStats()

    @abstractmethod
    async def fetch(self) -> AsyncIterator[Any]:
        """Fetch source payload pages/chunks."""

    @abstractmethod
    def parse(self, payload: Any) -> list[dict]:
        """Parse source payload into source-native records."""

    @abstractmethod
    def normalize(self, record: dict) -> ScrapedListing | None:
        """Map source record into canonical ScrapedListing shape."""

    def emit_stats(self) -> dict:
        return {
            "platform": self.platform_slug,
            "pages_fetched": self.stats.pages_fetched,
            "records_seen": self.stats.records_seen,
            "listings_emitted": self.stats.listings_emitted,
        }

    async def run(self) -> AsyncIterator[ScrapedListing]:
        async for payload in self.fetch():
            self.stats.pages_fetched += 1
            records = self.parse(payload)
            self.stats.records_seen += len(records)
            for record in records:
                listing = self.normalize(record)
                if listing is None:
                    continue
                self.stats.listings_emitted += 1
                yield listing
