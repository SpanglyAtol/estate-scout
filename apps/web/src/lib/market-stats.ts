/**
 * Market Stats — server-side aggregation for the Pricing Guide.
 *
 * Priority order:
 *  1. FastAPI backend  (DATABASE_URL → full price_snapshots + market_price_index)
 *  2. Scraped eBay JSON (scraped-listings-ebay.json — real sold prices, updated daily)
 *
 * The scraped-data fallback makes the pricing guide work in any deployment
 * (Vercel preview, local dev, demo) without requiring a live database.
 */

import type { MockListing } from "@/app/api/v1/_mock-data";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PriceHistoryBucket {
  /** ISO date string — first day of the month, e.g. "2025-11-01" */
  time_bucket: string;
  sale_count: number;
  median_price: number | null;
  mean_price: number | null;
  p25_price: number | null;
  p75_price: number | null;
}

export interface MarketSnapshot {
  category: string;
  display_label: string;
  sale_count: number;
  median_price: number | null;
  p25_price: number | null;
  p75_price: number | null;
  min_price: number | null;
  max_price: number | null;
  /** Positive = prices rising, negative = falling (pct vs 6 months ago) */
  trend_pct: number | null;
  /** "rising" | "falling" | "stable" | null */
  trend_direction: string | null;
  /** Most recent data point date */
  last_updated: string | null;
}

// ── Category config ───────────────────────────────────────────────────────────

export const GUIDE_CATEGORIES: { slug: string; label: string; keywords: string[] }[] = [
  { slug: "watches",    label: "Watches & Clocks",      keywords: ["watch", "clock", "timepiece", "rolex", "omega", "seiko", "hamilton"] },
  { slug: "jewelry",    label: "Jewelry & Gems",        keywords: ["jewelry", "jewellery", "ring", "necklace", "bracelet", "brooch", "diamond", "gold", "silver ring", "pearl"] },
  { slug: "silver",     label: "Silver & Metalware",    keywords: ["silver", "sterling", "gorham", "tiffany silver", "pewter", "candlestick", "candelabra", "salver"] },
  { slug: "art",        label: "Art & Paintings",       keywords: ["oil painting", "watercolor", "lithograph", "print", "etching", "gouache", "canvas", "artist"] },
  { slug: "ceramics",   label: "Ceramics & Porcelain",  keywords: ["porcelain", "ceramic", "pottery", "stoneware", "majolica", "wedgwood", "meissen", "doulton", "vase"] },
  { slug: "furniture",  label: "Furniture",             keywords: ["chair", "table", "cabinet", "chest", "dresser", "armoire", "secretary", "bureau", "settee", "sofa"] },
  { slug: "glass",      label: "Glass & Crystal",       keywords: ["glass", "crystal", "lalique", "steuben", "baccarat", "pressed glass", "art glass"] },
  { slug: "collectibles", label: "Collectibles",        keywords: ["collectible", "memorabilia", "coin", "stamp", "postcard", "toy", "doll", "figurine"] },
  { slug: "textiles",   label: "Textiles & Rugs",       keywords: ["rug", "carpet", "tapestry", "quilt", "sampler", "needlework", "textile", "linen"] },
  { slug: "books",      label: "Books & Manuscripts",   keywords: ["book", "manuscript", "map", "atlas", "letter", "document", "first edition", "signed"] },
];

export const CATEGORY_DISPLAY: Record<string, string> = Object.fromEntries(
  GUIDE_CATEGORIES.map((c) => [c.slug, c.label])
);

// ── Median helper ─────────────────────────────────────────────────────────────

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.max(0, Math.floor(p * sorted.length) - 1);
  return sorted[idx];
}

