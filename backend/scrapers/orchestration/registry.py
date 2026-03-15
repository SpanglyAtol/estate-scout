from __future__ import annotations

import importlib

SCRAPER_REGISTRY = {
    "liveauctioneers": "scrapers.sources.liveauctioneers.LiveAuctioneersScraper",
    "estatesales_net": "scrapers.sources.estatesales_net.EstateSalesNetScraper",
    "hibid": "scrapers.sources.hibid.HibidScraper",
    "maxsold": "scrapers.sources.maxsold.MaxSoldScraper",
    "bidspotter": "scrapers.sources.bidspotter.BidSpotterScraper",
    "ebay": "scrapers.sources.ebay.EbaySoldListingsScraper",
    "proxibid": "scrapers.sources.proxibid.ProxibidScraper",
    "1stdibs": "scrapers.sources.onedibs.OneDibsScraper",
    "ebth": "scrapers.sources.ebth.EbthScraper",
    "invaluable": "scrapers.sources.invaluable.InvaluableScraper",
    "auctionzip": "scrapers.sources.auctionzip.AuctionZipScraper",
    "discovery": "scrapers.sources.discovery.DiscoveryScraper",
}

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

NATIONAL_KWARGS = {
    "bidspotter": {"state": None},
    "hibid": {"state": "", "country": "USA"},
    "estatesales_net": {"state": ""},
    "maxsold": {"state": ""},
    "proxibid": {"state": ""},
}


def load_scraper_class(target: str):
    dotpath = SCRAPER_REGISTRY[target]
    module_path, class_name = dotpath.rsplit(".", 1)
    module = importlib.import_module(module_path)
    return getattr(module, class_name)
