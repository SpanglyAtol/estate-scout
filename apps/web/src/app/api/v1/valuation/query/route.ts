import { NextRequest, NextResponse } from "next/server";
import { getListings } from "@/lib/scraped-data";
import {
  parseQuery,
  computePriceStats,
  getConfidenceLevel,
  buildSpreadBuckets,
  type ParsedQuery,
} from "@/lib/query-parser";
import type { MockListing } from "@/app/api/v1/_mock-data";

// ── Scoring weights ────────────────────────────────────────────────────────────
const POINTS = {
  EXACT_MAKER_MATCH:   20,
  CATEGORY_MATCH:       5,
  PERIOD_MATCH:         3,
  KEYWORD_IN_TITLE:     2,
  KEYWORD_IN_DESC:      1,
  KEYWORD_IN_CATEGORY:  1,
} as const;

interface ScoredListing {
  listing: MockListing;
  score: number;
  makerMatched: boolean;
}

function scoreListing(listing: MockListing, parsed: ParsedQuery): ScoredListing | null {
  let score = 0;
  const title = (listing.title ?? "").toLowerCase();
  const desc  = (listing.description ?? "").toLowerCase();
  const cat   = (listing.category ?? "").toLowerCase();
  const lx    = listing as unknown as Record<string, unknown>;

  let makerMatched = false;
  if (parsed.makerSlug) {
    const lMaker = ((lx.maker as string) ?? "").toLowerCase();
    const lBrand = ((lx.brand as string) ?? "").toLowerCase();
    if (lMaker === parsed.makerSlug || lBrand === parsed.makerSlug) {
      score += POINTS.EXACT_MAKER_MATCH;
      makerMatched = true;
    } else if (!parsed.keywords.some((kw) => title.includes(kw))) {
      // Maker specified but not present in title either — hard exclude
      return null;
    }
  }

  if (parsed.category && cat === parsed.category) score += POINTS.CATEGORY_MATCH;
  if (parsed.period && (lx.period as string ?? "") === parsed.period) score += POINTS.PERIOD_MATCH;

  for (const kw of parsed.keywords) {
    if (title.includes(kw)) score += POINTS.KEYWORD_IN_TITLE;
    if (desc.includes(kw))  score += POINTS.KEYWORD_IN_DESC;
    if (cat.includes(kw))   score += POINTS.KEYWORD_IN_CATEGORY;
  }

  if (score === 0) return null;
  return { listing, score, makerMatched };
}

function buildNarrative(
  queryText: string,
  parsed: ParsedQuery,
  compCount: number,
  confidenceLevel: string,
  confidenceReason: string,
  low: number, mid: number, high: number,
): string {
  if (compCount === 0) {
    const tip = parsed.clarifyingPrompts.length > 0
      ? `\n\nTry adding more detail: ${parsed.clarifyingPrompts[0].toLowerCase()}.`
      : "";
    return `No close matches found for **${queryText}** in our current database. This may be a specialty item or a category we haven't indexed yet.${tip}\n\nFor the most accurate valuation, check completed auctions on LiveAuctioneers, Heritage Auctions, or Invaluable.`;
  }
  const ctx = parsed.makerLabel
    ? ` from ${parsed.makerLabel}`
    : parsed.category ? ` in the ${parsed.category.replace(/_/g, " ")} category` : "";
  const conf =
    confidenceLevel === "high"   ? "The results are consistent — this is a reliable estimate." :
    confidenceLevel === "medium" ? "Prices vary somewhat — condition and specific details matter." :
    `**Significant price variation** in these results. ${confidenceReason}`;
  return [
    `Based on **${compCount}** comparable listing${compCount > 1 ? "s" : ""}${ctx}, prices range from **$${low.toLocaleString()}** to **$${high.toLocaleString()}**, with a median around **$${mid.toLocaleString()}**.`,
    `\n\n${conf}`,
    `\n\nBuyers' premiums (typically 15–25%), condition, and provenance affect final realized prices. Click any comparable to view the original listing.`,
  ].join("");
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const queryText: string = (body.query_text ?? "").trim();
  if (!queryText) return NextResponse.json({ error: "query_text is required" }, { status: 400 });

  const parsed = parseQuery(queryText);
  const allListings = getListings();

  const scored: ScoredListing[] = [];
  for (const listing of allListings) {
    const r = scoreListing(listing, parsed);
    if (r) scored.push(r);
  }
  scored.sort((a, b) => b.score - a.score);

  const makerMatched = scored.filter((s) => s.makerMatched);
  const top = makerMatched.length >= 2 ? makerMatched.slice(0, 8) : scored.slice(0, 6);

  const comps = top
    .map(({ listing: l, score }) => {
      const lx = l as unknown as Record<string, unknown>;
      const price = (l.final_price ?? l.current_price ?? (lx.total_cost_estimate as number) ?? 0);
      return {
        listing_id: l.id,
        title: l.title,
        final_price: price,
        sale_date: l.sale_ends_at,
        platform_display_name: l.platform.display_name,
        external_url: l.external_url,
        primary_image_url: l.primary_image_url,
        condition: l.condition ?? null,
        similarity_score: Math.min(1, score / Math.max(
          POINTS.EXACT_MAKER_MATCH + POINTS.CATEGORY_MATCH + parsed.keywords.length * POINTS.KEYWORD_IN_TITLE, 1
        )),
      };
    })
    .filter((c) => c.final_price > 0);

  const prices     = comps.map((c) => c.final_price);
  const stats      = computePriceStats(prices);
  const confidence = getConfidenceLevel(stats, parsed, comps.length);
  const spread     = buildSpreadBuckets(prices);

  const low  = stats ? Math.round(stats.trimmedLow)  : 0;
  const mid  = stats ? Math.round(stats.trimmedMid)  : 0;
  const high = stats ? Math.round(stats.trimmedHigh) : 0;

  return NextResponse.json({
    query:            queryText,
    price_range:      { low: comps.length ? low : null, mid: comps.length ? mid : null, high: comps.length ? high : null, count: comps.length, currency: "USD" },
    comparable_sales: comps,
    narrative:        buildNarrative(queryText, parsed, comps.length, confidence.level, confidence.reason, low, mid, high),
    data_source:      comps.length > 0 ? "comps_only" : "no_data",
    cached:           false,
    confidence_level:   confidence.level,
    confidence_reason:  confidence.reason,
    price_spread:       spread,
    clarifying_prompts: parsed.clarifyingPrompts,
    detection_summary:  parsed.detectionSummary,
    is_high_ambiguity:  parsed.isHighAmbiguity,
  });
}
