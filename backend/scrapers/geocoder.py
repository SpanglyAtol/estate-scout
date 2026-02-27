"""
Estate Scout — City+State Geocoder
====================================
Resolves US city+state pairs to latitude/longitude using the Nominatim API
(OpenStreetMap). Results are cached to a local JSON file so each unique
city+state pair is only looked up once across hydration runs.

Nominatim usage policy: max 1 request/second, must set a descriptive User-Agent.
See: https://operations.osmfoundation.org/policies/nominatim/
"""

import asyncio
import json
import logging
from pathlib import Path

import httpx

logger = logging.getLogger("geocoder")

CACHE_PATH = Path(__file__).resolve().parent / "_city_coords_cache.json"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
# Nominatim requires a descriptive User-Agent per the usage policy
HEADERS = {
    "User-Agent": "EstateScout/1.0 (https://github.com/SpanglyAtol/estate-scout; demo app)",
    "Accept-Language": "en-US,en;q=0.9",
}


# ── Cache I/O ─────────────────────────────────────────────────────────────────

def _load_cache() -> dict:
    """Return the on-disk cache dict, or {} if missing/corrupt."""
    if CACHE_PATH.exists():
        try:
            return json.loads(CACHE_PATH.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}


def _save_cache(cache: dict) -> None:
    """Persist the cache dict to disk."""
    try:
        CACHE_PATH.write_text(json.dumps(cache, indent=2), encoding="utf-8")
    except Exception as exc:
        logger.warning(f"Could not save geocoder cache: {exc}")


# ── Nominatim lookup ──────────────────────────────────────────────────────────

async def _lookup_one(
    city: str,
    state: str,
    client: httpx.AsyncClient,
) -> tuple[float, float] | None:
    """Call Nominatim for a single city+state. Returns (lat, lon) or None."""
    try:
        resp = await client.get(
            NOMINATIM_URL,
            params={
                "city": city,
                "state": state,
                "country": "US",
                "format": "json",
                "limit": 1,
                "addressdetails": 0,
            },
            timeout=httpx.Timeout(15.0, connect=5.0),
        )
        resp.raise_for_status()
        results = resp.json()
        if results:
            return float(results[0]["lat"]), float(results[0]["lon"])
    except httpx.HTTPStatusError as exc:
        logger.debug(f"Nominatim HTTP {exc.response.status_code} for {city}, {state}")
    except Exception as exc:
        logger.debug(f"Nominatim error for {city}, {state}: {exc}")
    return None


# ── Public API ────────────────────────────────────────────────────────────────

async def geocode_listings(listings: list[dict]) -> list[dict]:
    """
    Add ``latitude`` and ``longitude`` to listing dicts that have a city+state
    but no coordinates.  Mutates the list in-place and returns it.

    New city+state pairs are resolved via Nominatim (1 req/sec) and cached to
    ``_city_coords_cache.json``.  Subsequent calls for the same city+state
    return instantly from the cache.
    """
    cache = _load_cache()

    # ── Pass 1: find pairs that need a fresh Nominatim call ───────────────────
    missing: set[tuple[str, str]] = set()
    for lst in listings:
        if lst.get("latitude") is not None:
            continue
        city = (lst.get("city") or "").strip()
        state = (lst.get("state") or "").strip()
        if not city or not state:
            continue
        key = f"{city.lower()},{state.lower()}"
        if key not in cache:
            missing.add((city, state))

    # ── Pass 2: geocode missing pairs (rate-limited) ──────────────────────────
    if missing:
        logger.info(
            f"Geocoding {len(missing)} new city+state pair(s) via Nominatim "
            f"(~{len(missing)} seconds) …"
        )
        async with httpx.AsyncClient(headers=HEADERS) as client:
            for city, state in sorted(missing):
                key = f"{city.lower()},{state.lower()}"
                result = await _lookup_one(city, state, client)
                # Store None for misses so we don't keep retrying
                cache[key] = list(result) if result else None
                _save_cache(cache)
                await asyncio.sleep(1.1)  # Nominatim: 1 req/sec policy
    else:
        logger.info("Geocoder: all city+state pairs already cached.")

    # ── Pass 3: apply cached coordinates to listing dicts ────────────────────
    applied = 0
    for lst in listings:
        if lst.get("latitude") is not None:
            continue
        city = (lst.get("city") or "").strip()
        state = (lst.get("state") or "").strip()
        if not city or not state:
            continue
        key = f"{city.lower()},{state.lower()}"
        coords = cache.get(key)
        if coords:
            lst["latitude"] = coords[0]
            lst["longitude"] = coords[1]
            applied += 1

    resolved = sum(1 for l in listings if l.get("latitude") is not None)
    logger.info(
        f"Geocoder: {applied} new coordinates applied; "
        f"{resolved}/{len(listings)} listings now have lat/lon."
    )
    return listings
