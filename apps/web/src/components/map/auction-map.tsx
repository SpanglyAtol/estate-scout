"use client";

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
          <Popup maxWidth={260}>
            <div className="text-sm space-y-1 min-w-[200px]">
              <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#8B6914" }}>
                {listing.platform.display_name}
              </p>
              <p className="font-semibold leading-snug line-clamp-2" style={{ color: "#2C1810" }}>
                {listing.title}
              </p>
              {(listing.city || listing.state) && (
                <p className="text-xs" style={{ color: "#6B4F3A" }}>
                  📍 {[listing.city, listing.state].filter(Boolean).join(", ")}
                </p>
              )}
              {listing.current_price != null && (
                <p className="text-sm font-bold" style={{ color: "#8B6914" }}>
                  {formatPrice(listing.current_price)}
                </p>
              )}
              {listing.distance_miles != null && (
                <p className="text-xs" style={{ color: "#9C8070" }}>
                  {listing.distance_miles.toFixed(1)} mi away
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
