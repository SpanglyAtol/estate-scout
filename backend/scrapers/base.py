import asyncio
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import AsyncIterator

import httpx


@dataclass
class ScrapedListing:
    """
    Normalized output schema all scrapers must produce.
    Every source platform gets mapped to this shape before storage.
    """
    platform_slug: str           # 'liveauctioneers', 'estatesales_net', etc.
    external_id: str             # platform's own unique ID for this listing
    external_url: str            # click-through URL (we never transact directly)
    title: str

    description: str | None = None
    category: str | None = None
    condition: str | None = None

    # Pricing
    current_price: float | None = None
    start_price: float | None = None
    buy_now_price: float | None = None
    buyers_premium_pct: float | None = None
    final_price: float | None = None
    is_completed: bool = False
    auction_status: str | None = None  # 'upcoming' | 'live' | 'ended' | 'completed'
    currency: str = "USD"

    # Fulfillment
    pickup_only: bool = False
    ships_nationally: bool = True
    shipping_estimate: float | None = None

    # Location
    city: str | None = None
    state: str | None = None
    zip_code: str | None = None
    country: str = "US"
    latitude: float | None = None
    longitude: float | None = None

    # Timing
    sale_starts_at: datetime | None = None
    sale_ends_at: datetime | None = None

    # Media
    primary_image_url: str | None = None
    image_urls: list[str] = field(default_factory=list)

    # Raw payload for debugging / schema evolution
    raw_data: dict = field(default_factory=dict)


class BaseScraper(ABC):
    platform_slug: str = ""
    base_url: str = ""
    default_rate_limit: float = 0.5  # requests/second (conservative)

    def __init__(
        self,
        rate_limiter=None,
        proxy_pool=None,
        storage=None,
    ):
        self.logger = logging.getLogger(f"scraper.{self.platform_slug or type(self).__name__}")
        self.rate_limiter = rate_limiter
        self.proxy_pool = proxy_pool
        self.storage = storage
        self._session: httpx.AsyncClient | None = None

    async def __aenter__(self):
        proxy = self.proxy_pool.get_next() if self.proxy_pool else None
        # httpx >= 0.24 removed the `proxies` kwarg; use `mounts` instead.
        client_kwargs: dict = {
            "headers": {"User-Agent": self._user_agent()},
            "timeout": httpx.Timeout(30.0, connect=10.0),
            "follow_redirects": True,
        }
        if proxy:
            transport = httpx.AsyncHTTPTransport(proxy=proxy)
            client_kwargs["mounts"] = {
                "http://": transport,
                "https://": transport,
            }
        self._session = httpx.AsyncClient(**client_kwargs)
        return self

    async def __aexit__(self, *args):
        if self._session:
            await self._session.aclose()

    def _user_agent(self) -> str:
        return (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/122.0.0.0 Safari/537.36"
        )

    def _browser_headers(self, referer: str = "") -> dict:
        """Full Chrome-like headers that pass most bot-detection checks."""
        h = {
            "User-Agent": self._user_agent(),
            "Accept": (
                "text/html,application/xhtml+xml,application/xml;"
                "q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8"
            ),
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
            "DNT": "1",
            "Upgrade-Insecure-Requests": "1",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none" if not referer else "same-origin",
            "Sec-Ch-Ua": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
        }
        if referer:
            h["Referer"] = referer
        return h

    async def _fetch(self, url: str, **kwargs) -> httpx.Response:
        """Rate-limited fetch with exponential backoff on 429/503."""
        if self.rate_limiter:
            await self.rate_limiter.acquire(self.platform_slug)

        # Inject browser headers unless caller already provided headers
        if "headers" not in kwargs:
            kwargs["headers"] = self._browser_headers()

        for attempt in range(3):
            try:
                response = await self._session.get(url, **kwargs)
                if response.status_code in (429, 503):
                    wait = 2 ** attempt * 5
                    self.logger.warning(f"Rate limited ({response.status_code}), waiting {wait}s")
                    await asyncio.sleep(wait)
                    continue
                response.raise_for_status()
                return response
            except httpx.HTTPStatusError:
                if attempt == 2:
                    raise
                await asyncio.sleep(2 ** attempt)
        raise RuntimeError(f"Failed to fetch {url} after 3 attempts")

    @abstractmethod
    async def scrape_listings(self, **kwargs) -> AsyncIterator[ScrapedListing]:
        """
        Async generator that yields normalized ScrapedListing objects.
        Implementations handle pagination internally.
        """
        ...

    @abstractmethod
    async def scrape_listing_detail(self, external_id: str) -> ScrapedListing | None:
        """Fetch a single listing for enrichment/updates."""
        ...

    async def run(self, **kwargs) -> int:
        """Execute a full scrape run. Returns count of listings processed."""
        count = 0
        async with self:
            async for listing in self.scrape_listings(**kwargs):
                if self.storage:
                    await self.storage.upsert(listing)
                else:
                    self.logger.info(f"[DRY RUN] {listing.platform_slug}: {listing.title[:60]}")
                count += 1
        self.logger.info(f"Scraped {count} listings from {self.platform_slug}")
        return count
