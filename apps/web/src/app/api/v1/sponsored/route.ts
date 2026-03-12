import { NextResponse } from "next/server";

export interface SponsoredListing {
  id: string;
  title: string;
  description: string;
  sponsor_name: string;
  sponsor_url: string;
  primary_image_url: string | null;
  category: string | null;
  listing_type: string;
  city: string | null;
  state: string | null;
  sale_ends_at: string | null;
  cta_label: string;
  badge_label: string;
  sort_weight: number;
}

function loadSponsored(): SponsoredListing[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const data: unknown = require("@/data/sponsored-listings.json");
    if (Array.isArray(data)) return data as SponsoredListing[];
  } catch {
    // Config not found — no sponsored listings
  }
  return [];
}

export async function GET() {
  const listings = loadSponsored().sort((a, b) => a.sort_weight - b.sort_weight);
  return NextResponse.json(listings, {
    headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=600" },
  });
}
