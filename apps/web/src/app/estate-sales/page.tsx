"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useCallback, useRef, forwardRef, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  MapPin, Search, ExternalLink, Calendar, Navigation, Loader2,
  ChevronRight, LayoutGrid, LayoutList, SlidersHorizontal, X,
  ArrowUpDown, ChevronDown, ChevronUp, Map as MapIcon,
} from "lucide-react";
import type { Listing } from "@/types";
import { formatPrice } from "@/lib/format";
import { CATEGORIES } from "@/lib/category-meta";
import { AdUnit } from "@/components/ads/ad-unit";
import { trackAffiliateClick } from "@/lib/analytics";
import { cn } from "@/lib/cn";

// Leaflet is browser-only — never SSR
const AuctionMapDynamic = dynamic(
  () => import("@/components/map/auction-map").then((m) => m.AuctionMap),
  { ssr: false, loading: () => <MapLoadingPlaceholder /> }
);

function MapLoadingPlaceholder() {
  return (
    <div className="h-full w-full bg-antique-muted flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-antique-accent animate-spin" />
    </div>
  );
}

// ── Amazon affiliate ───────────────────────────────────────────────────────────

const ESTATE_PREP_TAG = process.env.NEXT_PUBLIC_AMAZON_ASSOCIATES_TAG;
const ESTATE_PREP_LINKS = [
  { label: "Packing & moving supplies", keywords: "moving boxes packing supplies" },
  { label: "Storage & organization",    keywords: "storage bins closet organizers" },
  { label: "Cleaning & restoration",    keywords: "cleaning restoration kit antique" },
];
function buildAmazonUrl(k: string) {
  if (!ESTATE_PREP_TAG) return "#";
  return `https://www.amazon.com/s?${new URLSearchParams({ k, tag: ESTATE_PREP_TAG, linkCode: "ure" })}`;
}

// ── Platform directory ─────────────────────────────────────────────────────────

const PLATFORMS = [
  { name: "EstateSales.NET", description: "Largest US estate sale directory. Browse by city.",       url: "https://www.estatesales.net",                                  color: "blue",   emoji: "🏡" },
  { name: "EstateSales.org", description: "Nationwide sale listings with 'near me' search.",         url: "https://estatesales.org/estate-sales-near-me",                 color: "indigo", emoji: "📦" },
  { name: "gsalr.com",       description: "Map-based estate sale finder across the whole US.",        url: "https://www.gsalr.com/",                                       color: "violet", emoji: "🗺️" },
  { name: "Facebook",        description: "Neighborhood estate and garage sales posted daily.",       url: "https://www.facebook.com/marketplace/search/?q=estate+sale",  color: "sky",    emoji: "👥" },
  { name: "MaxSold",         description: "Online-only estate auctions with local pickup.",           url: "https://maxsold.com/auctions",                                 color: "amber",  emoji: "🔨" },
  { name: "HiBid",           description: "Live and timed auctions from local auction houses.",       url: "https://hibid.com/auctions",                                   color: "orange", emoji: "🏷️" },
  { name: "Craigslist",      description: "Local garage and estate sales posted by owners.",          url: "https://www.craigslist.org/search/sss?query=estate+sale",      color: "green",  emoji: "📋" },
  { name: "Nextdoor",        description: "Hyper-local neighborhood sales posted by neighbors.",      url: "https://nextdoor.com/find-nearby/",                            color: "teal",   emoji: "🏘️" },
];

const CARD_COLORS: Record<string, { bg: string; border: string; btn: string }> = {
  blue:   { bg: "bg-blue-50",   border: "border-blue-100",   btn: "bg-blue-600 hover:bg-blue-700" },
  indigo: { bg: "bg-indigo-50", border: "border-indigo-100", btn: "bg-indigo-600 hover:bg-indigo-700" },
  violet: { bg: "bg-violet-50", border: "border-violet-100", btn: "bg-violet-600 hover:bg-violet-700" },
  sky:    { bg: "bg-sky-50",    border: "border-sky-100",    btn: "bg-sky-600 hover:bg-sky-700" },
  amber:  { bg: "bg-amber-50",  border: "border-amber-100",  btn: "bg-amber-600 hover:bg-amber-700" },
  orange: { bg: "bg-orange-50", border: "border-orange-100", btn: "bg-orange-600 hover:bg-orange-700" },
  green:  { bg: "bg-green-50",  border: "border-green-100",  btn: "bg-green-600 hover:bg-green-700" },
  teal:   { bg: "bg-teal-50",   border: "border-teal-100",   btn: "bg-teal-600 hover:bg-teal-700" },
};

// ── Filter config ─────────────────────────────────────────────────────────────

const ESTATE_PLATFORMS = [
  { id: 2, label: "EstateSales.NET" },
  { id: 4, label: "MaxSold"         },
  { id: 3, label: "HiBid"           },
  { id: 5, label: "BidSpotter"      },
];

const STATUS_OPTIONS = [
  { label: "All statuses",    value: "" },
  { label: "Upcoming",        value: "upcoming" },
  { label: "Active now",      value: "live" },
  { label: "Ending this week",value: "ending_soon" },
];

