import { NextRequest, NextResponse } from "next/server";
import { computePriceHistory } from "@/lib/market-stats";

export const dynamic = "force-dynamic";

async function tryBackend(req: NextRequest): Promise<NextResponse | null> {
  const backendUrl = process.env.BACKEND_API_URL;
  if (!backendUrl) return null;
  try {
    const upstream = await fetch(
      `${backendUrl}/api/v1/market/price-history?${req.nextUrl.searchParams.toString()}`,
      { next: { revalidate: 300 } }
    );
    if (upstream.ok) return NextResponse.json(await upstream.json());
  } catch {
    // Backend unavailable — fall through
  }
  return null;
}

export async function GET(req: NextRequest) {
  // Priority 1: FastAPI backend (has real Supabase data)
  const proxied = await tryBackend(req);
  if (proxied) return proxied;

  // Priority 2: Aggregate from scraped eBay sold comps
  const { searchParams } = req.nextUrl;
  const category = searchParams.get("category") ?? "";
  const months = Math.min(60, Math.max(1, parseInt(searchParams.get("months") ?? "24") || 24));

  if (!category) {
    return NextResponse.json({ error: "category is required" }, { status: 400 });
  }

  const buckets = computePriceHistory(category, months);

  return NextResponse.json({
    category,
    maker: searchParams.get("maker") ?? null,
    sub_category: searchParams.get("sub_category") ?? null,
    period: searchParams.get("period") ?? null,
    condition_bucket: searchParams.get("condition_bucket") ?? null,
    months,
    buckets,
    data_source: "scraped_ebay_comps",
  });
}
