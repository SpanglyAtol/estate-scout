import asyncio
import logging
import time
from collections import defaultdict

logger = logging.getLogger(__name__)


class TokenBucketRateLimiter:
    """
    Per-domain token bucket rate limiter.
    Default: 0.5 req/s (one request every 2 seconds) per domain.
    Prevents hammering any single platform regardless of concurrency.
    """

    def __init__(self, default_rate: float = 0.5):
        self.default_rate = default_rate
        self._buckets: dict[str, dict] = defaultdict(
            lambda: {
                "tokens": 1.0,
                "last_refill": time.monotonic(),
                "rate": default_rate,
            }
        )
        self._locks: dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)

    def set_rate(self, domain: str, rate: float):
        """Override rate for a specific platform (calls/second)."""
        self._buckets[domain]["rate"] = rate
        logger.debug(f"Rate for {domain} set to {rate} req/s")

    async def acquire(self, domain: str):
        """Block until a token is available for the given domain."""
        async with self._locks[domain]:
            bucket = self._buckets[domain]
            now = time.monotonic()
            elapsed = now - bucket["last_refill"]
            bucket["tokens"] = min(1.0, bucket["tokens"] + elapsed * bucket["rate"])
            bucket["last_refill"] = now

            if bucket["tokens"] < 1.0:
                wait_time = (1.0 - bucket["tokens"]) / bucket["rate"]
                logger.debug(f"Rate limiting {domain}: waiting {wait_time:.2f}s")
                await asyncio.sleep(wait_time)
                bucket["tokens"] = 0.0
            else:
                bucket["tokens"] -= 1.0
