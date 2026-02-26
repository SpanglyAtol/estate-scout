import itertools
import logging
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class Proxy:
    url: str
    is_healthy: bool = True
    fail_count: int = 0


class ProxyPool:
    """
    Round-robin proxy rotation with automatic health tracking.
    Marks a proxy unhealthy after 3 consecutive failures.
    Falls back to direct connection if pool is empty or all proxies fail.
    """

    def __init__(self, proxy_urls: list[str]):
        self._proxies = [Proxy(url=u) for u in proxy_urls if u]
        self._iter = iter([])
        self._reset_cycle()

    def _reset_cycle(self):
        self._iter = itertools.cycle(self._proxies) if self._proxies else iter([])

    @classmethod
    def from_csv(cls, csv: str) -> "ProxyPool":
        urls = [u.strip() for u in csv.split(",") if u.strip()]
        return cls(urls)

    def get_next(self) -> str | None:
        healthy = [p for p in self._proxies if p.is_healthy]
        if not healthy:
            if self._proxies:
                logger.warning("All proxies unhealthy - using direct connection")
            return None
        for proxy in self._iter:
            if proxy.is_healthy:
                return proxy.url
        return None

    def report_success(self, proxy_url: str):
        for p in self._proxies:
            if p.url == proxy_url:
                p.fail_count = 0

    def report_failure(self, proxy_url: str):
        for p in self._proxies:
            if p.url == proxy_url:
                p.fail_count += 1
                if p.fail_count >= 3:
                    p.is_healthy = False
                    logger.warning(f"Proxy {proxy_url} marked unhealthy after 3 failures")

    def reset_all(self):
        for p in self._proxies:
            p.is_healthy = True
            p.fail_count = 0
        self._reset_cycle()

    @property
    def healthy_count(self) -> int:
        return sum(1 for p in self._proxies if p.is_healthy)

    @property
    def total_count(self) -> int:
        return len(self._proxies)
