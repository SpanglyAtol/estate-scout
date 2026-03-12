"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import type { Listing } from "@/types";
import { formatPrice } from "@/lib/format";

// ── Leaflet default-icon webpack fix ──────────────────────────────────────────
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Highlighted icon (gold) for the selected marker
const selectedIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// ── Sub-component: updates map view when center/zoom changes ──────────────────
function MapController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  const prevCenter = useRef<[number, number] | null>(null);

  useEffect(() => {
    if (
      !prevCenter.current ||
      prevCenter.current[0] !== center[0] ||
      prevCenter.current[1] !== center[1]
    ) {
      map.setView(center, zoom, { animate: true });
      prevCenter.current = center;
    }
  }, [map, center, zoom]);

  return null;
}

// ── Main map component ────────────────────────────────────────────────────────

interface AuctionMapProps {
  listings: Listing[];
  center: [number, number];
  zoom?: number;
  selectedId?: number | null;
  onMarkerClick?: (id: number) => void;
}

export function AuctionMap({
  listings,
  center,
  zoom = 10,
  selectedId,
  onMarkerClick,
}: AuctionMapProps) {
  const mappable = listings.filter(
    (l) => l.latitude != null && l.longitude != null
  );

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapController center={center} zoom={zoom} />

      {mappable.map((listing) => (
        <Marker
          key={listing.id}
          position={[listing.latitude!, listing.longitude!]}
          icon={listing.id === selectedId ? selectedIcon : new L.Icon.Default()}
          eventHandlers={{
            click: () => onMarkerClick?.(listing.id),
          }}
        >
          <Popup maxWidth={280}>
            <div className="text-sm space-y-1.5 min-w-[220px]">
              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#8B6914" }}>
                  {listing.platform.display_name}
                </p>
                {listing.pickup_only && !listing.ships_nationally && (
                  <span style={{ fontSize: "10px", background: "#f3f4f6", color: "#6b7280", borderRadius: "9999px", padding: "1px 6px", fontWeight: 500 }}>
                    In Person
                  </span>
                )}
                {listing.ships_nationally && (
                  <span style={{ fontSize: "10px", background: "#f3f4f6", color: "#6b7280", borderRadius: "9999px", padding: "1px 6px", fontWeight: 500 }}>
                    Online
                  </span>
                )}
              </div>
              <p className="font-semibold leading-snug line-clamp-2" style={{ color: "#2C1810" }}>
                {listing.title}
              </p>
              {(listing.city || listing.state) && (
                <p className="text-xs" style={{ color: "#6B4F3A" }}>
                  📍 {[listing.city, listing.state].filter(Boolean).join(", ")}
                  {listing.distance_miles != null && (
                    <span style={{ color: "#9C8070", marginLeft: "4px" }}>
                      · {listing.distance_miles.toFixed(1)} mi
                    </span>
                  )}
                </p>
              )}
              {(listing.sale_starts_at || listing.sale_ends_at) && (
                <p className="text-xs" style={{ color: "#6B4F3A" }}>
                  📅{" "}
                  {listing.sale_starts_at
                    ? new Date(listing.sale_starts_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                    : ""}
                  {listing.sale_ends_at
                    ? ` – ${new Date(listing.sale_ends_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                    : ""}
                </p>
              )}
              {listing.current_price != null && (
                <p className="text-sm font-bold" style={{ color: "#8B6914" }}>
                  {formatPrice(listing.current_price)}
                </p>
              )}
              <a
                href={`/listing/${listing.id}`}
                className="inline-block mt-1 text-xs text-white px-2.5 py-1 rounded transition-colors"
                style={{ backgroundColor: "#8B6914" }}
              >
                View Details →
              </a>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
