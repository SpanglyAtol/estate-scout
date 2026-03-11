"use client";

import { useState, useEffect, useCallback } from "react";
import {
  MapPin, Search, ExternalLink, Calendar,
  Building2, Navigation, Loader2, ChevronRight,
} from "lucide-react";
import type { Listing } from "@/types";
import { formatPrice } from "@/lib/format";
import { AdUnit } from "@/components/ads/ad-unit";
import { trackAffiliateClick } from "@/lib/analytics";

const ESTATE_PREP_TAG = process.env.NEXT_PUBLIC_AMAZON_ASSOCIATES_TAG;
const ESTATE_PREP_LINKS = [
  { label: "Packing & moving supplies", keywords: "moving boxes packing supplies" },
  { label: "Storage & organization",    keywords: "storage bins closet organizers" },
  { label: "Cleaning & restoration",    keywords: "cleaning restoration kit antique" },
];

function buildAmazonUrl(keywords: string): string {
  if (!ESTATE_PREP_TAG) return "#";
  return `https://www.amazon.com/s?${new URLSearchParams({ k: keywords, tag: ESTATE_PREP_TAG, linkCode: "ure" })}`;
}

// ── Platform directory ─────────────────────────────────────────────────────────

const PLATFORMS = [
  {
    name: "EstateSales.NET",
    description: "Largest US estate sale directory. Browse by city.",
    url: "https://www.estatesales.net",
    color: "blue",
    emoji: "🏡",
  },
  {
    name: "EstateSales.org",
    description: "Nationwide sale listings with 'near me' search.",
    url: "https://estatesales.org/estate-sales-near-me",
    color: "indigo",
    emoji: "📦",
  },
  {
    name: "gsalr.com",
    description: "Map-based estate sale finder across the whole US.",
    url: "https://www.gsalr.com/",
    color: "violet",
    emoji: "🗺️",
  },
  {
    name: "Facebook Marketplace",
    description: "Neighborhood estate and garage sales posted daily.",
    url: "https://www.facebook.com/marketplace/search/?q=estate+sale",
    color: "sky",
    emoji: "👥",
  },
  {
    name: "MaxSold",
    description: "Online-only estate auctions with local pickup.",
    url: "https://maxsold.com/auctions",
    color: "amber",
    emoji: "🔨",
  },
  {
    name: "HiBid",
    description: "Live and timed auctions from local auction houses.",
    url: "https://hibid.com/auctions",
    color: "orange",
    emoji: "🏷️",
  },
  {
    name: "Craigslist",
    description: "Local garage and estate sales posted by owners.",
    url: "https://www.craigslist.org/search/sss?query=estate+sale",
    color: "green",
    emoji: "📋",
  },
  {
    name: "Nextdoor",
    description: "Hyper-local neighborhood sales posted by neighbors.",
    url: "https://nextdoor.com/find-nearby/",
    color: "teal",
    emoji: "🏘️",
  },
];

const cardColors: Record<string, { bg: string; border: string; btn: string }> = {
  blue:   { bg: "bg-blue-50",   border: "border-blue-100",   btn: "bg-blue-600 hover:bg-blue-700" },
  indigo: { bg: "bg-indigo-50", border: "border-indigo-100", btn: "bg-indigo-600 hover:bg-indigo-700" },
  violet: { bg: "bg-violet-50", border: "border-violet-100", btn: "bg-violet-600 hover:bg-violet-700" },
  sky:    { bg: "bg-sky-50",    border: "border-sky-100",    btn: "bg-sky-600 hover:bg-sky-700" },
  amber:  { bg: "bg-amber-50",  border: "border-amber-100",  btn: "bg-amber-600 hover:bg-amber-700" },
  orange: { bg: "bg-orange-50", border: "border-orange-100", btn: "bg-orange-600 hover:bg-orange-700" },
  green:  { bg: "bg-green-50",  border: "border-green-100",  btn: "bg-green-600 hover:bg-green-700" },
  teal:   { bg: "bg-teal-50",   border: "border-teal-100",   btn: "bg-teal-600 hover:bg-teal-700" },
};

