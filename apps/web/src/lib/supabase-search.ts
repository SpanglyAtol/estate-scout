/**
 * Direct Supabase REST API (PostgREST) connector for the Next.js app.
 *
 * Priority chain:
 *   1. BACKEND_API_URL → FastAPI proxy
 *   2. SUPABASE_URL + SUPABASE_KEY → this module (direct Supabase)
 *   3. JSON bundle → scraped-data.ts fallback
 *
 * Required env vars:
 *   SUPABASE_URL   – e.g. https://abcdefgh.supabase.co
 *   SUPABASE_KEY   – service role key (bypasses RLS)
 */

import type { Listing, SearchResult } from "@/types";
import { haversineKm, KM_PER_MILE } from "@/lib/geo";

const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, "");
const SUPABASE_KEY = process.env.SUPABASE_KEY;

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

// ── Row → Listing ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformRow(row: Record<string, any>): Listing {
  const p = row.platforms ?? {};
  const currentPrice = row.current_price != null ? parseFloat(String(row.current_price)) : null;
  const premium = row.buyers_premium_pct != null ? parseFloat(String(row.buyers_premium_pct)) : null;

  return {
    id: row.id,
    platform: {
      id: p.id ?? 0,
      name: p.name ?? "",
      display_name: p.display_name ?? "",
      base_url: p.base_url ?? "",
      logo_url: p.logo_url ?? null,
    },
    external_id: row.external_id ?? "",
    external_url: row.external_url ?? "",
    title: row.title ?? "",
    description: row.description ?? null,
    category: row.category ?? null,
    condition: row.condition ?? null,
    listing_type: row.listing_type ?? "auction",
    item_type: row.item_type ?? "individual_item",
    current_price: currentPrice,
    buy_now_price: row.buy_now_price != null ? parseFloat(String(row.buy_now_price)) : null,
    estimate_low: row.estimate_low != null ? parseFloat(String(row.estimate_low)) : null,
    estimate_high: row.estimate_high != null ? parseFloat(String(row.estimate_high)) : null,
    final_price: row.final_price != null ? parseFloat(String(row.final_price)) : null,
    is_completed: Boolean(row.is_completed),
    auction_status: row.auction_status ?? "unknown",
    buyers_premium_pct: premium,
    total_cost_estimate:
      currentPrice != null && premium != null ? currentPrice * (1 + premium / 100) : null,
    pickup_only: Boolean(row.pickup_only),
    ships_nationally: row.ships_nationally !== false,
    city: row.city ?? null,
    state: row.state ?? null,
    zip_code: row.zip_code ?? null,
    latitude: row.latitude != null ? parseFloat(String(row.latitude)) : null,
    longitude: row.longitude != null ? parseFloat(String(row.longitude)) : null,
    sale_ends_at: row.sale_ends_at ?? null,
    sale_starts_at: row.sale_starts_at ?? null,
    primary_image_url: row.primary_image_url ?? null,
    image_urls: Array.isArray(row.image_urls) ? row.image_urls : [],
    scraped_at: row.scraped_at ?? new Date().toISOString(),
    maker: row.maker ?? null,
    brand: row.brand ?? null,
    period: row.period ?? null,
    country_of_origin: row.country_of_origin ?? null,
    attributes: row.attributes ?? {},
    sub_category: row.sub_category ?? null,
    collaboration_brands: Array.isArray(row.collaboration_brands) ? row.collaboration_brands : [],
  };
}

// ── Supabase fetch helper ─────────────────────────────────────────────────────

const LISTING_COLS = [
  "id", "external_id", "external_url", "title", "description", "category",
  "condition", "listing_type", "item_type", "auction_status",
  "current_price", "buy_now_price", "estimate_low", "estimate_high",
  "final_price", "buyers_premium_pct", "is_completed",
  "pickup_only", "ships_nationally",
  "city", "state", "zip_code", "latitude", "longitude",
  "sale_starts_at", "sale_ends_at",
  "primary_image_url", "image_urls",
  "scraped_at", "maker", "brand", "period", "country_of_origin",
  "sub_category", "collaboration_brands", "attributes",
  "platforms(id,name,display_name,base_url,logo_url)",
].join(",");