function median(sorted: number[]): number | null {
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function mean(arr: number[]): number | null {
  if (arr.length === 0) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

// ── Category matcher ──────────────────────────────────────────────────────────

function matchCategory(listing: MockListing): string | null {
  const text = `${listing.title ?? ""} ${listing.category ?? ""} ${listing.description?.slice(0, 200) ?? ""}`.toLowerCase();
  for (const cat of GUIDE_CATEGORIES) {
    if (cat.keywords.some((kw) => text.includes(kw))) return cat.slug;
  }
  return null;
}

// ── Scraped-data aggregation ──────────────────────────────────────────────────

/** Lazy-load the eBay sold comps JSON. Server-only. */
function loadEbayComps(): MockListing[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("@/data/scraped-listings-ebay.json") as MockListing[];
  } catch {
    return [];
  }
}

/**
 * Compute monthly price history buckets from the eBay sold comps JSON.
 * Only includes completed listings (`is_completed = true`) with a final_price.
 */
export function computePriceHistory(
  categorySlug: string,
  months = 24,
): PriceHistoryBucket[] {
  const comps = loadEbayComps();
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);

  // Filter to this category + completed sales with a price
  const relevant = comps.filter((l) => {
    if (!l.is_completed) return false;
    const price = l.final_price ?? l.current_price;
    if (!price || price <= 0) return false;
    const cat = matchCategory(l);
    if (cat !== categorySlug) return false;
    if (l.sale_ends_at) {
      const d = new Date(l.sale_ends_at);
      if (d < cutoff) return false;
    }
    return true;
  });

  // Group by month
  const byMonth: Record<string, number[]> = {};
  for (const l of relevant) {
    const price = l.final_price ?? l.current_price ?? 0;
    const date = l.sale_ends_at ? new Date(l.sale_ends_at) : new Date(l.scraped_at);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
    if (!byMonth[key]) byMonth[key] = [];
    byMonth[key].push(price);
  }

  // Build sorted buckets (newest first)
  return Object.entries(byMonth)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([time_bucket, prices]) => {
      const sorted = [...prices].sort((a, b) => a - b);
      return {
        time_bucket,
        sale_count: sorted.length,
        median_price: median(sorted),
        mean_price: mean(sorted),
        p25_price: percentile(sorted, 0.25),
        p75_price: percentile(sorted, 0.75),
      };
    });
}

/**
 * Compute a snapshot (current stats) for every guide category.
 * Looks back `months` months; returns only categories with ≥3 data points.
 */
export function computeAllSnapshots(months = 12): MarketSnapshot[] {
  const comps = loadEbayComps();
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  const midpoint = new Date();
  midpoint.setMonth(midpoint.getMonth() - months / 2);

  const snapshots: MarketSnapshot[] = [];

  for (const cat of GUIDE_CATEGORIES) {
    const relevant = comps.filter((l) => {
      if (!l.is_completed) return false;
      const price = l.final_price ?? l.current_price;
      if (!price || price <= 0) return false;
      if (matchCategory(l) !== cat.slug) return false;
      if (l.sale_ends_at && new Date(l.sale_ends_at) < cutoff) return false;
      return true;
    });

    if (relevant.length < 3) continue;

    const allPrices = relevant
      .map((l) => l.final_price ?? l.current_price ?? 0)
      .sort((a, b) => a - b);

    // Trend: compare recent half vs older half
    const recentPrices = relevant
      .filter((l) => !l.sale_ends_at || new Date(l.sale_ends_at) >= midpoint)
      .map((l) => l.final_price ?? l.current_price ?? 0);
    const olderPrices = relevant
      .filter((l) => l.sale_ends_at && new Date(l.sale_ends_at) < midpoint)
      .map((l) => l.final_price ?? l.current_price ?? 0);

    const recentMedian = median([...recentPrices].sort((a, b) => a - b));
    const olderMedian = median([...olderPrices].sort((a, b) => a - b));

    let trend_pct: number | null = null;
    let trend_direction: string | null = null;
    if (recentMedian && olderMedian && olderMedian > 0) {
      trend_pct = ((recentMedian - olderMedian) / olderMedian) * 100;
      trend_direction = trend_pct > 5 ? "rising" : trend_pct < -5 ? "falling" : "stable";
    }

    const lastSale = relevant
      .filter((l) => l.sale_ends_at)
      .sort((a, b) =>
        new Date(b.sale_ends_at!).getTime() - new Date(a.sale_ends_at!).getTime()
      )[0];

    snapshots.push({
      category: cat.slug,
      display_label: cat.label,
      sale_count: allPrices.length,
      median_price: median(allPrices),
      p25_price: percentile(allPrices, 0.25),
      p75_price: percentile(allPrices, 0.75),
      min_price: allPrices[0] ?? null,
      max_price: allPrices[allPrices.length - 1] ?? null,
      trend_pct: trend_pct !== null ? Math.round(trend_pct * 10) / 10 : null,
      trend_direction,
      last_updated: lastSale?.sale_ends_at ?? lastSale?.scraped_at ?? null,
    });
  }

  return snapshots.sort((a, b) => (b.sale_count ?? 0) - (a.sale_count ?? 0));
}

/**
 * Compute a snapshot for one category.
 * Returns null if fewer than 3 data points.
 */
export function computeCategorySnapshot(
  categorySlug: string,
  months = 12,
): MarketSnapshot | null {
  const all = computeAllSnapshots(months);
  return all.find((s) => s.category === categorySlug) ?? null;
}