const SALE_MODE_OPTIONS = [
  { label: "All listings",          value: "all" },
  { label: "Estate Sale Events",    value: "estate_sale" },
  { label: "Auction Items",         value: "auction" },
];

const SORT_OPTIONS = [
  { label: "Default order",      value: "" },
  { label: "Starting soonest",   value: "ending_soon" },
  { label: "Price: Low → High",  value: "price_asc" },
  { label: "Price: High → Low",  value: "price_desc" },
  { label: "Newest first",       value: "newest" },
];

const RADIUS_OPTIONS = [10, 25, 50, 100, 250];
const PAGE_SIZE = 24;
const DEFAULT_MAP_CENTER: [number, number] = [39.5, -98.35]; // geographic center of US
const DEFAULT_MAP_ZOOM = 4;

// ── Types ─────────────────────────────────────────────────────────────────────

interface Filters {
  q: string;
  status: string;
  category: string;
  minPrice: string;
  maxPrice: string;
  platformIds: number[];
  radiusMiles: number;
  sort: string;
  page: number;
  saleMode: "all" | "estate_sale" | "auction";
}

interface Location { lat: number; lon: number; label: string }

const DEFAULT_FILTERS: Filters = {
  q: "", status: "", category: "", minPrice: "", maxPrice: "",
  platformIds: [], radiusMiles: 50, sort: "", page: 1, saleMode: "all",
};

type ViewMode = "card" | "list" | "map";
const VIEW_KEY = "es_estate_view";

// ── Helpers ───────────────────────────────────────────────────────────────────

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
  } catch { return null; }
}

function buildApiParams(filters: Filters, loc: Location | null): URLSearchParams {
  // Use estate_sales_page=1 to tell the search route to include estate sale events
  // alongside auction items (the general search hides estate sales by default).
  // Pass listing_type only when the user has explicitly filtered by sale type.
  const p = new URLSearchParams({ estate_sales_page: "1", page_size: String(PAGE_SIZE) });
  if (filters.saleMode !== "all")  p.set("listing_type", filters.saleMode);
  if (filters.q.trim())            p.set("q", filters.q.trim());
  if (filters.status)              p.set("status", filters.status);
  if (filters.category)            p.set("category", filters.category);
  if (filters.minPrice)            p.set("min_price", filters.minPrice);
  if (filters.maxPrice)            p.set("max_price", filters.maxPrice);
  if (filters.sort)                p.set("sort", filters.sort);
  if (filters.page > 1)            p.set("page", String(filters.page));
  filters.platformIds.forEach((id) => p.append("platform_ids", String(id)));
  if (loc) {
    p.set("lat", String(loc.lat));
    p.set("lon", String(loc.lon));
    p.set("radius_miles", String(filters.radiusMiles));
  }
  return p;
}

function radiusToZoom(miles: number): number {
  if (miles <= 10) return 13;
  if (miles <= 25) return 12;
  if (miles <= 50) return 10;
  if (miles <= 100) return 9;
  return 7;
}

// ── Filter sidebar (estate-sale specific) ─────────────────────────────────────

function FilterSection({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-antique-border pb-4 mb-4 last:border-0 last:mb-0 last:pb-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full text-sm font-semibold text-antique-text mb-3"
      >
        {title}
        {open ? <ChevronUp className="w-4 h-4 text-antique-text-mute" /> : <ChevronDown className="w-4 h-4 text-antique-text-mute" />}
      </button>
      {open && children}
    </div>
  );
}