// Fallback cols without the join (in case FK relationship name differs)
const LISTING_COLS_NO_JOIN = LISTING_COLS.replace(",platforms(id,name,display_name,base_url,logo_url)", "");

async function sbFetch(path: string, query: URLSearchParams, countExact = false): Promise<Response> {
  const url = `${SUPABASE_URL}/rest/v1/${path}?${query}`;
  return fetch(url, {
    headers: {
      apikey: SUPABASE_KEY!,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      ...(countExact ? { Prefer: "count=exact" } : {}),
    },
    next: { revalidate: 120 },
  });
}

/** Parse total from PostgREST Content-Range header: "0-23/1234" → 1234 */
function parseTotalFromRange(header: string | null): number | null {
  if (!header) return null;
  const match = header.match(/\/(\d+)$/);
  return match ? parseInt(match[1]) : null;
}

// ── Search listings — returns full SearchResult with total count ───────────────

export async function searchSupabase(params: URLSearchParams): Promise<SearchResult | null> {
  if (!isSupabaseConfigured()) return null;

  const q             = params.get("q")?.toLowerCase() ?? "";
  const listingType   = params.get("listing_type") ?? "";
  const category      = params.get("category") ?? "";
  const subCategory   = params.get("sub_category") ?? "";
  const maker         = params.get("maker") ?? "";
  const period        = params.get("period") ?? "";
  const countryOrigin = params.get("country_of_origin") ?? "";
  const condition     = params.get("condition") ?? "";
  const minPrice      = params.get("min_price") ?? "";
  const maxPrice      = params.get("max_price") ?? "";
  const statusFilter  = params.get("status") ?? "";
  const platformIds   = params.getAll("platform_ids").map(Number).filter(Boolean);
  const lat           = parseFloat(params.get("lat") ?? "") || null;
  const lon           = parseFloat(params.get("lon") ?? "") || null;
  const radiusMiles   = parseFloat(params.get("radius_miles") ?? "") || null;
  const sort          = params.get("sort") ?? "";
  const page          = Math.max(1, parseInt(params.get("page") ?? "1") || 1);
  const pageSize      = Math.min(100, Math.max(1, parseInt(params.get("page_size") ?? "24") || 24));
  const estatePage    = params.get("estate_sales_page") === "1";

  const query = new URLSearchParams();
  query.set("select", LISTING_COLS);

  // Listing type
  if (listingType) {
    query.set("listing_type", `eq.${listingType}`);
  } else if (!estatePage) {
    query.set("listing_type", "neq.estate_sale");
  }

  // Category — exact match first, then ilike fallback
  if (category) query.set("category", `ilike.*${category}*`);

  // Subcategory
  if (subCategory) query.set("sub_category", `eq.${subCategory}`);

  // Maker
  if (maker) query.set("maker", `ilike.*${maker.replace(/_/g, " ")}*`);

  // Period
  if (period) query.set("period", `eq.${period}`);

  // Country of origin
  if (countryOrigin) query.set("country_of_origin", `eq.${countryOrigin}`);

  // Condition
  if (condition) query.set("condition", `ilike.*${condition}*`);

  // Price — PostgREST requires separate params for range; use append so both survive
  if (minPrice) query.append("current_price", `gte.${minPrice}`);
  if (maxPrice) query.append("current_price", `lte.${maxPrice}`);

  // Text search
  if (q) {
    const escaped = q.replace(/[%_*()]/g, "\\$&");
    query.set("or", `(title.ilike.*${escaped}*,description.ilike.*${escaped}*,category.ilike.*${escaped}*)`);
  }

  // Status — use the auction_status enum column as the primary signal.
  // This avoids false-negatives caused by null sale_ends_at on many scraped rows.
  switch (statusFilter) {
    case "live":
      query.set("auction_status", "eq.live");
      query.set("is_completed", "eq.false");
      break;
    case "upcoming":
      query.set("auction_status", "eq.upcoming");
      break;
    case "ending_soon": {
      const now = new Date().toISOString();
      const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
      query.set("auction_status", "eq.live");
      query.append("sale_ends_at", `gt.${now}`);
      query.append("sale_ends_at", `lt.${tomorrow}`);
      break;
    }
    case "ended":
      query.set("is_completed", "eq.true");
      break;
  }

  // Sort
  switch (sort) {
    case "price_asc":   query.set("order", "current_price.asc.nullslast");  break;
    case "price_desc":  query.set("order", "current_price.desc.nullsfirst"); break;
    case "ending_soon": query.set("order", "sale_ends_at.asc.nullslast");    break;
    case "newest":      query.set("order", "scraped_at.desc");               break;
    default:            query.set("order", "scraped_at.desc");               break;
  }

  // When client-side geo or platform filter is needed, fetch a large batch
  const needsClientFilter = (lat != null && lon != null) || platformIds.length > 0;
  const fetchLimit  = needsClientFilter ? Math.min(pageSize * 30, 2000) : pageSize;
  const fetchOffset = needsClientFilter ? 0 : (page - 1) * pageSize;
  query.set("limit", String(fetchLimit));
  query.set("offset", String(fetchOffset));

  try {
    let res = await sbFetch("listings", query, !needsClientFilter);
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("[Supabase] search error:", res.status, errText);
      if (res.status === 400 && errText.includes("platforms")) {
        console.warn("[Supabase] Retrying without platforms join");
        query.set("select", LISTING_COLS_NO_JOIN);
        res = await sbFetch("listings", query, !needsClientFilter);
      }
      if (!res.ok) {
        console.error("[Supabase] search retry failed:", res.status);
        return null;
      }
    }

    // Parse total from Content-Range header when count=exact was requested
    const serverTotal = parseTotalFromRange(res.headers.get("content-range"));

    const rows = await res.json();
    if (!Array.isArray(rows)) return null;

    let results = rows.map(transformRow);

    // Client-side platform filter
    if (platformIds.length > 0) {
      results = results.filter((l) => platformIds.includes(l.platform.id));
    }

    // Client-side geo filter + distance annotation
    if (lat != null && lon != null && radiusMiles != null) {
      const radKm = radiusMiles * KM_PER_MILE;
      results = results
        .filter((l) => l.latitude != null && l.longitude != null &&
          haversineKm(lat, lon, l.latitude!, l.longitude!) <= radKm)
        .map((l) => ({
          ...l,
          distance_miles: haversineKm(lat, lon, l.latitude!, l.longitude!) / KM_PER_MILE,
        }));
    }

    // Compute total before slicing for client-filtered paths
    const total = needsClientFilter ? results.length : (serverTotal ?? results.length);

    if (needsClientFilter) {
      const start = (page - 1) * pageSize;
      results = results.slice(start, start + pageSize);
    }

    return {
      results,
      total,
      page,
      page_size: pageSize,
      total_pages: Math.ceil(total / pageSize),
    };
  } catch (err) {
    console.error("[Supabase] search fetch failed:", err);
    return null;
  }
}

// ── Single listing lookup ─────────────────────────────────────────────────────

export async function getSupabaseListing(id: number): Promise<Listing | null> {
  if (!isSupabaseConfigured()) return null;

  const query = new URLSearchParams();
  query.set("select", LISTING_COLS);
  query.set("id", `eq.${id}`);
  query.set("limit", "1");

  try {
    let res = await sbFetch("listings", query);
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      if (res.status === 400 && errText.includes("platforms")) {
        query.set("select", LISTING_COLS_NO_JOIN);
        res = await sbFetch("listings", query);
      }
      if (!res.ok) return null;
    }
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return transformRow(rows[0]);
  } catch {
    return null;
  }
}
