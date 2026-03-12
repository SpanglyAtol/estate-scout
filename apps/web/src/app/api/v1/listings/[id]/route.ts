import { NextRequest, NextResponse } from "next/server";
import { getListings } from "@/lib/scraped-data";
import { getSupabaseListing, isSupabaseConfigured } from "@/lib/supabase-search";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const numId = parseInt(id);
  if (isNaN(numId)) {
    return NextResponse.json({ detail: "Invalid listing ID" }, { status: 400 });
  }

  // ── Proxy to FastAPI backend when configured ────────────────────────────────
  // The backend uses PostgreSQL auto-increment IDs which differ from the
  // sequential IDs reassigned in the local JSON bundle. Proxy first so that
  // IDs from search results (which also proxy to the backend) always resolve.
  const backendUrl = process.env.BACKEND_API_URL;
  if (backendUrl) {
    try {
      const upstream = await fetch(
        `${backendUrl}/api/v1/listings/${numId}`,
        { next: { revalidate: 60 } }
      );
      if (upstream.ok) return NextResponse.json(await upstream.json());
      // 404 from backend → fall through to JSON bundle (dev data may differ)
    } catch {
      // Backend unavailable — fall through to JSON bundle
    }
  }

  // ── Priority 2: Direct Supabase query ─────────────────────────────────────
  if (isSupabaseConfigured()) {
    const supabaseListing = await getSupabaseListing(numId);
    if (supabaseListing) return NextResponse.json(supabaseListing);
  }

  // ── Fallback: local JSON bundle ─────────────────────────────────────────────
  const listing = getListings().find((l) => l.id === numId);
  if (!listing) {
    return NextResponse.json({ detail: "Listing not found" }, { status: 404 });
  }
  return NextResponse.json(listing);
}
