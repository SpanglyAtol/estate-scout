import { NextRequest, NextResponse } from "next/server";
import { getListings } from "@/lib/scraped-data";
import { searchSupabase, isSupabaseConfigured } from "@/lib/supabase-search";
import type { SearchResult } from "@/types";

// When BACKEND_API_URL is configured, proxy search to the FastAPI backend.
async function tryBackendSearch(req: NextRequest): Promise<NextResponse | null> {
  const backendUrl = process.env.BACKEND_API_URL;
  if (!backendUrl) return null;
  try {
    const upstream = await fetch(
      `${backendUrl}/api/v1/search?${req.nextUrl.searchParams.toString()}`,
      { next: { revalidate: 60 } }
    );
    if (upstream.ok) return NextResponse.json(await upstream.json());
  } catch {
    // Backend unavailable — fall through
  }
  return null;
}

// ── Haversine distance (km) ────────────────────────────────────────────────────
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function GET(req: NextRequest) {
  // Priority 1: FastAPI backend proxy
  const proxied = await tryBackendSearch(req);
  if (proxied) return proxied;

  // Priority 2: Direct Supabase query
  if (isSupabaseConfigured()) {
    const supabaseResult = await searchSupabase(req.nextUrl.searchParams);
    if (supabaseResult !== null) return NextResponse.json(supabaseResult);
  }

  // ── Priority 3: Local JSON bundle (dev / fallback) ──────────────────────────
  const { searchParams } = new URL(req.url);
  const q             = searchParams.get("q")?.toLowerCase() ?? "";
  const category      = searchParams.get("category")?.toLowerCase() ?? "";
  const minPrice      = parseFloat(searchParams.get("min_price") ?? "0") || 0;
  const maxPrice      = parseFloat(searchParams.get("max_price") ?? "0") || Infinity;
  const pickupOnly    = searchParams.get("pickup_only") === "true";
  const endingHours   = parseInt(searchParams.get("ending_hours") ?? "0") || 0;
  const page          = Math.max(1, parseInt(searchParams.get("page") ?? "1") || 1);
  const pageSize      = Math.min(100, Math.max(1, parseInt(searchParams.get("page_size") ?? "24") || 24));
  const platformIds   = searchParams.getAll("platform_ids").map(Number).filter(Boolean);
  const lat           = parseFloat(searchParams.get("lat") ?? "") || null;
  const lon           = parseFloat(searchParams.get("lon") ?? "") || null;
  const radiusMiles   = parseFloat(searchParams.get("radius_miles") ?? "") || null;
  // Enriched field filters
  const subCategory   = searchParams.get("sub_category")?.toLowerCase() ?? "";
  const maker         = searchParams.get("maker")?.toLowerCase() ?? "";
  const period        = searchParams.get("period")?.toLowerCase() ?? "";
  const countryOrigin = searchParams.get("country_of_origin")?.toLowerCase() ?? "";
  const condition     = searchParams.get("condition")?.toLowerCase() ?? "";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let results: any[] = [...getListings()];

  // ── Estate sale separation ──────────────────────────────────────────────────
  const explicitListingType = searchParams.get("listing_type");
  const isEstateSalesPage   = explicitListingType === "estate_sale" ||
    searchParams.get("estate_sales_page") === "1";
  if (!explicitListingType && !isEstateSalesPage) {
    results = results.filter((l) => {
      const lt = l.listing_type ?? "auction";
      const it = l.item_type ?? "";
      return lt !== "estate_sale" && it !== "estate_sale";
    });
  }

  // ── Text search ─────────────────────────────────────────────────────────────
  if (q) {
    results = results.filter(
      (l) =>
        l.title.toLowerCase().includes(q) ||
        (l.description ?? "").toLowerCase().includes(q) ||
        (l.category ?? "").toLowerCase().includes(q)
    );
  }

  // ── Category ────────────────────────────────────────────────────────────────
  if (category) results = results.filter((l) => l.category?.toLowerCase().includes(category));

  // ── Subcategory ─────────────────────────────────────────────────────────────
  if (subCategory) results = results.filter((l) => l.sub_category?.toLowerCase() === subCategory);

  // ── Maker / Brand ───────────────────────────────────────────────────────────
  if (maker) {
    results = results.filter(
      (l) =>
        l.maker?.toLowerCase().includes(maker) ||
        l.brand?.toLowerCase().includes(maker) ||
        l.title.toLowerCase().includes(maker)
    );
  }

  // ── Period / Era ────────────────────────────────────────────────────────────
  if (period) results = results.filter((l) => l.period?.toLowerCase() === period);

  // ── Country of Origin ───────────────────────────────────────────────────────
  if (countryOrigin) results = results.filter((l) => l.country_of_origin?.toLowerCase() === countryOrigin);

  // ── Condition ───────────────────────────────────────────────────────────────
  if (condition) results = results.filter((l) => l.condition?.toLowerCase().includes(condition));

  // ── Price ───────────────────────────────────────────────────────────────────
  if (minPrice > 0) results = results.filter((l) => l.current_price != null && l.current_price >= minPrice);
  if (maxPrice < Infinity) results = results.filter((l) => l.current_price != null && l.current_price <= maxPrice);

  // ── Pickup ──────────────────────────────────────────────────────────────────
  if (pickupOnly) results = results.filter((l) => l.pickup_only);

  // ── Ending hours ────────────────────────────────────────────────────────────
  if (endingHours > 0) {
    const cutoff = Date.now() + endingHours * 3_600_000;
    results = results.filter((l) => l.sale_ends_at && new Date(l.sale_ends_at).getTime() < cutoff);
  }

  // ── Platforms ───────────────────────────────────────────────────────────────
  if (platformIds.length > 0) results = results.filter((l) => platformIds.includes(l.platform.id));

  // ── Status ──────────────────────────────────────────────────────────────────
  const statusFilter = searchParams.get("status") ?? "";
  if (statusFilter) {
    const now = Date.now();
    results = results.filter((l) => {
      if (l.is_completed) return statusFilter === "completed";
      const starts = l.sale_starts_at ? new Date(l.sale_starts_at).getTime() : null;
      const ends   = l.sale_ends_at   ? new Date(l.sale_ends_at).getTime()   : null;
      switch (statusFilter) {
        case "upcoming":     return starts != null && starts > now;
        case "ended":        return ends != null && ends < now;
        case "ending_soon":  return ends != null && ends > now && ends - now < 86_400_000;
        case "live":         return (starts == null || starts <= now) && (ends == null || ends >= now);
        default:             return true;
      }
    });
  }

  // ── Listing type ────────────────────────────────────────────────────────────
  if (explicitListingType) {
    results = results.filter((l) => (l.listing_type ?? "auction") === explicitListingType);
  }

  // ── Item type ───────────────────────────────────────────────────────────────
  const itemType = searchParams.get("item_type");
  if (itemType) results = results.filter((l) => l.item_type === itemType);

  // ── Geographic radius ───────────────────────────────────────────────────────
  if (lat != null && lon != null && radiusMiles != null) {
    const radiusKm = radiusMiles * 1.60934;
    results = results
      .filter((l) => l.latitude != null && l.longitude != null &&
        haversineKm(lat, lon, l.latitude, l.longitude) <= radiusKm)
      .map((l) => ({
        ...l,
        distance_miles: haversineKm(lat, lon, l.latitude, l.longitude) / 1.60934,
      }));
  }

  // ── Sort ────────────────────────────────────────────────────────────────────
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
        const aT = a.scraped_at ? new Date(a.scraped_at).getTime() : 0;
        const bT = b.scraped_at ? new Date(b.scraped_at).getTime() : 0;
        return bT - aT;
      });
      break;
  }

  // ── Paginate — return total so client knows the full result count ────────────
  const total       = results.length;
  const totalPages  = Math.ceil(total / pageSize);
  const start       = (page - 1) * pageSize;
  const pageResults = results.slice(start, start + pageSize);

  const body: SearchResult = {
    results:     pageResults,
    total,
    page,
    page_size:   pageSize,
    total_pages: totalPages,
  };
  return NextResponse.json(body);
}