function EstateSaleFilters({
  filters,
  hasLocation,
  onChange,
}: {
  filters: Filters;
  hasLocation: boolean;
  onChange: (patch: Partial<Filters>) => void;
}) {
  const activeCount = [
    filters.status,
    filters.category,
    filters.minPrice,
    filters.maxPrice,
    filters.platformIds.length > 0,
    filters.saleMode !== "all",
    hasLocation && filters.radiusMiles !== 50,
  ].filter(Boolean).length;

  return (
    <div className="space-y-0">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-bold text-antique-text">Filters</h2>
        {activeCount > 0 && (
          <button
            onClick={() => onChange({ status: "", category: "", minPrice: "", maxPrice: "", platformIds: [], radiusMiles: 50, saleMode: "all" as const })}
            className="text-xs text-antique-accent hover:text-antique-accent-h font-medium"
          >
            Clear all ({activeCount})
          </button>
        )}
      </div>

      {/* Sale Type */}
      <FilterSection title="Sale Type">
        <div className="space-y-1.5">
          {SALE_MODE_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="radio"
                name="es_sale_mode"
                checked={filters.saleMode === opt.value}
                onChange={() => onChange({ saleMode: opt.value as "all" | "estate_sale" | "auction", page: 1 })}
                className="w-4 h-4"
              />
              <span className="text-sm text-antique-text-sec group-hover:text-antique-accent transition-colors">
                {opt.label}
              </span>
            </label>
          ))}
        </div>
      </FilterSection>

      {/* Status */}
      <FilterSection title="Sale Status">
        <div className="space-y-1.5">
          {STATUS_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="radio"
                name="es_status"
                checked={filters.status === opt.value}
                onChange={() => onChange({ status: opt.value, page: 1 })}
                className="w-4 h-4"
              />
              <span className="text-sm text-antique-text-sec group-hover:text-antique-accent transition-colors">
                {opt.label}
              </span>
            </label>
          ))}
        </div>
      </FilterSection>

      {/* Category */}
      <FilterSection title="Category" defaultOpen={false}>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.slug}
              onClick={() => onChange({ category: filters.category === cat.slug ? "" : cat.slug, page: 1 })}
              title={cat.description}
              className={cn(
                "text-xs px-2.5 py-1 rounded-full border transition-colors",
                filters.category === cat.slug
                  ? "bg-antique-accent text-white border-antique-accent"
                  : "bg-antique-surface border-antique-border text-antique-text-sec hover:border-antique-accent"
              )}
            >
              {cat.icon} {cat.shortLabel}
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Price range */}
      <FilterSection title="Price Range" defaultOpen={false}>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <label className="text-xs text-antique-text-mute mb-1 block">Min ($)</label>
            <input
              type="number" min={0} placeholder="0"
              value={filters.minPrice}
              onChange={(e) => onChange({ minPrice: e.target.value, page: 1 })}
              className="w-full border border-antique-border bg-antique-surface text-antique-text rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-antique-accent"
            />
          </div>
          <span className="text-antique-text-mute mt-5">—</span>
          <div className="flex-1">
            <label className="text-xs text-antique-text-mute mb-1 block">Max ($)</label>
            <input
              type="number" min={0} placeholder="Any"
              value={filters.maxPrice}
              onChange={(e) => onChange({ maxPrice: e.target.value, page: 1 })}
              className="w-full border border-antique-border bg-antique-surface text-antique-text rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-antique-accent"
            />
          </div>
        </div>
      </FilterSection>

      {/* Radius — only meaningful when location is set */}
      <FilterSection title="Search Radius" defaultOpen={hasLocation}>
        <div className="flex flex-wrap gap-2">
          {RADIUS_OPTIONS.map((mi) => (
            <button
              key={mi}
              onClick={() => onChange({ radiusMiles: mi, page: 1 })}
              className={cn(
                "text-xs px-3 py-1 rounded-full border transition-colors",
                filters.radiusMiles === mi
                  ? "bg-antique-accent text-white border-antique-accent"
                  : "bg-antique-surface border-antique-border text-antique-text-sec hover:border-antique-accent"
              )}
            >
              {mi} mi
            </button>
          ))}
        </div>
        {!hasLocation && (
          <p className="text-xs text-antique-text-mute mt-2">Enter a ZIP or use Near Me to apply radius</p>
        )}
      </FilterSection>

      {/* Platform */}
      <FilterSection title="Platform" defaultOpen={false}>
        <div className="space-y-1.5">
          {ESTATE_PLATFORMS.map((p) => {
            const checked = filters.platformIds.includes(p.id);
            return (
              <label key={p.id} className="flex items-center gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...filters.platformIds, p.id]
                      : filters.platformIds.filter((id) => id !== p.id);
                    onChange({ platformIds: next, page: 1 });
                  }}
                  className="w-4 h-4"
                />
                <span className="text-sm text-antique-text-sec group-hover:text-antique-accent transition-colors">
                  {p.label}
                </span>
              </label>
            );
          })}
        </div>
      </FilterSection>
    </div>
  );
}

// ── Map side card ──────────────────────────────────────────────────────────────

const MapSideCard = forwardRef<
  HTMLDivElement,
  { listing: Listing; selected: boolean; onClick: () => void }
