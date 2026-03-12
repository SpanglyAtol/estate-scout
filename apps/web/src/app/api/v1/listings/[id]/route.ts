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
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const upstream = await fetch(
        `${backendUrl}/api/v1/listings/${numId}`,
        { next: { revalidate: 60 }, signal: controller.signal }
      );
      clearTimeout(timer);
      if (upstream.ok) return NextResponse.json(await upstream.json());
      // 404 from backend — fall through to Supabase / JSON bundle
      if (upstream.status === 404) {
        // Don't fall through to stale JSON for explicitly missing backend IDs
        return NextResponse.json({ detail: "Listing not found" }, { status: 404 });
      }
    } catch {
      // Backend unavailable or timed out — fall through to Supabase / JSON
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
