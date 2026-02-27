"use client";

import dynamic from "next/dynamic";
import { useState, useCallback, useRef } from "react";
import { Search, MapPin, Loader2, ExternalLink, ChevronDown } from "lucide-react";
import type { Listing } from "@/types";
import { formatPrice } from "@/lib/format";

// Leaflet is browser-only — never SSR
const AuctionMap = dynamic(
  () =>
    import("@/components/map/auction-map").then((m) => m.AuctionMap),
  { ssr: false, loading: () => <MapPlaceholder /> }
);

// ── Constants ─────────────────────────────────────────────────────────────────

const RADIUS_OPTIONS = [10, 25, 50, 100, 200];
const DEFAULT_CENTER: [number, number] = [39.5, -98.35]; // geographic centre of US
const DEFAULT_ZOOM = 4;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function zipToLatLon(
  zip: string
): Promise<{ lat: number; lon: number; city: string; state: string } | null> {
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip.trim()}`);
    if (!res.ok) return null;
    const data = await res.json();
    const place = data.places?.[0];
    if (!place) return null;
    return {
      lat: parseFloat(place.latitude),
      lon: parseFloat(place.longitude),
      city: place["place name"] ?? "",
      state: place["state abbreviation"] ?? "",
    };
  } catch {
    return null;
  }
}

// ── Map placeholder (shown while Leaflet loads) ───────────────────────────────

function MapPlaceholder() {
  return (
    <div className="h-full w-full bg-gray-100 flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function MapSearch() {
  const [zip, setZip] = useState("");
  const [radius, setRadius] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [listings, setListings] = useState<Listing[]>([]);
  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [locationLabel, setLocationLabel] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const listItemRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const handleSearch = useCallback(async () => {
    const trimmed = zip.trim();
    if (!trimmed) {
      setError("Please enter a ZIP code.");
      return;
    }
    if (!/^\d{5}$/.test(trimmed)) {
      setError("Please enter a valid 5-digit US ZIP code.");
      return;
    }

    setLoading(true);
    setError("");
    setListings([]);
    setSelectedId(null);

    // 1. Resolve ZIP → lat/lon
    const geo = await zipToLatLon(trimmed);
    if (!geo) {
      setError(`ZIP code "${trimmed}" not found. Please try another.`);
      setLoading(false);
      return;
    }

    // 2. Fetch nearby listings from our search API
    const params = new URLSearchParams({
      lat: String(geo.lat),
      lon: String(geo.lon),
      radius_miles: String(radius),
      page_size: "200",
      sort: "ending_soon",
    });

    try {
      const res = await fetch(`/api/v1/search?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Listing[] = await res.json();

      setListings(data);
      setCenter([geo.lat, geo.lon]);
      setZoom(radius <= 25 ? 12 : radius <= 75 ? 10 : 8);
      setLocationLabel(`${geo.city}, ${geo.state} ${trimmed}`);
    } catch {
      setError("Failed to fetch listings. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [zip, radius]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleMarkerClick = (id: number) => {
    setSelectedId(id);
    const el = listItemRefs.current.get(id);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const searched = locationLabel !== "";

  return (
    <div className="flex flex-col h-full">
      {/* ── Search bar ──────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex flex-wrap items-center gap-3 z-10 shadow-sm">
        {/* ZIP input */}
        <div className="relative flex-shrink-0">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={zip}
            onChange={(e) => setZip(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter ZIP code"
            maxLength={5}
            className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm w-40 focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        {/* Radius selector */}
        <div className="relative flex-shrink-0">
          <select
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
          >
            {RADIUS_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r} mi radius
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>

        {/* Search button */}
        <button
          onClick={handleSearch}
          disabled={loading}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex-shrink-0"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          Find Auctions
        </button>

        {/* Result count / location label */}
        {searched && !loading && (
          <span className="text-sm text-gray-500 ml-1">
            {listings.length > 0 ? (
              <>
                <span className="font-semibold text-gray-800">
                  {listings.length}
                </span>{" "}
                auction{listings.length !== 1 ? "s" : ""} within {radius} mi
                of {locationLabel}
              </>
            ) : (
              <>No auctions found within {radius} mi of {locationLabel}</>
            )}
          </span>
        )}

        {/* Error */}
        {error && (
          <span className="text-sm text-red-600 font-medium">{error}</span>
        )}
      </div>

      {/* ── Map + side list ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Map (takes all remaining space on mobile, flex-1 on desktop) */}
        <div className="flex-1 relative">
          <AuctionMap
            listings={listings}
            center={center}
            zoom={zoom}
            selectedId={selectedId}
            onMarkerClick={handleMarkerClick}
          />

          {/* Overlay hint when no search yet */}
          {!searched && !loading && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg px-6 py-4 text-center max-w-xs pointer-events-auto">
                <MapPin className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                <p className="font-semibold text-gray-800 text-sm">
                  Discover nearby auctions
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Enter a US ZIP code above to find estate sales and auctions
                  on the map.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Side list (hidden on mobile when empty) */}
        {listings.length > 0 && (
          <aside className="hidden md:flex flex-col w-80 xl:w-96 border-l border-gray-200 bg-white overflow-y-auto">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {listings.length} Result{listings.length !== 1 ? "s" : ""} · Sorted by ending soon
              </p>
            </div>

            {listings.map((listing) => (
              <SideCard
                key={listing.id}
                listing={listing}
                selected={listing.id === selectedId}
                onClick={() => {
                  setSelectedId(listing.id);
                  setCenter([listing.latitude!, listing.longitude!]);
                  setZoom(14);
                }}
                ref={(el) => {
                  if (el) listItemRefs.current.set(listing.id, el);
                  else listItemRefs.current.delete(listing.id);
                }}
              />
            ))}
          </aside>
        )}
      </div>
    </div>
  );
}

// ── Side list card ─────────────────────────────────────────────────────────────

import { forwardRef } from "react";

const SideCard = forwardRef<
  HTMLDivElement,
  {
    listing: Listing;
    selected: boolean;
    onClick: () => void;
  }
>(function SideCard({ listing, selected, onClick }, ref) {
  return (
    <div
      ref={ref}
      onClick={onClick}
      className={`flex gap-3 p-3 border-b border-gray-100 cursor-pointer transition-colors ${
        selected
          ? "bg-blue-50 border-l-4 border-l-blue-500"
          : "hover:bg-gray-50"
      }`}
    >
      {/* Thumbnail */}
      {listing.primary_image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={listing.primary_image_url}
          alt={listing.title}
          className="w-16 h-16 rounded-lg object-cover flex-shrink-0 bg-gray-100"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        <div className="w-16 h-16 rounded-lg bg-gray-100 flex-shrink-0" />
      )}

      {/* Info */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
          {listing.platform.display_name}
        </p>
        <p className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug">
          {listing.title}
        </p>
        {(listing.city || listing.state) && (
          <p className="text-xs text-gray-500">
            📍 {[listing.city, listing.state].filter(Boolean).join(", ")}
            {listing.distance_miles != null && (
              <span className="ml-1 text-gray-400">
                · {listing.distance_miles.toFixed(1)} mi
              </span>
            )}
          </p>
        )}
        <div className="flex items-center gap-2 pt-0.5">
          {listing.current_price != null && (
            <span className="text-sm font-bold text-blue-700">
              {formatPrice(listing.current_price)}
            </span>
          )}
          <a
            href={`/listing/${listing.id}`}
            onClick={(e) => e.stopPropagation()}
            className="ml-auto text-xs text-blue-500 hover:text-blue-700 flex items-center gap-0.5 flex-shrink-0"
          >
            Details <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
});
