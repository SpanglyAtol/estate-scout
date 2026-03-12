import { NextRequest, NextResponse } from "next/server";
import { computeCategorySnapshot, computeAllSnapshots } from "@/lib/market-stats";

export const dynamic = "force-dynamic";

async function tryBackend(req: NextRequest): Promise<NextResponse | null> {
  const backendUrl = process.env.BACKEND_API_URL;
  if (!backendUrl) return null;
  try {
    const upstream = await fetch(
      `${backendUrl}/api/v1/market/index?${req.nextUrl.searchParams.toString()}`,
      { next: { revalidate: 300 } }
    );
    if (upstream.ok) return NextResponse.json(await upstream.json());
  } catch {
    // Backend unavailable — fall through
  }
  return null;
}

export async function GET(req: NextRequest) {
  // Priority 1: FastAPI backend
  const proxied = await tryBackend(req);
  if (proxied) return proxied;

  // Priority 2: Scraped data aggregation
  const { searchParams } = req.nextUrl;
  const category = searchParams.get("category");
  const months = Math.min(24, Math.max(1, parseInt(searchParams.get("months") ?? "12") || 12));

  if (category) {
    const snapshot = computeCategorySnapshot(category, months);
    if (!snapshot) {
      return NextResponse.json({ category, snapshot: null, history: [], data_source: "scraped_ebay_comps" });
    }
    return NextResponse.json({ category, snapshot, history: [], data_source: "scraped_ebay_comps" });
  }

  // No category — return all snapshots
  const snapshots = computeAllSnapshots(months);
  return NextResponse.json({ snapshots, data_source: "scraped_ebay_comps" });
}
