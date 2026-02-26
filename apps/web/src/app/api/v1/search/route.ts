import { NextRequest, NextResponse } from "next/server";
import { getListings } from "@/lib/scraped-data";

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

  const start = (page - 1) * pageSize;
  return NextResponse.json(results.slice(start, start + pageSize));
}
