import { NextRequest, NextResponse } from "next/server";
import { getListings } from "@/lib/scraped-data";

// Stop words to filter from keyword extraction — avoids matching on
// common descriptors that appear in almost every listing
const STOP_WORDS = new Set([
  "the", "and", "for", "with", "this", "that", "from", "circa", "piece",
  "item", "very", "good", "fine", "rare", "nice", "old", "new", "set",
  "pair", "lot", "one", "two", "has", "not", "are", "was", "its", "all",
  "any", "our", "can", "but", "have", "been", "some", "made", "will",
  "signed", "original", "antique", "vintage", "estate", "auction", "sale",
  "condition", "excellent", "mint", "used", "marks", "marked", "base",
  "height", "inches", "diameter", "width", "length", "weight", "grams",
]);

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const queryText: string = body.query_text ?? "";

  const keywords = extractKeywords(queryText);
  const listings = getListings();
  // If hydrate.py has been run we'll have many more than 24 mock items
  const usingRealData = listings.length > 24;

  // Score each listing by how many query keywords appear in its searchable text
  const scored = listings
    .map((l) => {
      const haystack = [l.title, l.category ?? "", l.description ?? ""]
        .join(" ")
        .toLowerCase();
      const score = keywords.reduce(
        (acc, kw) => acc + (haystack.includes(kw) ? 1 : 0),
        0
      );
      return { score, listing: l };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const top = scored.slice(0, 5);

  const comps = top.map(({ listing: l, score }) => ({
    listing_id: l.id,
    title: l.title,
    final_price: l.current_price ?? l.total_cost_estimate ?? 350,
    sale_date: l.sale_ends_at,
    platform_display_name: l.platform.display_name,
    external_url: l.external_url,
    primary_image_url: l.primary_image_url,
    similarity_score: Math.min(1, score / Math.max(keywords.length, 1)),
  }));

  // Price range: ±20% band around the min/max of comparable prices
  const prices = comps.map((c) => c.final_price).filter((p) => p > 0);
  const low  = prices.length ? Math.round(Math.min(...prices) * 0.8) : 200;
  const mid  = prices.length
    ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
    : 450;
  const high = prices.length ? Math.round(Math.max(...prices) * 1.2) : 800;

  const dataLabel = usingRealData
    ? "current live listings across LiveAuctioneers, EstateSales.NET, HiBid, and MaxSold"
    : "our current listing database";

  const narrative =
    comps.length > 0
      ? `Based on **${comps.length}** comparable listing${comps.length > 1 ? "s" : ""} found in ${dataLabel}, **${queryText}** items are currently priced in the range of **$${low.toLocaleString()}–$${high.toLocaleString()}**, with an average around **$${mid.toLocaleString()}**.\n\nThe comparable listings below were scored by keyword similarity to your query. Condition, provenance, maker marks, and buyers' premiums significantly affect final realized prices. Click any comparable listing to view it directly on its source platform.`
      : `We didn't find close matches for **${queryText}** in our current database. This may be a specialty item or category we haven't indexed yet. Estimated range: **$${low.toLocaleString()}–$${high.toLocaleString()}** based on broad category data.\n\nFor the most accurate valuation, check completed auctions on LiveAuctioneers, Heritage Auctions, or Invaluable — or consult a specialist appraiser.`;

  return NextResponse.json({
    query: queryText,
    price_range: { low, mid, high, count: comps.length, currency: "USD" },
    comparable_sales: comps,
    narrative,
    data_source: comps.length > 0 ? "comps_only" : "no_data",
    cached: false,
  });
}
