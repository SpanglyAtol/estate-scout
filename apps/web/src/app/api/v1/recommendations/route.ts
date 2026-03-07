import { NextResponse } from "next/server";
import type { MockListing } from "@/app/api/v1/_mock-data";

interface CuratedListing extends MockListing {
  curatorial_note: string;
  featured_reason: string;
  is_curated: boolean;
}

interface CuratedData {
  generated_at: string;
  featured: CuratedListing[];
  category_picks: Record<string, CuratedListing[]>;
  total_live_listings: number;
}

function loadCuratedData(): CuratedData | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const data: unknown = require("@/data/scraped-curated.json");
    if (data && typeof data === "object" && "featured" in data) {
      return data as CuratedData;
    }
  } catch {
    // File not yet generated
  }
  return null;
}

export async function GET() {
  const data = loadCuratedData();

  if (!data) {
    return NextResponse.json(
      { featured: [], category_picks: {}, generated_at: null, total_live_listings: 0 },
      { status: 200 }
    );
  }

  return NextResponse.json(data);
}
