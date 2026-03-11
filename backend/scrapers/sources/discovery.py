"""
Discovery Scraper — finds and scrapes small/regional auction websites.

Targets sites that:
  - Are NOT indexed by the major aggregators (LiveAuctioneers, HiBid, etc.)
  - Serve regional / local pickup audiences
  - Run on common small-auction-house software (AuctionFlex, BidWrangler,
    Handbid, BiddingOwl, 32auctions, etc.)
  - Show up in niche directories (NAA, state associations, EstateSales.org)
    rather than ranking on Google

Discovery pipeline:
  1. Enumerate known small platforms (Handbid, BiddingOwl, BidWrangler, etc.)
  2. Scrape auctioneer directories (NAA member search, EstateSales.org,
     state auctioneer association pages)
  3. Run DuckDuckGo HTML queries for regional auction terms
  4. Validate each discovered URL for real auction content
  5. Extract listings with a generic multi-strategy extractor
  6. Persist discovered sites to a JSON cache so re-runs skip re-validation

Usage:
  python backend/scrapers/hydrate.py --targets dc
  (dc = discovery)

The discovered site cache lives at:
  backend/scrapers/discovered_sites.json
"""

import json
import re
import time
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path
from typing import AsyncIterator
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

from scrapers.base import BaseScraper, ScrapedListing


# ── Persistent cache ──────────────────────────────────────────────────────────
CACHE_FILE = Path(__file__).resolve().parent.parent / "discovered_sites.json"

# How many days before we re-validate a known site (30 days)
_REVALIDATE_DAYS = 30

# ── Seed sites — pre-verified regional auctioneers ────────────────────────────
# Written to the cache on first run so the scraper has immediate harvest targets.
# Each entry mirrors the discovered_sites.json site-meta format.
# validated_at is set far in the past so they get re-validated after 30 days.
_SEED_SITES: dict[str, dict] = {
    "https://www.grafeauction.com": {
        "url": "https://www.grafeauction.com",
        "name": "Grafe Auction Company",
        "platform_type": "unknown",
        "listing_page": "https://www.grafeauction.com/auctions",
        "location": {"city": "Buffalo", "state": "MN"},
        "strong_signals": 5,
        "validated_at": "2026-01-01T00:00:00",
    },
    "https://www.appletreeauction.com": {
        "url": "https://www.appletreeauction.com",
        "name": "Apple Tree Auction Center",
        "platform_type": "unknown",
        "listing_page": "https://www.appletreeauction.com/auctions",
        "location": {"city": "Canal Winchester", "state": "OH"},
        "strong_signals": 4,
        "validated_at": "2026-01-01T00:00:00",
    },
    "https://www.caseantiques.com": {
        "url": "https://www.caseantiques.com",
        "name": "Case Antiques",
        "platform_type": "unknown",
        "listing_page": "https://www.caseantiques.com/auction/",
        "location": {"city": "Knoxville", "state": "TN"},
        "strong_signals": 5,
        "validated_at": "2026-01-01T00:00:00",
    },
    "https://www.alexcooper.com": {
        "url": "https://www.alexcooper.com",
        "name": "Alex Cooper Auctioneers",
        "platform_type": "unknown",
        "listing_page": "https://www.alexcooper.com/auctions/",
        "location": {"city": "Towson", "state": "MD"},
        "strong_signals": 5,
        "validated_at": "2026-01-01T00:00:00",
    },
    "https://www.dumouchelles.com": {
        "url": "https://www.dumouchelles.com",
        "name": "DuMouchelle Art Galleries",
        "platform_type": "unknown",
        "listing_page": "https://www.dumouchelles.com/auctions/",
        "location": {"city": "Detroit", "state": "MI"},
        "strong_signals": 5,
        "validated_at": "2026-01-01T00:00:00",
    },
    "https://www.thomastonplace.com": {
        "url": "https://www.thomastonplace.com",
        "name": "Thomaston Place Auction Galleries",
        "platform_type": "unknown",
        "listing_page": "https://www.thomastonplace.com/auctions/",
        "location": {"city": "Thomaston", "state": "ME"},
        "strong_signals": 5,
        "validated_at": "2026-01-01T00:00:00",
    },
    "https://www.clars.com": {
        "url": "https://www.clars.com",
        "name": "Clars Auction Gallery",
        "platform_type": "unknown",
        "listing_page": "https://www.clars.com/auctions/",
        "location": {"city": "Oakland", "state": "CA"},
        "strong_signals": 5,
        "validated_at": "2026-01-01T00:00:00",
    },
    "https://www.austinauction.com": {
        "url": "https://www.austinauction.com",
        "name": "Austin Auction Gallery",
        "platform_type": "unknown",
        "listing_page": "https://www.austinauction.com/auctions/",
        "location": {"city": "Austin", "state": "TX"},
        "strong_signals": 4,
        "validated_at": "2026-01-01T00:00:00",
    },
    "https://www.kamelotauctions.com": {
        "url": "https://www.kamelotauctions.com",
        "name": "Kamelot Auctions",
        "platform_type": "unknown",
        "listing_page": "https://www.kamelotauctions.com/auctions/",
        "location": {"city": "Philadelphia", "state": "PA"},
        "strong_signals": 5,
        "validated_at": "2026-01-01T00:00:00",
    },
    "https://www.litchfieldcountyauctions.com": {
        "url": "https://www.litchfieldcountyauctions.com",
        "name": "Litchfield County Auctions",
        "platform_type": "unknown",
        "listing_page": "https://www.litchfieldcountyauctions.com/auctions/",
        "location": {"city": "Milton", "state": "CT"},
        "strong_signals": 4,
        "validated_at": "2026-01-01T00:00:00",
    },
    "https://www.crescentcityauctiongallery.com": {
        "url": "https://www.crescentcityauctiongallery.com",
        "name": "Crescent City Auction Gallery",
        "platform_type": "unknown",
        "listing_page": "https://www.crescentcityauctiongallery.com/auctions/",
        "location": {"city": "New Orleans", "state": "LA"},
        "strong_signals": 5,
        "validated_at": "2026-01-01T00:00:00",
    },
    "https://www.amesonline.com": {
        "url": "https://www.amesonline.com",
        "name": "Ames Auction",
        "platform_type": "unknown",
        "listing_page": "https://www.amesonline.com/current-auctions/",
        "location": {"city": "Windham", "state": "NH"},
        "strong_signals": 4,
        "validated_at": "2026-01-01T00:00:00",
    },
    "https://www.freemansauction.com": {
        "url": "https://www.freemansauction.com",
        "name": "Freeman's Auction",
        "platform_type": "unknown",
        "listing_page": "https://www.freemansauction.com/auctions/",
        "location": {"city": "Philadelphia", "state": "PA"},
        "strong_signals": 5,
        "validated_at": "2026-01-01T00:00:00",
    },
    "https://www.treadwaygallery.com": {
        "url": "https://www.treadwaygallery.com",
        "name": "Treadway Gallery",
        "platform_type": "unknown",
        "listing_page": "https://www.treadwaygallery.com/auctions/",
        "location": {"city": "Cincinnati", "state": "OH"},
        "strong_signals": 4,
        "validated_at": "2026-01-01T00:00:00",
    },
    "https://www.kaminskiauctions.com": {
        "url": "https://www.kaminskiauctions.com",
        "name": "Kaminski Auctions",
        "platform_type": "unknown",
        "listing_page": "https://www.kaminskiauctions.com/auctions/",
        "location": {"city": "Beverly", "state": "MA"},
        "strong_signals": 5,
        "validated_at": "2026-01-01T00:00:00",
    },
    "https://www.pookandpook.com": {
        "url": "https://www.pookandpook.com",
        "name": "Pook & Pook",
        "platform_type": "unknown",
        "listing_page": "https://www.pookandpook.com/auctions/",
        "location": {"city": "Downingtown", "state": "PA"},
        "strong_signals": 5,
        "validated_at": "2026-01-01T00:00:00",
    },
    "https://www.skinnerinc.com": {
        "url": "https://www.skinnerinc.com",
        "name": "Skinner Auctioneers",
        "platform_type": "unknown",
        "listing_page": "https://www.skinnerinc.com/auctions/",
        "location": {"city": "Marlborough", "state": "MA"},
        "strong_signals": 5,
        "validated_at": "2026-01-01T00:00:00",
    },
    "https://www.burchardsauctions.com": {
        "url": "https://www.burchardsauctions.com",
        "name": "Burchards Auction & Estate Services",
        "platform_type": "unknown",
        "listing_page": "https://www.burchardsauctions.com/auctions/",
        "location": {"city": "Saint Petersburg", "state": "FL"},
        "strong_signals": 4,
        "validated_at": "2026-01-01T00:00:00",
    },
    "https://www.cowansauctions.com": {
        "url": "https://www.cowansauctions.com",
        "name": "Cowan's Auctions",
        "platform_type": "unknown",
        "listing_page": "https://www.cowansauctions.com/auctions/",
        "location": {"city": "Cincinnati", "state": "OH"},
        "strong_signals": 5,
        "validated_at": "2026-01-01T00:00:00",
    },
    "https://www.michaans.com": {
        "url": "https://www.michaans.com",
        "name": "Michaan's Auctions",
        "platform_type": "unknown",
        "listing_page": "https://www.michaans.com/auctions/",
        "location": {"city": "Alameda", "state": "CA"},
        "strong_signals": 5,
        "validated_at": "2026-01-01T00:00:00",
    },
    "https://www.mortonauction.com": {
        "url": "https://www.mortonauction.com",
        "name": "Morton Auction",
        "platform_type": "unknown",
        "listing_page": "https://www.mortonauction.com/auctions/",
        "location": {"city": "Chicago", "state": "IL"},
        "strong_signals": 4,
        "validated_at": "2026-01-01T00:00:00",
    },
    "https://www.hartzells.com": {
        "url": "https://www.hartzells.com",
        "name": "Hartzell's Auction Gallery",
        "platform_type": "unknown",
        "listing_page": "https://www.hartzells.com/auctions/",
        "location": {"city": "Sunbury", "state": "PA"},
        "strong_signals": 4,
        "validated_at": "2026-01-01T00:00:00",
    },
    "https://www.brunkauctions.com": {
        "url": "https://www.brunkauctions.com",
        "name": "Brunk Auctions",
        "platform_type": "unknown",
        "listing_page": "https://www.brunkauctions.com/upcoming-auctions/",
        "location": {"city": "Asheville", "state": "NC"},
        "strong_signals": 5,
        "validated_at": "2026-01-01T00:00:00",
    },
    "https://www.stampone.com": {
        "url": "https://www.stampone.com",
        "name": "Stamp One Auction",
        "platform_type": "unknown",
        "listing_page": "https://www.stampone.com/auctions/",
        "location": {"city": "Hamilton", "state": "NJ"},
        "strong_signals": 4,
        "validated_at": "2026-01-01T00:00:00",
    },
}


