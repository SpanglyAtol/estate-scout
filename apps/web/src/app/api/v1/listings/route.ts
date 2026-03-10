import { NextRequest, NextResponse } from "next/server";
import { getListings } from "@/lib/scraped-data";

export async function GET(req: NextRequest) {
  // Proxy to FastAPI backend when configured (supports 40k+ DB listings)
  const backendUrl = process.env.BACKEND_API_URL;
  if (backendUrl) {
    try {
      const upstream = await fetch(
        `${backendUrl}/api/v1/listings?${req.nextUrl.searchParams.toString()}`,
        { next: { revalidate: 60 } }
      );
      if (upstream.ok) return NextResponse.json(await upstream.json());
    } catch {
      // Backend unavailable — fall through to JSON bundle
    }
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") ?? "1");
  const pageSize = parseInt(searchParams.get("page_size") ?? "24");

  const listings = getListings();
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const slice = listings.slice(start, end);

  return NextResponse.json(slice);
}
