"use client";

import dynamic from "next/dynamic";
import { useState, useCallback, useRef, forwardRef } from "react";
import { Search, MapPin, Loader2, ExternalLink, ChevronDown, Navigation } from "lucide-react";
import type { Listing } from "@/types";
import { formatPrice } from "@/lib/format";

// Leaflet is browser-only — never SSR
const AuctionMap = dynamic(
  () => import("@/components/map/auction-map").then((m) => m.AuctionMap),
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

// ── Map placeholder ───────────────────────────────────────────────────────────

function MapPlaceholder() {
  return (
    <div className="h-full w-full bg-antique-muted flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-antique-accent animate-spin" />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function MapSearch() {
  const [zip, setZip]           = useState("");
  const [radius, setRadius]     = useState(50);
  const [loading, setLoading]   = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [error, setError]       = useState("");
  const [listings, setListings] = useState<Listing[]>([]);
  const [center, setCenter]     = useState<[number, number]>(DEFAULT_CENTER);
  const [zoom, setZoom]         = useState(DEFAULT_ZOOM);
  const [locationLabel, setLocationLabel] = useState("");
  const [selectedId, setSelectedId]       = useState<number | null>(null);
  const listItemRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const fetchListings = useCallback(
    async (lat: number, lon: number, label: string) => {
      const params = new URLSearchParams({
        lat: String(lat),
        lon: String(lon),
        radius_miles: String(radius),
        page_size: "200",
        sort: "ending_soon",
      });

      try {
        const res = await fetch(`/api/v1/search?${params}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: Listing[] = await res.json();
        setListings(data);
        setCenter([lat, lon]);
        setZoom(radius <= 25 ? 12 : radius <= 75 ? 10 : 8);
        setLocationLabel(label);
      } catch {
        setError("Failed to fetch listings. Please try again.");
      }
    },
    [radius]
  );

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

    const geo = await zipToLatLon(trimmed);
    if (!geo) {
      setError(`Couldn't find ZIP code "${trimmed}" — please double-check and try again.`);
      setLoading(false);
      return;
    }

    await fetchListings(geo.lat, geo.lon, `${geo.city}, ${geo.state} ${trimmed}`);
    setLoading(false);
  }, [zip, fetchListings]);

  const handleUseMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }
    setGeoLoading(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setListings([]);
        setSelectedId(null);
        await fetchListings(latitude, longitude, "your location");
        setGeoLoading(false);
      },
      () => {
        setError("Couldn't access your location. Please enter a ZIP code instead.");
        setGeoLoading(false);
      }
    );
  }, [fetchListings]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleMarkerClick = (id: number) => {
    setSelectedId(id);
    const el = listItemRefs.current.get(id);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const searched = locationLabel !== "";
  const isLoading = loading || geoLoading;

  return (
    <div className="flex flex-col h-full">
      {/* ── Search bar ──────────────────────────────────────────────────────── */}
      <div className="bg-antique-surface border-b border-antique-border px-4 py-3 flex flex-wrap items-center gap-3 z-10 shadow-sm">
        {/* ZIP input */}
        <div className="relative flex-shrink-0">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-antique-accent pointer-events-none" />
          <input
            type="text"
            value={zip}
            onChange={(e) => setZip(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter ZIP code"
            maxLength={5}
            className="pl-9 pr-3 py-2 border border-antique-border rounded-lg text-sm w-40 bg-antique-bg text-antique-text placeholder:text-antique-text-mute focus:outline-none focus:border-antique-accent transition-colors"
          />
        </div>

        {/* Radius selector */}
        <div className="relative flex-shrink-0">
          <select
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="appearance-none pl-3 pr-8 py-2 border border-antique-border rounded-lg text-sm bg-antique-bg text-antique-text focus:outline-none focus:border-antique-accent cursor-pointer transition-colors"
          >
            {RADIUS_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r} mi radius
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-antique-text-mute pointer-events-none" />
        </div>

        {/* Search button */}
        <button
          onClick={handleSearch}
          disabled={isLoading}
          className="flex items-center gap-2 bg-antique-accent hover:bg-antique-accent-h disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex-shrink-0"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Find Auctions
        </button>

        {/* Use my location button */}
        <button
          onClick={handleUseMyLocation}
          disabled={isLoading}
          className="flex items-center gap-2 border border-antique-border text-antique-text-sec hover:border-antique-accent hover:text-antique-accent disabled:opacity-50 px-3 py-2 rounded-lg text-sm transition-colors flex-shrink-0 bg-antique-surface"
        >
          {geoLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Navigation className="w-4 h-4" />
          )}
          <span className="hidden sm:inline">Near Me</span>
        </button>

        {/* Result count / location label */}
        {searched && !isLoading && (
          <span className="text-sm text-antique-text-sec ml-1">
            {listings.length > 0 ? (
              <>
                <span className="font-semibold text-antique-text">{listings.length}</span>{" "}
                auction{listings.length !== 1 ? "s" : ""} within {radius} mi of {locationLabel}
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
        {/* Map */}
        <div className="flex-1 relative">
          <AuctionMap
            listings={listings}
            center={center}
            zoom={zoom}
            selectedId={selectedId}
            onMarkerClick={handleMarkerClick}
          />

          {/* Overlay hint when no search yet */}
          {!searched && !isLoading && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-antique-surface/95 backdrop-blur-sm rounded-xl shadow-lg border border-antique-border px-6 py-5 text-center max-w-xs pointer-events-auto">
                <MapPin className="w-8 h-8 text-antique-accent mx-auto mb-2" />
                <p className="font-display font-bold text-antique-text text-base">
                  Discover Nearby Auctions
                </p>
                <p className="text-xs text-antique-text-sec mt-1 leading-relaxed">
                  Enter a US ZIP code above or tap &ldquo;Near Me&rdquo; to find estate sales and auctions on the map.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Side list */}
        {listings.length > 0 && (
          <aside className="hidden md:flex flex-col w-80 xl:w-96 border-l border-antique-border bg-antique-surface overflow-y-auto">
            <div className="px-4 py-3 border-b border-antique-border bg-antique-muted">
              <p className="text-xs font-semibold text-antique-text-sec uppercase tracking-wide">
                {listings.length} Result{listings.length !== 1 ? "s" : ""} · Ending soonest
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

const SideCard = forwardRef<
  HTMLDivElement,
  { listing: Listing; selected: boolean; onClick: () => void }
>(function SideCard({ listing, selected, onClick }, ref) {
  return (
    <div
      ref={ref}
      onClick={onClick}
      className={`flex gap-3 p-3 border-b border-antique-border cursor-pointer transition-colors ${
        selected
          ? "bg-antique-accent-s border-l-4 border-l-antique-accent"
          : "hover:bg-antique-muted"
      }`}
    >
      {listing.primary_image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={listing.primary_image_url}
          alt={listing.title}
          className="w-16 h-16 rounded-lg object-cover flex-shrink-0 bg-antique-muted"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      ) : (
        <div className="w-16 h-16 rounded-lg bg-antique-muted flex-shrink-0 flex items-center justify-center text-2xl">
          🏺
        </div>
      )}

      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-[10px] font-semibold text-antique-accent uppercase tracking-wide">
          {listing.platform.display_name}
        </p>
        <p className="text-sm font-medium text-antique-text line-clamp-2 leading-snug">
          {listing.title}
        </p>
        {(listing.city || listing.state) && (
          <p className="text-xs text-antique-text-sec">
            📍 {[listing.city, listing.state].filter(Boolean).join(", ")}
            {listing.distance_miles != null && (
              <span className="ml-1 text-antique-text-mute">
                · {listing.distance_miles.toFixed(1)} mi
              </span>
            )}
          </p>
        )}
        <div className="flex items-center gap-2 pt-0.5">
          {listing.current_price != null && (
            <span className="text-sm font-bold text-antique-accent">
              {formatPrice(listing.current_price)}
            </span>
          )}
          <a
            href={`/listing/${listing.id}`}
            onClick={(e) => e.stopPropagation()}
            className="ml-auto text-xs text-antique-accent hover:text-antique-accent-h flex items-center gap-0.5 flex-shrink-0"
          >
            Details <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
});