def _load_cache() -> dict:
    """
    Load the persistent discovered-sites cache.
    On first run (missing or empty cache), seeds SEED_SITES so the scraper
    has verified regional sites to harvest immediately without re-validating.
    """
    if CACHE_FILE.exists():
        try:
            data = json.loads(CACHE_FILE.read_text(encoding="utf-8"))
            if data.get("sites"):
                return data
        except Exception:
            pass
    # First run — bootstrap with hardcoded seeds
    cache: dict = {"sites": {}, "blacklist": []}
    for url, meta in _SEED_SITES.items():
        cache["sites"][url] = meta
    return cache


def _save_cache(cache: dict) -> None:
    try:
        CACHE_FILE.write_text(
            json.dumps(cache, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
    except Exception:
        pass


# ── Known small auction platforms with browsable listing pages ────────────────
# These sites aggregate listings from small/regional auctioneers.
# Each entry is (display_name, listing_browse_url, url_pattern_hint)
_KNOWN_SMALL_PLATFORMS: list[tuple[str, str, str]] = [
    # Handbid — used by nonprofits, charity events, regional auctioneers
    ("handbid",        "https://www.handbid.com/auctions",         "handbid.com"),
    # BiddingOwl — small/nonprofit online auctions
    ("biddingowl",     "https://www.biddingowl.com/auctions",      "biddingowl.com"),
    # 32auctions — simple online auctions for orgs / estate sales
    ("32auctions",     "https://www.32auctions.com/auctions",      "32auctions.com"),
    # BidWrangler — auctioneer SaaS, many regional estate houses use this
    ("bidwrangler",    "https://www.bidwrangler.com/auctions",     "bidwrangler.com"),
    # GovPlanet — Ritchie Bros surplus/government; estate context limited, filter aggressively
    # Schur Success — Midwest estate/farm auctions
    ("schursuccess",   "https://www.schursuccess.com/auctions.html", "schursuccess.com"),
    # Purple Wave — Kansas/Midwest machinery but also estate; low relevance, light scrape
    # Grafe Auction — Midwest estate sales
    ("grafeauction",   "https://www.grafeauction.com/auctions",   "grafeauction.com"),
    # Ames Auction — New England estate auctions (regional)
    ("amesonline",     "https://www.amesonline.com/current-auctions/", "amesonline.com"),
    # Crescent City Auction — New Orleans antiques / estate
    ("crescentcity",   "https://www.crescentcityauctiongallery.com/auctions/", "crescentcityauctiongallery.com"),
    # Alex Cooper Auctioneers — Mid-Atlantic estate/antiques
    ("alexcooper",     "https://www.alexcooper.com/auctions/",    "alexcooper.com"),
    # Thomaston Place — Maine/New England estate auctions
    ("thomastonplace",  "https://www.thomastonplace.com/auctions/", "thomastonplace.com"),
    # Main Auction Galleries — Florida estate/antiques
    ("mainauctionfl",  "https://www.mainauctionservices.com",     "mainauctionservices.com"),
    # DuMouchelle — Michigan estate / fine art
    ("dumouchelle",    "https://www.dumouchelles.com/auctions/",  "dumouchelles.com"),
    # Clars Auction Gallery — California estate/antiques
    ("clars",          "https://www.clars.com/auctions/",         "clars.com"),
    # Case Antiques — Appalachian/Southern estate / folk art
    ("caseantiques",   "https://www.caseantiques.com/auction/",   "caseantiques.com"),
    # Austin Auction Gallery — Texas estate
    ("austinauction",  "https://www.austinauction.com/auctions/", "austinauction.com"),
    # Litchfield County Auctions — CT/Northeast estate
    ("litchfieldco",   "https://www.litchfieldcountyauctions.com/auctions/", "litchfieldcountyauctions.com"),
    # Kamelot Auctions — Philadelphia estate
    ("kamelot",        "https://www.kamelotauctions.com/auctions/", "kamelotauctions.com"),
    # Apple Tree Auction Center — Ohio estate
    ("appletree",      "https://www.appletreeauction.com/auctions/", "appletreeauction.com"),
    # Freeman's Auction — Philadelphia fine art & antiques (regional, not on all aggregators)
    ("freemans",       "https://www.freemansauction.com/auctions/",  "freemansauction.com"),
    # Skinner Auctioneers — Boston/New England estate & decorative arts
    ("skinner",        "https://www.skinnerinc.com/auctions/",    "skinnerinc.com"),
    # Pook & Pook — Pennsylvania Americana / decorative arts
    ("pookandpook",    "https://www.pookandpook.com/auctions/",   "pookandpook.com"),
    # Cowan's Auctions — Cincinnati / Midwest Americana
    ("cowans",         "https://www.cowansauctions.com/auctions/", "cowansauctions.com"),
    # Kaminski Auctions — Beverly MA / New England estate
    ("kaminski",       "https://www.kaminskiauctions.com/auctions/", "kaminskiauctions.com"),
    # Michaan's Auctions — Bay Area estate / antiques
    ("michaans",       "https://www.michaans.com/auctions/",      "michaans.com"),
    # Brunk Auctions — Asheville NC / Southern folk art & antiques
    ("brunk",          "https://www.brunkauctions.com/upcoming-auctions/", "brunkauctions.com"),
    # Morton Auction — Chicago / Midwest antiques
    ("morton",         "https://www.mortonauction.com/auctions/", "mortonauction.com"),
    # Hartzell's Auction Gallery — Central PA estate lots
    ("hartzells",      "https://www.hartzells.com/auctions/",     "hartzells.com"),
    # Burchard's Auction — St. Petersburg FL estate
    ("burchards",      "https://www.burchardsauctions.com/",      "burchardsauctions.com"),
    # AuctionNinja — regional auctioneer platform (many small houses)
    ("auctionninja",   "https://www.auctionninja.com/",           "auctionninja.com"),
    # BidSpotter white-label mini-pages (individual auctioneer sub-sites)
    ("bs_miniauctions", "https://www.bidspotter.com/en-us/auctioneers", "bidspotter.com/en-us/auctioneers"),
]

# ── Directory seeds — sites that list regional auctioneer URLs ────────────────
_DIRECTORY_SEEDS: list[tuple[str, str]] = [
    # National Auctioneers Association member search
    ("naa",         "https://www.auctioneers.org/find-an-auctioneer"),
    # EstateSales.org company directory (different from EstateSales.net)
    ("estatesalesorg", "https://www.estatesales.org/companies"),
    # AuctionZip auctioneer search (we use it for listings, but the directory
    # gives us auctioneer website URLs)
    ("auctionzip_dir", "https://www.auctionzip.com/auctioneers/"),
    # Proxibid auctioneer list
    ("proxibid_dir",  "https://www.proxibid.com/asp/auctioneerlist.asp"),
]

# ── DuckDuckGo search query templates ────────────────────────────────────────
# Filled with US state abbreviations and major city names at runtime.
# Intentionally avoids major platforms to surface unknowns.
_DDG_QUERY_TEMPLATES = [
    'site:.com "estate auction" "bid now" "{region}" -site:liveauctioneers.com -site:hibid.com -site:invaluable.com -site:ebay.com',
    '"estate sale" "online auction" "{region}" "lot" "preview" -site:craigslist.org',
    '"{region}" "auction house" "antiques" "upcoming auctions" "register to bid"',
    '"{region}" "estate liquidation" "online bidding" "pickup" lot',
]

_DISCOVERY_REGIONS = [
    # Major metros where small regional auctioneers are concentrated
    "New England", "Mid-Atlantic", "Southeast", "Midwest",
    "Pacific Northwest", "Mountain West", "Great Plains",
    # Specific cities with active estate sale markets
    "Cincinnati", "Columbus", "Louisville", "Kansas City",
    "Memphis", "Richmond VA", "Providence RI", "Albany NY",
    "Portland OR", "Salt Lake City", "Boise ID", "Tulsa OK",
    "Chattanooga", "Lexington KY", "Savannah GA", "Frederick MD",
]

# ── Validation signals ────────────────────────────────────────────────────────
# A page needs ≥2 STRONG or ≥4 WEAK signals to be considered a real auction page
_STRONG_AUCTION_SIGNALS = [
    "place bid", "bid now", "current bid", "winning bid", "high bid",
    "bid amount", "register to bid", "absentee bid", "lot #", "lot number",
    "hammer price", "reserve price", "buyer's premium", "starting bid",
]
_WEAK_AUCTION_SIGNALS = [
    "auction", "lot", "bid", "estimate", "preview", "sale date",
    "consign", "absentee", "reserve", "hammer", "winning",
]

# Domains to exclude from discovery (we already have dedicated scrapers)
_EXCLUDED_DOMAINS = {
    "liveauctioneers.com", "hibid.com", "invaluable.com", "ebay.com",
    "craigslist.org", "maxsold.com", "estatesales.net", "bidspotter.com",
    "1stdibs.com", "proxibid.com", "christies.com", "sothebys.com",
    "bonhams.com", "heritage.com", "ebth.com", "auctionzip.com",
    "facebook.com", "instagram.com", "twitter.com", "pinterest.com",
    "yelp.com", "angi.com", "homeadvisor.com", "bbb.org",
    "youtube.com", "wikipedia.org", "reddit.com",
}

# Off-topic content we never want
_EXCLUDE_PAGE_SIGNALS = [
    "real estate only", "land auction", "vehicle auction", "auto auction",
    "farm equipment", "heavy machinery", "industrial equipment",
    "car auction", "foreclosure", "bank owned",
]


class DiscoveryScraper(BaseScraper):
    """
    Discovers and scrapes small/regional auction websites not covered by
    existing dedicated scrapers.

    Two modes:
      1. Discovery mode (default): Finds new sites, validates them, extracts
         listings, and saves them to the persistent cache.
      2. Cache-only mode (fast): Skips discovery, re-scrapes previously
         validated sites from the cache.
    """

    platform_slug = "discovery"
    base_url = "https://www.google.com"   # placeholder; varies per target
    default_rate_limit = 0.3  # conservative — hitting many different domains

    def __init__(self, *args, cache_only: bool = False, **kwargs):
        super().__init__(*args, **kwargs)
        self.cache_only = cache_only
        self._cache = _load_cache()

    async def scrape_listings(
        self,
        max_sites: int = 30,
        max_listings_per_site: int = 50,
        **kwargs,
    ) -> AsyncIterator[ScrapedListing]:
        """
        Yield listings from discovered regional auction sites.

        Args:
            max_sites:              Cap on how many discovered sites to scrape
                                    in this run (respects cache hits first).
            max_listings_per_site:  Max listings extracted per discovered site.
        """
        # Phase 1: Re-scrape known good sites from cache (fast, no discovery)
        known_sites = self._get_fresh_cache_sites()
        self.logger.info(f"Discovery: {len(known_sites)} known good sites in cache")
        scraped_count = 0

        for site_url, site_meta in known_sites.items():
            if scraped_count >= max_sites:
                break
            async for listing in self._extract_from_site(
                site_url, site_meta, max_listings_per_site
            ):
                yield listing
            scraped_count += 1

        if self.cache_only:
            return

        # Phase 2: Discover new sites
        if scraped_count < max_sites:
            new_urls: set[str] = set()

            # 2a: Known small platforms (enumerate their browse pages)
            async for url in self._discover_known_platforms():
                new_urls.add(url)

            # 2b: Auctioneer directory seeds
            async for url in self._discover_from_directories():
                new_urls.add(url)

            # 2c: DuckDuckGo search
            async for url in self._discover_via_search():
                new_urls.add(url)

            # Filter out already-known and excluded domains
            cached_urls = set(self._cache.get("sites", {}).keys())
            blacklist = set(self._cache.get("blacklist", []))
            candidate_urls = [
                u for u in new_urls
                if u not in cached_urls
                and u not in blacklist
                and not self._is_excluded_domain(u)
            ]
            self.logger.info(
                f"Discovery: {len(candidate_urls)} new candidate URLs to validate"
            )

            for url in candidate_urls:
                if scraped_count >= max_sites:
                    break
                try:
                    valid, site_meta = await self._validate_site(url)
                    if valid and site_meta:
                        # Save to cache
                        self._cache.setdefault("sites", {})[url] = site_meta
                        _save_cache(self._cache)
                        async for listing in self._extract_from_site(
                            url, site_meta, max_listings_per_site
                        ):
                            yield listing
                        scraped_count += 1
                    else:
                        self._cache.setdefault("blacklist", []).append(url)
                        _save_cache(self._cache)
                except Exception as exc:
                    self.logger.debug(f"Discovery: validation failed for {url}: {exc}")

    # ── Phase 2a: Known small platforms ──────────────────────────────────────

    async def _discover_known_platforms(self) -> AsyncIterator[str]:
        """Enumerate listing pages from known small auction platforms."""
        for platform_name, browse_url, domain_hint in _KNOWN_SMALL_PLATFORMS:
            try:
                response = await self._fetch(
                    browse_url,
                    headers=self._browser_headers(referer="https://www.google.com/"),
                )
                soup = BeautifulSoup(response.text, "lxml")

                # Extract individual auction URLs from the browse page
                for link in soup.find_all("a", href=True):
                    href = link["href"]
                    full_url = urljoin(browse_url, href)
                    parsed = urlparse(full_url)
                    # Keep only same-domain or sub-auction URLs
                    if (domain_hint in parsed.netloc and
                            parsed.path not in ("/", "") and
                            not self._is_excluded_domain(full_url)):
                        yield self._normalize_url(full_url)

                self.logger.info(f"Discovery platform {platform_name}: found links")
            except Exception as exc:
                self.logger.debug(f"Discovery {platform_name} failed: {exc}")

    # ── Phase 2b: Auctioneer directories ─────────────────────────────────────

    async def _discover_from_directories(self) -> AsyncIterator[str]:
        """Scrape auctioneer directory pages for external website URLs."""
        for dir_name, dir_url in _DIRECTORY_SEEDS:
            try:
                response = await self._fetch(
                    dir_url,
                    headers=self._browser_headers(referer="https://www.google.com/"),
                )
                soup = BeautifulSoup(response.text, "lxml")

                # Look for external links (auctioneer websites) within directory listings
                for link in soup.find_all("a", href=True):
                    href = link["href"]
                    if not href.startswith("http"):
                        continue
                    parsed = urlparse(href)
                    # Skip if it's the directory itself or excluded
                    dir_domain = urlparse(dir_url).netloc
                    if parsed.netloc == dir_domain:
                        continue
                    if self._is_excluded_domain(href):
                        continue
                    # Accept if link text or surrounding context suggests it's an auctioneer site
                    link_text = (link.get_text() or "").lower()
                    parent_text = (link.parent.get_text() if link.parent else "").lower()
                    context = link_text + " " + parent_text
                    if any(kw in context for kw in ("website", "visit", "catalog", "auction", "bid")):
                        yield self._normalize_url(href)
                    elif "website" in link.get("title", "").lower():
                        yield self._normalize_url(href)

                self.logger.info(f"Discovery directory {dir_name}: scraped")

            except Exception as exc:
                self.logger.debug(f"Discovery directory {dir_name} failed: {exc}")

            # Also try NAA's JSON member search endpoint
            if dir_name == "naa":
                async for url in self._naa_member_search():
                    yield url

    async def _naa_member_search(self) -> AsyncIterator[str]:
        """Query NAA's member search for auctioneer website URLs."""
        # NAA has a search API used by their Find-a-Member page
        naa_api_candidates = [
            "https://www.auctioneers.org/api/members/search",
            "https://www.auctioneers.org/wp-json/naa/v1/members",
        ]
        for api_url in naa_api_candidates:
            try:
                params = {
                    "specialty": "estate",
                    "country": "US",
                    "per_page": 100,
                    "page": 1,
                }
                response = await self._fetch(
                    api_url,
                    params=params,
                    headers={
                        **self._browser_headers(
                            referer="https://www.auctioneers.org/find-an-auctioneer"
                        ),
                        "Accept": "application/json",
                    },
                )
                data = response.json()
                members = data if isinstance(data, list) else data.get("members", data.get("data", []))
                for member in members:
                    website = member.get("website") or member.get("url") or ""
                    if website and website.startswith("http"):
                        if not self._is_excluded_domain(website):
                            yield self._normalize_url(website)
                self.logger.info(f"NAA API {api_url}: found members")
                break
            except Exception:
                continue

    # ── Phase 2c: DuckDuckGo search discovery ────────────────────────────────

    async def _discover_via_search(self) -> AsyncIterator[str]:
        """
        Query DuckDuckGo HTML search for regional auction sites.
        DuckDuckGo doesn't block scrapers as aggressively as Google.
        """
        ddg_url = "https://html.duckduckgo.com/html/"

        for region in _DISCOVERY_REGIONS[:8]:  # Limit to avoid rate limiting
            for template in _DDG_QUERY_TEMPLATES[:2]:  # First 2 query types
                query = template.format(region=region)
                try:
                    # DuckDuckGo HTML search requires a POST
                    if self.rate_limiter:
                        await self.rate_limiter.acquire("duckduckgo")

                    post_response = await self._session.post(
                        ddg_url,
                        data={"q": query, "kl": "us-en"},
                        headers={
                            **self._browser_headers(referer="https://duckduckgo.com/"),
                            "Content-Type": "application/x-www-form-urlencoded",
                        },
                    )
                    soup = BeautifulSoup(post_response.text, "lxml")

                    # DDG result links are in .result__url or .result__a
                    for result in soup.select(".result__a, .result__url, a.result__snippet"):
                        href = result.get("href") or ""
                        # DDG wraps URLs in /l/?uddg= or similar redirect
                        actual_url = self._extract_ddg_url(href)
                        if actual_url and not self._is_excluded_domain(actual_url):
                            yield self._normalize_url(actual_url)

                    self.logger.info(f"DDG search '{region}': results found")

                except Exception as exc:
                    self.logger.debug(f"DDG search failed for region '{region}': {exc}")

    @staticmethod
    def _extract_ddg_url(href: str) -> str | None:
        """Extract the real URL from a DuckDuckGo redirect link."""
        if not href:
            return None
        # Direct URL
        if href.startswith("http") and "duckduckgo.com" not in href:
            return href
        # DDG redirect: /l/?uddg=https%3A%2F%2F...
        match = re.search(r"uddg=([^&]+)", href)
        if match:
            from urllib.parse import unquote
            return unquote(match.group(1))
        return None

    # ── Site validation ───────────────────────────────────────────────────────

    async def _validate_site(self, url: str) -> tuple[bool, dict | None]:
        """
        Fetch a URL and determine if it's a genuine auction site with listings.

        Returns:
            (True, site_meta_dict) if valid
            (False, None) if not an auction site
        """
        try:
            response = await self._fetch(
                url,
                headers=self._browser_headers(referer="https://www.google.com/"),
            )
        except Exception as exc:
            self.logger.debug(f"Validation fetch failed for {url}: {exc}")
            return False, None

        html = response.text
        text_lower = html.lower()

        # Hard reject — off-topic content
        if any(sig in text_lower for sig in _EXCLUDE_PAGE_SIGNALS):
            return False, None

        # Score auction signals
        strong_hits = sum(1 for sig in _STRONG_AUCTION_SIGNALS if sig in text_lower)
        weak_hits = sum(1 for sig in _WEAK_AUCTION_SIGNALS if sig in text_lower)

        if strong_hits < 2 and weak_hits < 4:
            self.logger.debug(
                f"Validation rejected {url}: "
                f"strong={strong_hits}, weak={weak_hits}"
            )
            return False, None

        # Detect auction software / platform type
        platform_type = self._detect_platform_type(html, url)

        # Get site name from <title>
        soup = BeautifulSoup(html, "lxml")
        title_el = soup.find("title")
        site_name = title_el.get_text(strip=True) if title_el else urlparse(url).netloc

        # Detect listing page pattern for future direct-listing scraping
        listing_page = self._detect_listing_page(soup, url)

        # Detect location hint
        location = self._detect_location(html, soup)

        site_meta = {
            "url": url,
            "name": site_name,
            "platform_type": platform_type,
            "listing_page": listing_page or url,
            "location": location,
            "strong_signals": strong_hits,
            "weak_signals": weak_hits,
            "validated_at": datetime.utcnow().isoformat(),
        }

        self.logger.info(
            f"Validated: {urlparse(url).netloc} "
            f"(type={platform_type}, strong={strong_hits})"
        )
        return True, site_meta

    def _detect_platform_type(self, html: str, url: str) -> str:
        """Detect which auction software the site runs on."""
        html_lower = html.lower()
        url_lower = url.lower()
        checks = {
            "auctionflex": ["auctionflex", "auction flex", "catalog.asp", "/lots.asp"],
            "handbid":     ["handbid.com", "handbid-"],
            "bidwrangler": ["bidwrangler.com", "bidwrangler"],
            "biddingowl":  ["biddingowl.com"],
            "32auctions":  ["32auctions.com"],
            "wordpress_auction": ["wp-content", "auction-plugin", "wp-auction"],
            "shopify_auction":   ["shopify", "cdn.shopify.com"],
            "json_ld":     ['application/ld+json'],
            "hibid_white": ["hibid.com/", "hibid-"],
            "liveauc_white": ["liveauctioneers.com/"],
        }
        for platform, signals in checks.items():
            if any(s in html_lower or s in url_lower for s in signals):
                return platform
        return "unknown"

    def _detect_listing_page(self, soup: BeautifulSoup, base_url: str) -> str | None:
        """Try to find the specific URL of the auction listings page."""
        nav_keywords = ["auctions", "catalog", "lots", "current", "upcoming", "listings", "sale"]
        for link in soup.find_all("a", href=True):
            href = link["href"].lower()
            text = link.get_text().lower()
            if any(kw in href or kw in text for kw in nav_keywords):
                full = urljoin(base_url, link["href"])
                parsed = urlparse(full)
                if parsed.netloc == urlparse(base_url).netloc:
                    return full
        return None

    def _detect_location(self, html: str, soup: BeautifulSoup) -> dict:
        """Try to extract city/state from the site's contact or header info."""
        location: dict = {"city": None, "state": None}
        # Schema.org LocalBusiness often has address
        for tag in soup.find_all("script", type="application/ld+json"):
            try:
                data = json.loads(tag.string or "")
                if isinstance(data, list):
                    data = data[0]
                addr = data.get("address") or data.get("location", {}).get("address", {})
                if isinstance(addr, dict):
                    location["city"] = addr.get("addressLocality")
                    location["state"] = addr.get("addressRegion")
                    if location["city"] or location["state"]:
                        return location
            except Exception:
                pass
        # Regex: look for "City, ST 12345" patterns
        match = re.search(
            r'\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)?),\s+([A-Z]{2})\s+\d{5}',
            html,
        )
        if match:
            location["city"] = match.group(1)
            location["state"] = match.group(2)
        return location

    # ── Generic listing extraction ────────────────────────────────────────────

    async def _extract_from_site(
        self,
        site_url: str,
        site_meta: dict,
        max_listings: int,
        max_pages: int = 5,
    ) -> AsyncIterator[ScrapedListing]:
        """
        Extract listings from a validated site using multiple strategies.
        Tries strategies in order; once one succeeds it follows pagination
        up to max_pages to fill the listing quota.

        Strategy order:
          1. XML Sitemap  — cleanest; grabs all lot URLs from /sitemap.xml
          2. RSS/Atom feed — if the site advertises a feed in <head>
          3. JSON-LD      — schema.org AuctionEvent / Product / ItemList
          4. Platform-specific extractors (AuctionFlex, WordPress plugin)
          5. Heuristic card parser — generic CSS cascade fallback
        """
        listing_url = site_meta.get("listing_page") or site_url
        platform_type = site_meta.get("platform_type", "unknown")
        location = site_meta.get("location", {})
        domain = urlparse(site_url).netloc
        seen_ids: set[str] = set()
        yielded = 0

        # ── Strategy 1: XML Sitemap ───────────────────────────────────────────
        sitemap_listings = await self._extract_from_sitemap(
            site_url, domain, location, max_listings
        )
        if sitemap_listings:
            self.logger.info(f"Discovery sitemap: {len(sitemap_listings)} from {domain}")
            for listing in sitemap_listings:
                if listing.external_id not in seen_ids and yielded < max_listings:
                    seen_ids.add(listing.external_id)
                    yield listing
                    yielded += 1
            return

        # ── Fetch the listing page (needed for strategies 2–5) ───────────────
        try:
            response = await self._fetch(
                listing_url,
                headers=self._browser_headers(referer=site_url),
            )
        except Exception as exc:
            self.logger.debug(f"Discovery extract failed for {listing_url}: {exc}")
            return

        html = response.text
        soup = BeautifulSoup(html, "lxml")
        current_url = listing_url

        # ── Strategy 2: RSS/Atom feed ─────────────────────────────────────────
        feed_url = self._detect_feed_url(soup, site_url)
        if feed_url:
            feed_listings = await self._extract_from_feed(
                feed_url, site_url, domain, location
            )
            if feed_listings:
                self.logger.info(f"Discovery feed: {len(feed_listings)} from {domain}")
                for listing in feed_listings:
                    if listing.external_id not in seen_ids and yielded < max_listings:
                        seen_ids.add(listing.external_id)
                        yield listing
                        yielded += 1
                if yielded >= max_listings:
                    return

        # ── Strategies 3–5 with pagination ───────────────────────────────────
        page = 0
        while page < max_pages and yielded < max_listings:
            page_listings: list[ScrapedListing] = []

            # Strategy 3: JSON-LD
            page_listings = self._extract_json_ld(soup, current_url, domain, location)
            if page_listings:
                if page == 0:
                    self.logger.info(f"Discovery JSON-LD: results from {domain}")

            # Strategy 4: Platform-specific
            if not page_listings:
                page_listings = self._extract_by_platform(
                    platform_type, soup, html, current_url, domain, location
                )
                if page_listings and page == 0:
                    self.logger.info(f"Discovery {platform_type}: results from {domain}")

            # Strategy 5: Heuristic card parser
            if not page_listings:
                page_listings = self._extract_generic_cards(
                    soup, current_url, domain, location
                )
                if page_listings and page == 0:
                    self.logger.info(f"Discovery heuristic: results from {domain}")

            if not page_listings:
                break  # Nothing extracted — stop paginating

            for listing in page_listings:
                if listing.external_id not in seen_ids and yielded < max_listings:
                    seen_ids.add(listing.external_id)
                    yield listing
                    yielded += 1

            # Try to find the next page
            if yielded < max_listings and page + 1 < max_pages:
                next_url = self._find_next_page(soup, current_url)
                if not next_url or next_url == current_url:
                    break
                try:
                    response = await self._fetch(
                        next_url,
                        headers=self._browser_headers(referer=current_url),
                    )
                    html = response.text
                    soup = BeautifulSoup(html, "lxml")
                    current_url = next_url
                    page += 1
                except Exception:
                    break
            else:
                break

    # ── Sitemap extraction ────────────────────────────────────────────────────

    async def _extract_from_sitemap(
        self,
        site_url: str,
        domain: str,
        location: dict,
        max_listings: int,
    ) -> list[ScrapedListing]:
        """
        Try /sitemap.xml and /sitemap_index.xml. Filter URLs that look like
        individual auction lot pages, then fetch and parse up to max_listings.
        """
        sitemap_candidates = [
            urljoin(site_url, "/sitemap.xml"),
            urljoin(site_url, "/sitemap_index.xml"),
            urljoin(site_url, "/sitemap/sitemap.xml"),
        ]
        # Patterns that strongly suggest a lot/item page
        lot_url_patterns = re.compile(
            r"/(lot|lots|item|auction|catalog|lot-\d|item-\d|\d{4,})[/-]",
            re.IGNORECASE,
        )

        for sitemap_url in sitemap_candidates:
            try:
                response = await self._fetch(
                    sitemap_url,
                    headers=self._browser_headers(referer=site_url),
                )
                if "xml" not in response.headers.get("content-type", ""):
                    continue

                root = ET.fromstring(response.text)
                ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}

                # Sitemap index — recurse one level
                sub_sitemaps = root.findall("sm:sitemap/sm:loc", ns)
                if sub_sitemaps:
                    lot_urls: list[str] = []
                    for sub in sub_sitemaps[:5]:  # Max 5 sub-sitemaps
                        try:
                            sub_url = sub.text or ""
                            if not sub_url:
                                continue
                            sub_resp = await self._fetch(
                                sub_url,
                                headers=self._browser_headers(referer=site_url),
                            )
                            sub_root = ET.fromstring(sub_resp.text)
                            for url_el in sub_root.findall("sm:url/sm:loc", ns):
                                if url_el.text and lot_url_patterns.search(url_el.text):
                                    lot_urls.append(url_el.text)
                        except Exception:
                            continue
                else:
                    # Plain sitemap
                    lot_urls = [
                        el.text
                        for el in root.findall("sm:url/sm:loc", ns)
                        if el.text and lot_url_patterns.search(el.text)
                    ]

                if not lot_urls:
                    continue

                # Fetch individual lot pages and extract JSON-LD or meta
                results: list[ScrapedListing] = []
                for lot_url in lot_urls[:max_listings]:
                    try:
                        lot_resp = await self._fetch(
                            lot_url,
                            headers=self._browser_headers(referer=site_url),
                        )
                        lot_soup = BeautifulSoup(lot_resp.text, "lxml")
                        items = self._extract_json_ld(lot_soup, lot_url, domain, location)
                        if items:
                            results.extend(items)
                        else:
                            # Fallback: og:title + og:image
                            item = self._extract_og_meta(lot_soup, lot_url, domain, location)
                            if item:
                                results.append(item)
                    except Exception:
                        continue
                if results:
                    return results

            except Exception:
                continue

        return []

    # ── RSS/Atom feed extraction ──────────────────────────────────────────────

    @staticmethod
    def _detect_feed_url(soup: BeautifulSoup, base_url: str) -> str | None:
        """Find the site's RSS or Atom feed URL from <link rel="alternate">."""
        for link in soup.find_all("link", rel=True):
            rels = link.get("rel") or []
            if isinstance(rels, str):
                rels = [rels]
            if "alternate" in rels:
                feed_type = link.get("type", "")
                if "rss" in feed_type or "atom" in feed_type:
                    href = link.get("href") or ""
                    if href:
                        return urljoin(base_url, href)
        return None

    async def _extract_from_feed(
        self,
        feed_url: str,
        site_url: str,
        domain: str,
        location: dict,
    ) -> list[ScrapedListing]:
        """Parse an RSS/Atom feed for auction lot entries."""
        try:
            response = await self._fetch(
                feed_url,
                headers=self._browser_headers(referer=site_url),
            )
            root = ET.fromstring(response.text)
        except Exception:
            return []

        results: list[ScrapedListing] = []
        platform_slug = f"discovery_{domain.replace('.', '_').replace('-', '_')}"

        # RSS 2.0: <item> elements
        items = root.findall(".//item")
        # Atom: <entry> elements
        if not items:
            items = root.findall(".//{http://www.w3.org/2005/Atom}entry")

        for item in items:
            try:
                def _txt(tag: str) -> str:
                    el = item.find(tag) or item.find(f"{{http://www.w3.org/2005/Atom}}{tag}")
                    return (el.text or "").strip() if el is not None else ""

                title = _txt("title")
                link = _txt("link") or _txt("url")
                description = _txt("description") or _txt("summary") or _txt("content")
                pub_date = _txt("pubDate") or _txt("published") or _txt("updated")

                if not title or not link:
                    continue

                # Find image in description HTML
                img_url = ""
                if description:
                    img_match = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', description)
                    if img_match:
                        img_url = img_match.group(1)
                        if not img_url.startswith("http"):
                            img_url = urljoin(site_url, img_url)

                item_id = re.sub(r"[^\w]", "_", link.replace(site_url, ""))[:80] or f"{domain}_{len(results)}"

                results.append(ScrapedListing(
                    platform_slug=platform_slug,
                    external_id=item_id,
                    external_url=link,
                    title=title,
                    description=re.sub(r"<[^>]+>", " ", description).strip() or None,
                    city=location.get("city"),
                    state=location.get("state"),
                    sale_ends_at=self._parse_dt(pub_date),
                    primary_image_url=img_url or None,
                    image_urls=[img_url] if img_url else [],
                    listing_type="auction",
                    raw_data={"source": "rss_feed", "domain": domain},
                ))
            except Exception:
                continue

        return results

    # ── Open Graph meta fallback ──────────────────────────────────────────────

    def _extract_og_meta(
        self,
        soup: BeautifulSoup,
        page_url: str,
        domain: str,
        location: dict,
    ) -> ScrapedListing | None:
        """
        Extract a single listing from Open Graph / Twitter Card meta tags.
        Used as a fallback when JSON-LD is absent on individual lot pages
        fetched via sitemap.
        """
        def _meta(prop: str) -> str:
            el = soup.find("meta", property=prop) or soup.find("meta", attrs={"name": prop})
            return (el.get("content") or "").strip() if el else ""

        title = _meta("og:title") or _meta("twitter:title")
        if not title:
            return None

        description = _meta("og:description") or _meta("twitter:description") or ""
        img = _meta("og:image") or _meta("twitter:image") or ""
        price_str = _meta("product:price:amount") or _meta("og:price:amount") or ""

        item_id = re.sub(r"[^\w]", "_", page_url.replace(f"https://{domain}", ""))[:80]
        platform_slug = f"discovery_{domain.replace('.', '_').replace('-', '_')}"

        return ScrapedListing(
            platform_slug=platform_slug,
            external_id=item_id or domain,
            external_url=page_url,
            title=title,
            description=description or None,
            current_price=self._parse_price(price_str),
            city=location.get("city"),
            state=location.get("state"),
            primary_image_url=img or None,
            image_urls=[img] if img else [],
            listing_type="auction",
            raw_data={"source": "og_meta", "domain": domain},
        )

    # ── Pagination helper ─────────────────────────────────────────────────────

    @staticmethod
    def _find_next_page(soup: BeautifulSoup, current_url: str) -> str | None:
        """
        Locate the URL for the next page of listings using common pagination
        patterns. Returns None if this is the last page.
        """
        # 1. <link rel="next"> in <head> — most reliable
        link_next = soup.find("link", rel="next")
        if link_next and link_next.get("href"):
            return urljoin(current_url, link_next["href"])

        # 2. <a rel="next">
        a_next = soup.find("a", rel="next")
        if a_next and a_next.get("href"):
            return urljoin(current_url, a_next["href"])

        # 3. Common "Next" button / link patterns
        next_selectors = [
            "a.next", "a.next-page", "[aria-label='Next']", "[aria-label='next']",
            ".pagination a[aria-label*='Next']", ".pagination .next a",
            "a[class*=next]", "a[title='Next']", "a[title='Next Page']",
            ".pager-next a", "#next-page",
        ]
        for sel in next_selectors:
            el = soup.select_one(sel)
            if el and el.get("href"):
                href = el["href"]
                if href and href not in ("#", "javascript:void(0)", ""):
                    return urljoin(current_url, href)

        # 4. ?page=N or ?p=N URL pattern — find current page number and increment
        parsed = urlparse(current_url)
        query = parsed.query or ""
        for param in ("page", "p", "pg", "pn"):
            match = re.search(rf"(^|&){param}=(\d+)", query)
            if match:
                current_page = int(match.group(2))
                new_query = re.sub(
                    rf"(^|&){param}=\d+",
                    lambda m: m.group(1) + f"{param}={current_page + 1}",
                    query,
                )
                return parsed._replace(query=new_query).geturl()

        return None

    # ── Extraction strategies ─────────────────────────────────────────────────

    def _extract_json_ld(
        self,
        soup: BeautifulSoup,
        site_url: str,
        domain: str,
        location: dict,
    ) -> list[ScrapedListing]:
        """Extract listings from JSON-LD schema.org markup."""
        results: list[ScrapedListing] = []

        for tag in soup.find_all("script", type="application/ld+json"):
            try:
                data = json.loads(tag.string or "")
                # Handle both single items and ItemList
                items: list[dict] = []
                if isinstance(data, list):
                    items = data
                elif isinstance(data, dict):
                    schema_type = data.get("@type", "")
                    if schema_type == "ItemList":
                        for el in data.get("itemListElement", []):
                            if isinstance(el, dict):
                                item = el.get("item") or el
                                items.append(item)
                    elif schema_type in ("AuctionEvent", "Event", "Product", "Offer"):
                        items = [data]
                    else:
                        items = [data]

                for item in items:
                    listing = self._ld_item_to_listing(item, site_url, domain, location)
                    if listing:
                        results.append(listing)
            except (json.JSONDecodeError, AttributeError):
                pass

        return results

    def _ld_item_to_listing(
        self, item: dict, site_url: str, domain: str, location: dict
    ) -> ScrapedListing | None:
        """Convert a JSON-LD item dict to a ScrapedListing."""
        try:
            schema_type = item.get("@type", "")
            title = (
                item.get("name") or item.get("title") or ""
            ).strip()
            if not title:
                return None

            url = item.get("url") or item.get("@id") or site_url
            if not url.startswith("http"):
                url = urljoin(site_url, url)

            # Generate an ID from the URL
            item_id = re.sub(r"[^\w]", "_", url.replace(site_url, "").strip("/"))[:80] or domain

            # Images
            image = item.get("image") or item.get("photo") or ""
            images: list[str] = []
            if isinstance(image, str) and image:
                images = [image]
            elif isinstance(image, list):
                images = [i if isinstance(i, str) else i.get("url", "") for i in image]

            # Price / Offer
            offers = item.get("offers") or item.get("offer") or {}
            if isinstance(offers, list):
                offers = offers[0] if offers else {}
            price = None
            if isinstance(offers, dict):
                price = self._parse_price(str(offers.get("price") or ""))

            # Location
            event_loc = item.get("location") or {}
            addr = event_loc.get("address") or {} if isinstance(event_loc, dict) else {}
            city = (
                location.get("city")
                or (addr.get("addressLocality") if isinstance(addr, dict) else None)
            )
            state = (
                location.get("state")
                or (addr.get("addressRegion") if isinstance(addr, dict) else None)
            )

            # Dates
            end_at = self._parse_dt(
                item.get("endDate") or item.get("endTime") or item.get("validThrough")
            )
            start_at = self._parse_dt(
                item.get("startDate") or item.get("startTime")
            )

            # Description
            desc = item.get("description") or ""

            return ScrapedListing(
                platform_slug=f"discovery_{domain.replace('.', '_').replace('-', '_')}",
                external_id=item_id,
                external_url=url,
                title=title,
                description=desc or None,
                current_price=price,
                city=city,
                state=state,
                sale_starts_at=start_at,
                sale_ends_at=end_at,
                primary_image_url=images[0] if images else None,
                image_urls=[i for i in images if i],
                listing_type="auction",
                pickup_only=False,
                ships_nationally=True,
                raw_data={"source": "json_ld", "domain": domain},
            )
        except Exception as exc:
            self.logger.debug(f"JSON-LD parse error on {domain}: {exc}")
            return None

    def _extract_by_platform(
        self,
        platform_type: str,
        soup: BeautifulSoup,
        html: str,
        site_url: str,
        domain: str,
        location: dict,
    ) -> list[ScrapedListing]:
        """Platform-specific extractors for known auction software."""
        if platform_type == "auctionflex":
            return self._extract_auctionflex(soup, site_url, domain, location)
        if platform_type in ("handbid", "bidwrangler", "biddingowl", "32auctions"):
            return self._extract_generic_cards(soup, site_url, domain, location)
        if platform_type == "wordpress_auction":
            return self._extract_wordpress_auction(soup, site_url, domain, location)
        return []

    def _extract_auctionflex(
        self,
        soup: BeautifulSoup,
        site_url: str,
        domain: str,
        location: dict,
    ) -> list[ScrapedListing]:
        """
        AuctionFlex-powered sites typically have lot tables with columns:
        Lot#, Description, Estimate, Current Bid.
        """
        results: list[ScrapedListing] = []
        # AuctionFlex lots are often in a table with class "catalog" or rows with lot data
        for row in soup.select("table.catalog tr, tr.lot-row, .lot-item, [class*=catalogRow]"):
            try:
                cells = row.find_all("td")
                if len(cells) < 2:
                    continue
                lot_num = cells[0].get_text(strip=True)
                title = cells[1].get_text(strip=True)
                if not title or not lot_num:
                    continue

                price_text = cells[2].get_text() if len(cells) > 2 else ""
                link = row.find("a")
                url = urljoin(site_url, link["href"]) if link else site_url
                img = row.find("img")
                img_url = urljoin(site_url, img["src"]) if img else None

                results.append(ScrapedListing(
                    platform_slug=f"discovery_{domain.replace('.', '_')}",
                    external_id=f"{domain}_lot_{lot_num}",
                    external_url=url,
                    title=title,
                    current_price=self._parse_price(price_text),
                    city=location.get("city"),
                    state=location.get("state"),
                    primary_image_url=img_url,
                    image_urls=[img_url] if img_url else [],
                    listing_type="auction",
                    pickup_only=True,
                    raw_data={"source": "auctionflex", "lot_num": lot_num},
                ))
            except Exception:
                pass
        return results

    def _extract_wordpress_auction(
        self,
        soup: BeautifulSoup,
        site_url: str,
        domain: str,
        location: dict,
    ) -> list[ScrapedListing]:
        """Extract listings from WordPress sites using auction plugins."""
        results: list[ScrapedListing] = []
        # WooCommerce / YITH auction plugins use .product, .auction-product selectors
        for card in soup.select(".product, .auction-item, [class*=auction-product], .woocommerce-loop-product"):
            try:
                title_el = card.select_one("h2, h3, .woocommerce-loop-product__title, [class*=title]")
                price_el = card.select_one(".price, .current-bid, .woocommerce-Price-amount")
                img_el = card.select_one("img")
                link_el = card.select_one("a[href]")

                if not title_el:
                    continue
                title = title_el.get_text(strip=True)
                if not title:
                    continue

                url = urljoin(site_url, link_el["href"]) if link_el else site_url
                img_src = img_el.get("src") or img_el.get("data-src", "") if img_el else ""
                if img_src and not img_src.startswith("http"):
                    img_src = urljoin(site_url, img_src)

                results.append(ScrapedListing(
                    platform_slug=f"discovery_{domain.replace('.', '_')}",
                    external_id=re.sub(r"[^\w]", "_", url.replace(site_url, ""))[:60] or domain,
                    external_url=url,
                    title=title,
                    current_price=self._parse_price(price_el.get_text() if price_el else ""),
                    city=location.get("city"),
                    state=location.get("state"),
                    primary_image_url=img_src or None,
                    image_urls=[img_src] if img_src else [],
                    listing_type="auction",
                    raw_data={"source": "wordpress_auction"},
                ))
            except Exception:
                pass
        return results

    def _extract_generic_cards(
        self,
        soup: BeautifulSoup,
        site_url: str,
        domain: str,
        location: dict,
    ) -> list[ScrapedListing]:
        """
        Heuristic extraction: look for repeating card/row elements that contain
        a title, optional price, optional image, and a link.
        Works on most modern auction sites regardless of CSS framework.
        """
        results: list[ScrapedListing] = []

        # Selectors ordered by specificity — most specific first
        card_selectors = [
            "[class*=auction-item]", "[class*=lot-item]", "[class*=listing-item]",
            "[class*=auction-card]", "[class*=lot-card]", "[class*=product-card]",
            "[data-lot]", "[data-auction-id]", "[data-item-id]",
            "article.auction", "article.lot", ".auction-listing",
            # Generic last resort: any article or li that contains a bid/lot link
        ]

        cards_found: list = []
        for sel in card_selectors:
            cards_found = soup.select(sel)
            if len(cards_found) >= 2:  # Need at least 2 to be a listing page
                break

        if not cards_found:
            # Final fallback: any <article> or repeated <li> with a link + text
            for container in soup.select("article, li"):
                link = container.find("a", href=True)
                text = container.get_text(strip=True)
                if link and len(text) > 20 and len(text) < 500:
                    cards_found.append(container)
            # Only proceed if we found a plausible list (≥3 cards)
            if len(cards_found) < 3:
                return []

        for card in cards_found:
            try:
                # Title — first heading or strong text
                title_el = (
                    card.find("h2") or card.find("h3") or card.find("h4")
                    or card.find("strong")
                    or card.select_one("[class*=title]")
                )
                if not title_el:
                    continue
                title = title_el.get_text(strip=True)
                if len(title) < 5 or len(title) > 300:
                    continue

                # Skip non-auction content
                title_lower = title.lower()
                if any(kw in title_lower for kw in ("log in", "sign up", "menu", "search", "contact")):
                    continue

                # Price
                price_el = card.select_one(
                    "[class*=price], [class*=bid], [class*=estimate], [class*=amount]"
                )
                price = self._parse_price(price_el.get_text() if price_el else "")

                # Image
                img_el = card.find("img")
                img_src = ""
                if img_el:
                    img_src = img_el.get("src") or img_el.get("data-src") or ""
                    if img_src and not img_src.startswith("http"):
                        img_src = urljoin(site_url, img_src)
                    if img_src and img_src.endswith((".gif", ".svg", "pixel.png")):
                        img_src = ""

                # Link
                link_el = card.find("a", href=True)
                card_url = site_url
                if link_el:
                    href = link_el["href"]
                    card_url = urljoin(site_url, href) if not href.startswith("http") else href

                item_id = (
                    card.get("data-lot")
                    or card.get("data-auction-id")
                    or card.get("data-item-id")
                    or re.sub(r"[^\w]", "_", card_url.replace(site_url, ""))[:60]
                    or f"{domain}_{len(results)}"
                )

                results.append(ScrapedListing(
                    platform_slug=f"discovery_{domain.replace('.', '_').replace('-', '_')}",
                    external_id=str(item_id),
                    external_url=card_url,
                    title=title,
                    current_price=price,
                    city=location.get("city"),
                    state=location.get("state"),
                    primary_image_url=img_src or None,
                    image_urls=[img_src] if img_src else [],
                    listing_type="auction",
                    raw_data={"source": "heuristic_card", "domain": domain},
                ))
            except Exception:
                pass

        return results

    # ── Cache helpers ─────────────────────────────────────────────────────────

    def _get_fresh_cache_sites(self) -> dict:
        """Return cached sites that don't need re-validation yet."""
        now = datetime.utcnow()
        fresh: dict = {}
        for url, meta in self._cache.get("sites", {}).items():
            try:
                validated_at = datetime.fromisoformat(meta.get("validated_at", ""))
                age_days = (now - validated_at).days
                if age_days < _REVALIDATE_DAYS:
                    fresh[url] = meta
            except Exception:
                # No valid timestamp — include it for re-scraping
                fresh[url] = meta
        return fresh

    # ── Utilities ─────────────────────────────────────────────────────────────

    @staticmethod
    def _is_excluded_domain(url: str) -> bool:
        try:
            domain = urlparse(url).netloc.lower().lstrip("www.")
            return any(domain == ex or domain.endswith("." + ex) for ex in _EXCLUDED_DOMAINS)
        except Exception:
            return True

    @staticmethod
    def _normalize_url(url: str) -> str:
        """Strip tracking params and fragments, normalize to https."""
        try:
            parsed = urlparse(url)
            clean = parsed._replace(
                scheme="https",
                fragment="",
                query="",
            )
            return clean.geturl().rstrip("/")
        except Exception:
            return url

    # _parse_price, _parse_dt, _parse_iso inherited from BaseScraper

    async def scrape_listing_detail(self, external_id: str) -> ScrapedListing | None:
        """Not used — discovery scraper doesn't have a canonical listing DB."""
        return None