>(function MapSideCard({ listing, selected, onClick }, ref) {
  const startLabel = daysUntil(listing.sale_starts_at as string | null);
  const isSoon = startLabel === "Active" || startLabel === "Tomorrow";

  return (
    <div
      ref={ref}
      onClick={onClick}
      className={cn(
        "flex gap-3 p-3 border-b border-antique-border cursor-pointer transition-colors",
        selected
          ? "bg-antique-accent-s border-l-4 border-l-antique-accent"
          : "hover:bg-antique-muted"
      )}
    >
      <div className="relative w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-antique-muted">
        {listing.primary_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.primary_image_url}
            alt={listing.title}
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl">🏡</div>
        )}
      </div>

      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-semibold text-antique-accent uppercase tracking-wide">
            {listing.platform?.display_name ?? "Estate Sale"}
          </span>
          {isSoon && (
            <span className="text-[10px] font-bold bg-antique-accent text-white px-1.5 py-px rounded-full">
              {startLabel}
            </span>
          )}
        </div>
        <p className="text-sm font-medium text-antique-text line-clamp-2 leading-snug">
          {listing.title}
        </p>
        {(listing.city || listing.state) && (
          <p className="text-xs text-antique-text-sec">
            📍 {[listing.city, listing.state].filter(Boolean).join(", ")}
            {listing.distance_miles != null && (
              <span className="ml-1 text-antique-text-mute">· {listing.distance_miles.toFixed(1)} mi</span>
            )}
          </p>
        )}
        {(listing.sale_starts_at || listing.sale_ends_at) && (
          <p className="text-xs text-antique-text-mute flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {fmtDate(listing.sale_starts_at as string | null)}
            {listing.sale_ends_at && ` – ${fmtDate(listing.sale_ends_at as string | null)}`}
          </p>
        )}
        <div className="flex items-center justify-between pt-0.5">
          {listing.current_price != null && (
            <span className="text-sm font-bold text-antique-accent">
              {formatPrice(listing.current_price)}
            </span>
          )}
          <a
            href={`/listing/${listing.id}`}
            onClick={(e) => e.stopPropagation()}
            className="ml-auto text-xs text-antique-accent hover:text-antique-accent-h flex items-center gap-0.5"
          >
            Details <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
});

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EstateSalesPage() {
  const [listings, setListings]             = useState<Listing[]>([]);
  const [loading, setLoading]               = useState(false);
  const [geoLoading, setGeoLoading]         = useState(false);
  const [error, setError]                   = useState("");
  const [filters, setFilters]               = useState<Filters>(DEFAULT_FILTERS);
  const [location, setLocation]             = useState<Location | null>(null);
  const [zip, setZip]                       = useState("");
  const [viewMode, setViewMode]             = useState<ViewMode>("card");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [showPlatforms, setShowPlatforms]   = useState(false);
  const [hasMore, setHasMore]               = useState(false);
  const [mapCenter, setMapCenter]           = useState<[number, number]>(DEFAULT_MAP_CENTER);
  const [mapZoom, setMapZoom]               = useState(DEFAULT_MAP_ZOOM);
  const [selectedMapId, setSelectedMapId]   = useState<number | null>(null);
  const abortRef      = useRef<AbortController | null>(null);
  const sideListRefs  = useRef<Map<number, HTMLDivElement>>(new Map());

  // Restore view mode from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(VIEW_KEY);
    if (saved === "list" || saved === "card" || saved === "map") setViewMode(saved as ViewMode);
  }, []);

  function changeView(mode: ViewMode) {
    setViewMode(mode);
    localStorage.setItem(VIEW_KEY, mode);
  }

  // Fetch whenever server-side filters or location change
  useEffect(() => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const params = buildApiParams(filters, location);
        const res = await fetch(`/api/v1/search?${params}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        // API returns SearchResult { results, total, page, ... } — not a bare array
        const json = await res.json();
        const data: Listing[] = Array.isArray(json) ? json : (json.results ?? []);
        setListings(data);
        setHasMore(data.length >= PAGE_SIZE);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError("Failed to load listings. Please try again.");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }
    load();
  }, [filters, location]);

  function patchFilters(patch: Partial<Filters>) {
    setFilters((f) => ({ ...f, ...patch }));
  }

  // listing_type filter is applied server-side via buildApiParams
  const displayListings = listings;

  // ZIP search
  const handleZipSearch = useCallback(async () => {
    const trimmed = zip.trim();
    if (!/^\d{5}$/.test(trimmed)) { setError("Please enter a valid 5-digit ZIP code."); return; }
    setError("");
    const coords = await zipToCoords(trimmed);
    if (!coords) { setError(`Couldn't locate ZIP "${trimmed}".`); return; }
    const loc: Location = { ...coords, label: `ZIP ${trimmed}` };
    setLocation(loc);
    setMapCenter([coords.lat, coords.lon]);
    setMapZoom(radiusToZoom(filters.radiusMiles));
    patchFilters({ page: 1 });
  }, [zip, filters.radiusMiles]);

  // Geolocation
  const handleNearMe = useCallback(() => {
    if (!navigator.geolocation) { setError("Geolocation not supported."); return; }
    setGeoLoading(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc: Location = { lat: pos.coords.latitude, lon: pos.coords.longitude, label: "your location" };
        setLocation(loc);
        setMapCenter([pos.coords.latitude, pos.coords.longitude]);
        setMapZoom(radiusToZoom(filters.radiusMiles));
        patchFilters({ page: 1 });
        setGeoLoading(false);
      },
      () => {
        setError("Couldn't access location. Enter a ZIP instead.");
        setGeoLoading(false);
      }
    );
  }, [filters.radiusMiles]);

  function clearLocation() {
    setLocation(null);
    setZip("");
    setMapCenter(DEFAULT_MAP_CENTER);
    setMapZoom(DEFAULT_MAP_ZOOM);
    patchFilters({ page: 1 });
  }

  function handleMarkerClick(id: number) {
    setSelectedMapId(id);
    const el = sideListRefs.current.get(id);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  const isLoading = loading || geoLoading;
  const activeFilterCount = [
    filters.status, filters.category, filters.minPrice, filters.maxPrice,
    filters.platformIds.length > 0,
    filters.saleMode !== "all",
  ].filter(Boolean).length;

  const filterPanel = (
    <EstateSaleFilters
      filters={filters}
      hasLocation={!!location}
      onChange={patchFilters}
    />
  );

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">

      {/* ── Hero ── */}
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-antique-text mb-1">
          Find Local Estate Sales
        </h1>
        <p className="text-antique-text-sec mb-6">
          Browse upcoming estate sales and online estate auctions across EstateSales.net, MaxSold, HiBid, and more.
        </p>

        {/* Search + location bar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Keyword search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-antique-text-mute pointer-events-none" />
            <input
              type="text"
              value={filters.q}
              onChange={(e) => patchFilters({ q: e.target.value, page: 1 })}
              onKeyDown={(e) => e.key === "Enter" && patchFilters({ page: 1 })}
              placeholder="Search estate sales…"
              className="w-full pl-9 pr-4 py-2.5 border border-antique-border rounded-xl text-sm bg-antique-surface text-antique-text placeholder:text-antique-text-mute focus:outline-none focus:border-antique-accent transition-colors"
            />
          </div>

          {/* ZIP */}
          <div className="relative flex-shrink-0">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-antique-accent pointer-events-none" />
            <input
              type="text"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleZipSearch()}
              placeholder="ZIP code"
              maxLength={5}
              className="pl-9 pr-3 py-2.5 border border-antique-border rounded-xl text-sm w-28 bg-antique-surface text-antique-text placeholder:text-antique-text-mute focus:outline-none focus:border-antique-accent transition-colors"
            />
          </div>

          <button
            onClick={handleZipSearch}
            disabled={isLoading || !zip.trim()}
            className="bg-antique-accent hover:bg-antique-accent-h disabled:opacity-40 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors flex-shrink-0"
          >
            Go
          </button>

          <button
            onClick={handleNearMe}
            disabled={isLoading}
            className="flex items-center gap-1.5 border border-antique-border text-antique-text-sec hover:border-antique-accent hover:text-antique-accent disabled:opacity-40 px-3 py-2.5 rounded-xl text-sm transition-colors bg-antique-surface flex-shrink-0"
          >
            {geoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
            <span className="hidden sm:inline">Near Me</span>
          </button>

          {/* Active location chip */}
          {location && (
            <div className="flex items-center gap-1.5 bg-antique-accent-s border border-antique-accent-lt text-antique-accent text-xs font-medium px-3 py-2 rounded-xl flex-shrink-0">
              <MapPin className="w-3.5 h-3.5" />
              {location.label} · {filters.radiusMiles} mi
              <button onClick={clearLocation} className="ml-1 hover:text-antique-accent-h">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Mobile filter toggle */}
          <button
            onClick={() => setMobileFiltersOpen(true)}
            className="lg:hidden flex items-center gap-1.5 border border-antique-border bg-antique-surface text-antique-text-sec rounded-xl px-3 py-2.5 text-sm font-medium hover:border-antique-accent transition-colors flex-shrink-0"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="bg-antique-accent text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {error && <p className="text-red-600 text-sm mt-2 font-medium">{error}</p>}
      </div>

      {/* ── Ads + affiliate ── */}
      <AdUnit slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_ESTATE ?? ""} format="rectangle" className="mb-4" />
      {ESTATE_PREP_TAG && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mb-6 px-4 py-2.5 bg-antique-surface border border-antique-border rounded-xl text-sm">
          <span className="text-antique-text-mute text-[11px] uppercase tracking-widest font-medium">Sponsored</span>
          {ESTATE_PREP_LINKS.map((link) => {
            const url = buildAmazonUrl(link.keywords);
            return (
              <a key={link.keywords} href={url} target="_blank" rel="noopener noreferrer sponsored"
                onClick={() => trackAffiliateClick({ category: "estate_sale", keywords: link.keywords, url })}
                className="text-antique-accent hover:underline transition-colors font-medium">
                {link.label}
              </a>
            );
          })}
          <span className="ml-auto text-antique-text-mute text-[11px]">via Amazon ↗</span>
        </div>
      )}

      {/* ── Platform directory (collapsible) ── */}
      <div className="mb-6 border border-antique-border rounded-2xl overflow-hidden bg-antique-surface">
        <button
          onClick={() => setShowPlatforms((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-semibold text-antique-text hover:bg-antique-muted transition-colors"
        >
          <span className="flex items-center gap-2">
            <span>Browse by Platform</span>
            <span className="text-xs font-normal text-antique-text-mute">8 sources</span>
          </span>
          {showPlatforms ? <ChevronUp className="w-4 h-4 text-antique-text-mute" /> : <ChevronDown className="w-4 h-4 text-antique-text-mute" />}
        </button>
        {showPlatforms && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-4 pb-4">
            {PLATFORMS.map((p) => {
              const c = CARD_COLORS[p.color];
              return (
                <a key={p.name} href={p.url} target="_blank" rel="noopener noreferrer"
                  className={`rounded-xl border p-3 flex flex-col gap-2 transition-all hover:shadow-md hover:-translate-y-0.5 ${c.bg} ${c.border}`}>
                  <span className="text-xl">{p.emoji}</span>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 text-xs">{p.name}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">{p.description}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-semibold text-white px-2 py-1 rounded-md self-start ${c.btn}`}>
                    Browse <ExternalLink className="w-2.5 h-2.5" />
                  </span>
                </a>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Main content (sidebar + results) ── */}
      <div className="flex gap-6 items-start">

        {/* Desktop sidebar */}
        <aside className="hidden lg:block w-52 flex-shrink-0">
          <div className="bg-antique-surface border border-antique-border rounded-2xl p-4 sticky top-4">
            {filterPanel}
          </div>
        </aside>

        {/* Results pane */}
        <div className="flex-1 min-w-0">

          {/* Toolbar */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <p className="text-sm text-antique-text-mute flex-1">
              {isLoading ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                </span>
              ) : (
                <>
                  <span className="font-semibold text-antique-text">{displayListings.length}</span>{" "}
                  estate sale{displayListings.length !== 1 ? "s" : ""}
                  {location && <> within <span className="font-medium">{filters.radiusMiles} mi</span> of {location.label}</>}
                </>
              )}
            </p>

            {/* Sort (hidden in map mode) */}
            {viewMode !== "map" && (
              <div className="flex items-center gap-1.5">
                <ArrowUpDown className="w-3.5 h-3.5 text-antique-text-mute" />
                <select
                  value={filters.sort}
                  onChange={(e) => patchFilters({ sort: e.target.value, page: 1 })}
                  className="bg-antique-surface border border-antique-border rounded-lg px-2.5 py-1.5 text-sm text-antique-text focus:outline-none focus:ring-2 focus:ring-antique-accent cursor-pointer"
                >
                  {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            )}

            {/* View toggle: Card | List | Map */}
            <div className="flex border border-antique-border rounded-lg overflow-hidden">
              {([
                { mode: "card" as ViewMode, icon: <LayoutGrid className="w-4 h-4" />, label: "Card view" },
                { mode: "list" as ViewMode, icon: <LayoutList className="w-4 h-4" />, label: "List view" },
                { mode: "map"  as ViewMode, icon: <MapIcon className="w-4 h-4" />,    label: "Map view" },
              ]).map(({ mode, icon, label }) => (
                <button
                  key={mode}
                  onClick={() => changeView(mode)}
                  aria-label={label}
                  title={label}
                  className={cn(
                    "p-1.5 transition-colors",
                    viewMode === mode
                      ? "bg-antique-accent text-white"
                      : "bg-antique-surface text-antique-text-mute hover:text-antique-text"
                  )}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          {/* Active filter pills */}
          {(filters.category || filters.status || filters.minPrice || filters.maxPrice || filters.platformIds.length > 0 || filters.saleMode !== "all") && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {filters.saleMode !== "all" && (
                <FilterPill
                  label={SALE_MODE_OPTIONS.find((o) => o.value === filters.saleMode)?.label ?? filters.saleMode}
                  onRemove={() => patchFilters({ saleMode: "all", page: 1 })}
                />
              )}
              {filters.status && (
                <FilterPill label={STATUS_OPTIONS.find((o) => o.value === filters.status)?.label ?? filters.status}
                  onRemove={() => patchFilters({ status: "", page: 1 })} />
              )}
              {filters.category && (
                <FilterPill label={CATEGORIES.find((c) => c.slug === filters.category)?.label ?? filters.category}
                  onRemove={() => patchFilters({ category: "", page: 1 })} />
              )}
              {(filters.minPrice || filters.maxPrice) && (
                <FilterPill
                  label={`$${filters.minPrice || "0"} – $${filters.maxPrice || "any"}`}
                  onRemove={() => patchFilters({ minPrice: "", maxPrice: "", page: 1 })}
                />
              )}
              {filters.platformIds.map((id) => {
                const p = ESTATE_PLATFORMS.find((ep) => ep.id === id);
                return p ? (
                  <FilterPill key={id} label={p.label}
                    onRemove={() => patchFilters({ platformIds: filters.platformIds.filter((i) => i !== id), page: 1 })} />
                ) : null;
              })}
            </div>
          )}

          {/* ── Map view ── */}
          {viewMode === "map" ? (
            <div className="border border-antique-border rounded-2xl overflow-hidden flex h-[calc(100vh-300px)] min-h-[500px]">

              {/* Side list */}
              <aside className="hidden md:flex flex-col w-72 xl:w-80 flex-shrink-0 border-r border-antique-border bg-antique-surface overflow-y-auto">
                <div className="px-4 py-2.5 border-b border-antique-border bg-antique-muted flex-shrink-0">
                  <p className="text-xs font-semibold text-antique-text-sec uppercase tracking-wide">
                    {isLoading
                      ? "Loading…"
                      : `${displayListings.length} sale${displayListings.length !== 1 ? "s" : ""}${location ? ` · ${filters.radiusMiles} mi` : ""}`
                    }
                  </p>
                </div>

                {displayListings.length === 0 && !isLoading ? (
                  <div className="flex flex-col items-center justify-center flex-1 p-6 text-center text-antique-text-mute">
                    <MapPin className="w-8 h-8 mb-2 opacity-30" />
                    <p className="text-sm font-medium text-antique-text-sec">No sales found</p>
                    <p className="text-xs mt-1">Try a different location or broader filters.</p>
                  </div>
                ) : (
                  displayListings.map((listing) => (
                    <MapSideCard
                      key={listing.id}
                      listing={listing}
                      selected={listing.id === selectedMapId}
                      onClick={() => {
                        setSelectedMapId(listing.id);
                        if (listing.latitude && listing.longitude) {
                          setMapCenter([listing.latitude, listing.longitude]);
                          setMapZoom(14);
                        }
                      }}
                      ref={(el) => {
                        if (el) sideListRefs.current.set(listing.id, el);
                        else sideListRefs.current.delete(listing.id);
                      }}
                    />
                  ))
                )}
              </aside>

              {/* Map */}
              <div className="flex-1 relative">
                <AuctionMapDynamic
                  listings={displayListings}
                  center={mapCenter}
                  zoom={mapZoom}
                  selectedId={selectedMapId}
                  onMarkerClick={handleMarkerClick}
                />

                {/* Prompt when no location set */}
                {!location && !isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="bg-antique-surface/95 backdrop-blur-sm rounded-xl shadow-lg border border-antique-border px-6 py-5 text-center max-w-xs pointer-events-auto">
                      <MapPin className="w-8 h-8 text-antique-accent mx-auto mb-2" />
                      <p className="font-display font-bold text-antique-text text-base">Find Sales Near You</p>
                      <p className="text-xs text-antique-text-sec mt-1 leading-relaxed">
                        Enter a ZIP code or tap &ldquo;Near Me&rdquo; above to see estate sales on the map.
                      </p>
                    </div>
                  </div>
                )}

                {/* Mobile: "List" button overlay */}
                <button
                  onClick={() => changeView("list")}
                  className="md:hidden absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2 bg-antique-surface border border-antique-border shadow-lg text-antique-text text-sm font-medium px-4 py-2 rounded-full"
                >
                  <LayoutList className="w-4 h-4" />
                  View as list
                </button>
              </div>
            </div>

          ) : /* ── Card / List view ── */ listings.length === 0 && !isLoading ? (
            <div className="text-center py-20 text-antique-text-mute">
              <MapPin className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-semibold text-antique-text-sec">No estate sales found</p>
              <p className="text-sm mt-1">
                Try broadening your filters, searching a different area, or browsing a platform directly above.
              </p>
              {activeFilterCount > 0 && (
                <button
                  onClick={() => setFilters(DEFAULT_FILTERS)}
                  className="mt-4 text-sm text-antique-accent hover:underline"
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : viewMode === "card" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {displayListings.map((listing) => (
                <EstateSaleCard key={listing.id} listing={listing} />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {displayListings.map((listing) => (
                <EstateSaleRow key={listing.id} listing={listing} />
              ))}
            </div>
          )}

          {/* Load more (card/list only) */}
          {viewMode !== "map" && hasMore && !isLoading && displayListings.length > 0 && (
            <div className="mt-8 text-center">
              <button
                onClick={() => patchFilters({ page: filters.page + 1 })}
                className="inline-flex items-center gap-2 border border-antique-border text-antique-text-sec bg-antique-surface px-8 py-3 rounded-xl hover:border-antique-accent hover:text-antique-accent transition-all font-medium text-sm"
              >
                Load more estate sales
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile filter drawer */}
      {mobileFiltersOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileFiltersOpen(false)} />
          <div className="relative ml-auto w-80 max-w-full h-full bg-antique-surface shadow-2xl overflow-y-auto p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-antique-text">Filters</h2>
              <button onClick={() => setMobileFiltersOpen(false)}>
                <X className="w-5 h-5 text-antique-text-mute" />
              </button>
            </div>
            {filterPanel}
            <button
              onClick={() => setMobileFiltersOpen(false)}
              className="mt-6 w-full bg-antique-accent text-white py-3 rounded-xl font-semibold hover:bg-antique-accent-h transition-colors"
            >
              Show Results
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Filter pill ───────────────────────────────────────────────────────────────

function FilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 bg-antique-accent-s border border-antique-accent-lt text-antique-accent text-xs font-medium px-2.5 py-1 rounded-full">
      {label}
      <button onClick={onRemove} className="hover:text-antique-accent-h ml-0.5">
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

// ── Card view ─────────────────────────────────────────────────────────────────

function EstateSaleCard({ listing }: { listing: Listing }) {
  const [imgError, setImgError] = useState(false);
  const startLabel = daysUntil(listing.sale_starts_at as string | null);
  const isSoon = startLabel === "Active" || startLabel === "Tomorrow";

  return (
    <article className="bg-antique-surface border border-antique-border rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:border-antique-accent transition-all flex flex-col">
      <div className="relative h-44 bg-antique-muted flex-shrink-0">
        {listing.primary_image_url && !imgError ? (
          <Image
            src={listing.primary_image_url}
            alt={listing.title}
            fill
            unoptimized
            className="object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl opacity-20">🏡</div>
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
        {/* In person / online badge */}
        <div className="absolute bottom-2 left-2">
          {listing.pickup_only && !listing.ships_nationally ? (
            <span className="bg-black/60 text-white text-[10px] font-medium px-2 py-0.5 rounded-full">In Person</span>
          ) : listing.ships_nationally ? (
            <span className="bg-black/60 text-white text-[10px] font-medium px-2 py-0.5 rounded-full">Online</span>
          ) : null}
        </div>
      </div>

      <div className="p-4 flex flex-col gap-2 flex-1">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-antique-accent">
          {listing.platform?.display_name ?? "Estate Sale"}
        </span>

        <h3 className="font-semibold text-antique-text text-sm leading-snug line-clamp-2">
          {listing.title}
        </h3>

        {(listing.city || listing.state) && (
          <div className="flex items-center gap-1.5 text-xs text-antique-text-sec">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
            {[listing.city, listing.state].filter(Boolean).join(", ")}
            {listing.zip_code && ` ${listing.zip_code}`}
            {listing.distance_miles != null && (
              <span className="text-antique-text-mute ml-1">· {listing.distance_miles.toFixed(1)} mi</span>
            )}
          </div>
        )}

        {(listing.sale_starts_at || listing.sale_ends_at) && (
          <div className="flex items-center gap-1.5 text-xs text-antique-text-sec">
            <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
            {startLabel && <span className="font-semibold text-antique-text">{startLabel}</span>}
            <span>
              {fmtDate(listing.sale_starts_at as string | null)}
              {listing.sale_ends_at && ` – ${fmtDate(listing.sale_ends_at as string | null)}`}
            </span>
          </div>
        )}

        {listing.current_price != null && (
          <p className="text-xs text-antique-text-sec">
            Starting at <span className="font-bold text-antique-accent">{formatPrice(listing.current_price)}</span>
          </p>
        )}

        {listing.category && (
          <span className="text-xs bg-antique-muted text-antique-text-sec px-2 py-0.5 rounded-full border border-antique-border w-fit">
            {listing.category}
          </span>
        )}

        <Link
          href={`/listing/${listing.id}`}
          className="mt-auto pt-3 flex items-center justify-center gap-1.5 w-full text-sm font-semibold text-antique-accent hover:text-antique-accent-h border border-antique-border hover:border-antique-accent hover:bg-antique-muted rounded-xl py-2.5 transition-colors"
        >
          View Sale <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </article>
  );
}

// ── List view row ─────────────────────────────────────────────────────────────

function EstateSaleRow({ listing }: { listing: Listing }) {
  const [imgError, setImgError] = useState(false);
  const startLabel = daysUntil(listing.sale_starts_at as string | null);
  const isSoon = startLabel === "Active" || startLabel === "Tomorrow";

  return (
    <Link
      href={`/listing/${listing.id}`}
      className="group flex items-center gap-4 bg-antique-surface border border-antique-border rounded-xl p-3 hover:border-antique-accent hover:shadow-sm transition-all"
    >
      {/* Thumbnail */}
      <div className="relative w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden bg-antique-muted">
        {listing.primary_image_url && !imgError ? (
          <Image
            src={listing.primary_image_url}
            alt={listing.title}
            fill
            unoptimized
            className="object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl">🏡</div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-wide text-antique-accent">
            {listing.platform?.display_name ?? "Estate Sale"}
          </span>
          {isSoon && (
            <span className="text-[10px] font-bold bg-antique-accent text-white px-2 py-0.5 rounded-full">
              {startLabel}
            </span>
          )}
          {listing.is_sponsored && (
            <span className="text-[10px] font-medium border border-antique-border text-antique-text-mute px-2 py-0.5 rounded-full">
              Sponsored
            </span>
          )}
          {listing.pickup_only && !listing.ships_nationally && (
            <span className="text-[10px] font-medium border border-antique-border text-antique-text-mute px-2 py-0.5 rounded-full">In Person</span>
          )}
          {listing.ships_nationally && (
            <span className="text-[10px] font-medium border border-antique-border text-antique-text-mute px-2 py-0.5 rounded-full">Online</span>
          )}
        </div>

        <p className="text-sm font-medium text-antique-text line-clamp-1 group-hover:text-antique-accent transition-colors">
          {listing.title}
        </p>

        <div className="flex items-center gap-3 flex-wrap text-xs text-antique-text-mute">
          {(listing.city || listing.state) && (
            <span className="flex items-center gap-0.5">
              <MapPin className="w-3 h-3" />
              {[listing.city, listing.state].filter(Boolean).join(", ")}
              {listing.distance_miles != null && <span className="ml-1">· {listing.distance_miles.toFixed(1)} mi</span>}
            </span>
          )}
          {(listing.sale_starts_at || listing.sale_ends_at) && (
            <span className="flex items-center gap-0.5">
              <Calendar className="w-3 h-3" />
              {fmtDate(listing.sale_starts_at as string | null)}
              {listing.sale_ends_at && ` – ${fmtDate(listing.sale_ends_at as string | null)}`}
            </span>
          )}
          {listing.category && <span>{listing.category}</span>}
        </div>
      </div>

      {/* Price / date — right */}
      <div className="flex-shrink-0 text-right min-w-[90px] space-y-1">
        {listing.current_price != null ? (
          <p className="text-sm font-bold text-antique-accent">{formatPrice(listing.current_price)}</p>
        ) : listing.sale_starts_at ? (
          <p className="text-sm font-bold text-antique-accent">{fmtDate(listing.sale_starts_at as string | null)}</p>
        ) : null}
        <p className="text-xs text-antique-text-mute">
          {listing.sale_ends_at
            ? `Ends ${fmtDate(listing.sale_ends_at as string | null)}`
            : "Estate Sale"}
        </p>
      </div>
    </Link>
  );
}