// ── Helpers ─────────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function daysUntil(iso: string | null): string {
  if (!iso) return "";
  const diff = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  if (diff <= 0) return "Active";
  if (diff === 1) return "Tomorrow";
  return `In ${diff} days`;
}

async function zipToCoords(zip: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip.trim()}`);
    if (!res.ok) return null;
    const data = await res.json();
    const place = data.places?.[0];
    if (!place) return null;
    return { lat: parseFloat(place.latitude), lon: parseFloat(place.longitude) };
  } catch {
    return null;
  }
}

// ── Page ────────────────────────────────────────────────────────────────────────

export default function EstateSalesPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [zip, setZip] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [radius] = useState(50);

  const fetchSales = useCallback(async (lat: number, lon: number, label: string) => {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lon),
      radius_miles: String(radius),
      listing_type: "estate_sale",
      page_size: "48",
    });
    if (query.trim()) params.set("q", query.trim());

    try {
      const res = await fetch(`/api/v1/search?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Listing[] = await res.json();
      setListings(data);
      setLocationLabel(label);
      setError("");
    } catch {
      setError("Failed to load listings. Please try again.");
    }
  }, [radius, query]);

  // Load initial nationwide estate sales on mount
  useEffect(() => {
    async function loadDefault() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          listing_type: "estate_sale",
          page_size: "48",
        });
        const res = await fetch(`/api/v1/search?${params}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: Listing[] = await res.json();
        setListings(data);
      } catch {
        // silently fail — will show empty state
      } finally {
        setLoading(false);
      }
    }
    loadDefault();
  }, []);

  const handleZipSearch = useCallback(async () => {
    const trimmed = zip.trim();
    if (!/^\d{5}$/.test(trimmed)) {
      setError("Please enter a valid 5-digit ZIP code.");
      return;
    }
    setLoading(true);
    setError("");
    const coords = await zipToCoords(trimmed);
    if (!coords) {
      setError(`Couldn't locate ZIP code "${trimmed}".`);
      setLoading(false);
      return;
    }
    await fetchSales(coords.lat, coords.lon, `ZIP ${trimmed}`);
    setLoading(false);
  }, [zip, fetchSales]);

  const handleNearMe = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation not supported by your browser.");
      return;
    }
    setGeoLoading(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await fetchSales(pos.coords.latitude, pos.coords.longitude, "your location");
        setGeoLoading(false);
      },
      () => {
        setError("Couldn't access your location. Enter a ZIP code instead.");
        setGeoLoading(false);
      }
    );
  }, [fetchSales]);

  const handleTextSearch = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ listing_type: "estate_sale", page_size: "48" });
      if (query.trim()) params.set("q", query.trim());
      const res = await fetch(`/api/v1/search?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Listing[] = await res.json();
      setListings(data);
    } catch {
      setError("Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [query]);

  const isLoading = loading || geoLoading;

  return (
    <div className="container mx-auto px-4 py-10 max-w-6xl">

      {/* ── Hero ── */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 bg-antique-muted text-antique-accent text-sm font-semibold px-4 py-1.5 rounded-full mb-4 border border-antique-border">
          <MapPin className="w-4 h-4" />
          Estate Sales Near You
        </div>
        <h1 className="font-display text-4xl font-bold text-antique-text mb-3">
          Find Local Estate Sales
        </h1>
        <p className="text-antique-text-sec text-lg max-w-2xl mx-auto mb-8">
          Browse upcoming estate sales and in-person auctions from EstateSales.net,
          MaxSold, HiBid, and more — all in one place.
        </p>

        {/* Search controls */}
        <div className="flex flex-wrap items-center justify-center gap-3 max-w-2xl mx-auto">
          {/* Text search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-antique-text-mute pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleTextSearch()}
              placeholder="Search by keyword, category…"
              className="w-full pl-10 pr-4 py-2.5 border border-antique-border rounded-xl text-sm bg-antique-surface text-antique-text placeholder:text-antique-text-mute focus:outline-none focus:border-antique-accent transition-colors"
            />
          </div>

          {/* ZIP input */}
          <div className="relative flex-shrink-0">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-antique-accent pointer-events-none" />
            <input
              type="text"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleZipSearch()}
              placeholder="ZIP code"
              maxLength={5}
              className="pl-9 pr-3 py-2.5 border border-antique-border rounded-xl text-sm w-32 bg-antique-surface text-antique-text placeholder:text-antique-text-mute focus:outline-none focus:border-antique-accent transition-colors"
            />
          </div>

          {/* Near me */}
          <button
            onClick={handleNearMe}
            disabled={isLoading}
            className="flex items-center gap-2 border border-antique-border text-antique-text-sec hover:border-antique-accent hover:text-antique-accent disabled:opacity-50 px-3 py-2.5 rounded-xl text-sm transition-colors bg-antique-surface flex-shrink-0"
          >
            {geoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
            Near Me
          </button>

          {/* Search button */}
          <button
            onClick={handleZipSearch}
            disabled={isLoading}
            className="flex items-center gap-2 bg-antique-accent hover:bg-antique-accent-h disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors flex-shrink-0"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Search
          </button>
        </div>

        {error && <p className="text-red-600 text-sm mt-3 font-medium">{error}</p>}
      </div>

      {/* ── Top ad placement ── */}
      <AdUnit slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_ESTATE ?? ""} format="rectangle" className="mb-6" />
      {ESTATE_PREP_TAG && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mb-10 px-4 py-2.5 bg-antique-surface border border-antique-border rounded-xl text-sm">
          <span className="text-antique-text-mute text-[11px] uppercase tracking-widest shrink-0 font-medium">
            Sponsored
          </span>
          {ESTATE_PREP_LINKS.map((link) => {
            const url = buildAmazonUrl(link.keywords);
            return (
              <a
                key={link.keywords}
                href={url}
                target="_blank"
                rel="noopener noreferrer sponsored"
                onClick={() => trackAffiliateClick({ category: "estate_sale", keywords: link.keywords, url })}
                className="text-antique-accent hover:text-antique-accent-h hover:underline transition-colors font-medium"
              >
                {link.label}
              </a>
            );
          })}
          <span className="ml-auto text-antique-text-mute text-[11px] shrink-0">via Amazon ↗</span>
        </div>
      )}

      {/* ── Browse by Platform ── */}
      <section className="mb-14">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl font-bold text-antique-text">Browse by Platform</h2>
          <span className="text-sm text-antique-text-mute hidden sm:block">Opens the source site in a new tab</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {PLATFORMS.map((p) => {
            const c = cardColors[p.color];
            return (
              <a
                key={p.name}
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`rounded-2xl border p-4 flex flex-col gap-3 transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 ${c.bg} ${c.border}`}
              >
                <span className="text-2xl" aria-hidden="true">{p.emoji}</span>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 text-sm leading-tight">{p.name}</p>
                  <p className="text-xs text-gray-500 mt-1 leading-snug">{p.description}</p>
                </div>
                <span className={`inline-flex items-center gap-1 text-xs font-semibold text-white px-3 py-1.5 rounded-lg self-start transition-colors ${c.btn}`}>
                  Browse <ExternalLink className="w-3 h-3" />
                </span>
              </a>
            );
          })}
        </div>
      </section>

      {/* ── Live Estate Sales ── */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl font-bold text-antique-text">
            {locationLabel ? `Estate Sales Near ${locationLabel}` : "Upcoming Estate Sales"}
            {listings.length > 0 && (
              <span className="ml-2 text-sm font-normal text-antique-text-mute">
                — {listings.length} result{listings.length !== 1 ? "s" : ""}
              </span>
            )}
          </h2>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 text-antique-accent animate-spin" />
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-20 text-antique-text-mute">
            <MapPin className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-semibold text-antique-text-sec">No estate sales found</p>
            <p className="text-sm mt-1">Try a different location or search term, or browse the platforms above.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map((listing) => (
              <EstateSaleCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ── Estate Sale Card ────────────────────────────────────────────────────────────

function EstateSaleCard({ listing }: { listing: Listing }) {
  const startLabel = daysUntil(listing.sale_starts_at as string | null);
  const isSoon = startLabel === "Active" || startLabel === "Tomorrow";

  return (
    <article className="bg-antique-surface border border-antique-border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">
      {/* Preview image */}
      <div className="relative h-44 bg-antique-muted flex-shrink-0">
        {listing.primary_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.primary_image_url}
            alt={listing.title}
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl opacity-20">🏺</div>
        )}
        {isSoon && (
          <div className="absolute top-2 right-2 bg-antique-accent text-white text-xs font-bold px-2.5 py-0.5 rounded-full shadow">
            {startLabel}
          </div>
        )}
        {listing.is_sponsored && (
          <div className="absolute top-2 left-2 bg-antique-muted border border-antique-border text-antique-text-mute text-[10px] font-medium px-2 py-0.5 rounded-full">
            Sponsored
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col gap-2 flex-1">
        {/* Platform */}
        <span className="text-[10px] font-semibold uppercase tracking-wide text-antique-accent">
          {listing.platform?.display_name ?? "Estate Sale"}
        </span>

        {/* Title */}
        <h3 className="font-semibold text-antique-text text-sm leading-snug line-clamp-2">
          {listing.title}
        </h3>

        {/* Location */}
        {(listing.city || listing.state) && (
          <div className="flex items-center gap-1.5 text-xs text-antique-text-sec">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
            <span>
              {[listing.city, listing.state].filter(Boolean).join(", ")}
              {listing.zip_code && ` ${listing.zip_code}`}
            </span>
          </div>
        )}

        {/* Dates */}
        {(listing.sale_starts_at || listing.sale_ends_at) && (
          <div className="flex items-center gap-1.5 text-xs text-antique-text-sec">
            <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
            <span>
              {startLabel && <span className="font-semibold text-antique-text mr-1">{startLabel}</span>}
              {fmtDate(listing.sale_starts_at as string | null)}
              {listing.sale_ends_at && ` – ${fmtDate(listing.sale_ends_at as string | null)}`}
            </span>
          </div>
        )}

        {/* Price */}
        {listing.current_price != null && (
          <div className="flex items-center gap-1.5 text-xs text-antique-text-sec">
            <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="font-bold text-antique-accent">{formatPrice(listing.current_price)}</span>
          </div>
        )}

        {/* Distance */}
        {listing.distance_miles != null && (
          <p className="text-xs text-antique-text-mute">
            📍 {listing.distance_miles.toFixed(1)} mi away
          </p>
        )}

        {/* Category tag */}
        {listing.category && (
          <div className="flex flex-wrap gap-1 mt-1">
            <span className="text-xs bg-antique-muted text-antique-text-sec px-2 py-0.5 rounded-full border border-antique-border">
              {listing.category}
            </span>
          </div>
        )}

        {/* View CTA */}
        <a
          href={`/listing/${listing.id}`}
          className="mt-auto pt-3 flex items-center justify-center gap-1.5 w-full text-sm font-semibold text-antique-accent hover:text-antique-accent-h border border-antique-border hover:border-antique-accent hover:bg-antique-muted rounded-xl py-2.5 transition-colors"
        >
          View Sale <ChevronRight className="w-4 h-4" />
        </a>
      </div>
    </article>
  );
}
