import { NextRequest, NextResponse } from "next/server";
import { getListings } from "@/lib/scraped-data";

// ── Haversine distance (km) between two lat/lon points ────────────────────────
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.toLowerCase() ?? "";
  const category = searchParams.get("category")?.toLowerCase() ?? "";
  const minPrice = parseFloat(searchParams.get("min_price") ?? "0") || 0;
  const maxPrice = parseFloat(searchParams.get("max_price") ?? "0") || Infinity;
  const pickupOnly = searchParams.get("pickup_only") === "true";
  const endingHours = parseInt(searchParams.get("ending_hours") ?? "0") || 0;
  const page = parseInt(searchParams.get("page") ?? "1");
  const pageSize = parseInt(searchParams.get("page_size") ?? "24");
  const platformIds = searchParams.getAll("platform_ids").map(Number).filter(Boolean);
  // Geographic radius search
  const lat = parseFloat(searchParams.get("lat") ?? "") || null;
  const lon = parseFloat(searchParams.get("lon") ?? "") || null;
  const radiusMiles = parseFloat(searchParams.get("radius_miles") ?? "") || null;

  let results = [...getListings()];

  if (q) {
    results = results.filter(
      (l) =>
        l.title.toLowerCase().includes(q) ||
        (l.description ?? "").toLowerCase().includes(q) ||
        (l.category ?? "").toLowerCase().includes(q)
    );
  }

  if (category) {
    results = results.filter((l) => l.category?.toLowerCase().includes(category));
  }

  if (minPrice > 0) {
    results = results.filter((l) => l.current_price !== null && l.current_price >= minPrice);
  }

  if (maxPrice < Infinity) {
    results = results.filter((l) => l.current_price !== null && l.current_price <= maxPrice);
  }

  if (pickupOnly) {
    results = results.filter((l) => l.pickup_only);
  }

  if (endingHours > 0) {
    const cutoff = Date.now() + endingHours * 3_600_000;
    results = results.filter(
      (l) => l.sale_ends_at && new Date(l.sale_ends_at).getTime() < cutoff
    );
  }

  if (platformIds.length > 0) {
    results = results.filter((l) => platformIds.includes(l.platform.id));
  }

  const statusFilter = searchParams.get("status") ?? "";
  if (statusFilter) {
    const now = Date.now();
    results = results.filter((l) => {
      if (l.is_completed) return statusFilter === "completed";
      const starts = l.sale_starts_at ? new Date(l.sale_starts_at).getTime() : null;
      const ends   = l.sale_ends_at   ? new Date(l.sale_ends_at).getTime()   : null;
      switch (statusFilter) {
        case "upcoming":
          return starts !== null && starts > now;
        case "ended":
          return ends !== null && ends < now;
        case "ending_soon":
          return ends !== null && ends > now && ends - now < 86_400_000;
        case "live":
          return (starts === null || starts <= now) && (ends === null || ends >= now);
        default:
          return true;
      }
    });
  }

  // ── Listing type filter ────────────────────────────────────────────────────
  const listingType = searchParams.get("listing_type");
  if (listingType) {
    results = results.filter(
      (l) => ((l.listing_type as string | undefined) ?? "auction") === listingType
    );
  }

  // ── Geographic radius filter ───────────────────────────────────────────────
  if (lat != null && lon != null && radiusMiles != null) {
    const radiusKm = radiusMiles * 1.60934;
    results = results
      .filter(
        (l) =>
          l.latitude != null &&
          l.longitude != null &&
          haversineKm(lat, lon, l.latitude, l.longitude) <= radiusKm
      )
      .map((l) => ({
        ...l,
        distance_miles:
          haversineKm(lat, lon, l.latitude!, l.longitude!) / 1.60934,
      }));
  }

  // ── Sort ───────────────────────────────────────────────────────────────────
  const sort = searchParams.get("sort") ?? "";
  switch (sort) {
    case "price_asc":
      results.sort((a, b) => (a.current_price ?? Infinity) - (b.current_price ?? Infinity));
      break;
    case "price_desc":
      results.sort((a, b) => (b.current_price ?? -1) - (a.current_price ?? -1));
      break;
    case "ending_soon":
      results.sort((a, b) => {
        const aEnd = a.sale_ends_at ? new Date(a.sale_ends_at).getTime() : Infinity;
        const bEnd = b.sale_ends_at ? new Date(b.sale_ends_at).getTime() : Infinity;
        return aEnd - bEnd;
      });
      break;
    case "newest":
      results.sort((a, b) => {
        const aStart = a.sale_starts_at ? new Date(a.sale_starts_at).getTime() : 0;
        const bStart = b.sale_starts_at ? new Date(b.sale_starts_at).getTime() : 0;
        return bStart - aStart;
      });
      break;
    // default: preserve scraped order (BidSpotter / HiBid already ordered by
    // relevance / end date on their platforms)
  }

  const start = (page - 1) * pageSize;
  return NextResponse.json(results.slice(start, start + pageSize));
}
