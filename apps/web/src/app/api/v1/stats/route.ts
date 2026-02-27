import { NextResponse } from "next/server";
import { getListings } from "@/lib/scraped-data";

export interface StatsResult {
  total: number;
  live: number;
  upcoming: number;
  ended: number;
  ending_soon: number;
  platforms: number;
  categories: Record<string, number>;
  scraped_at: string | null;
}

export async function GET() {
  const all = getListings();
  const now = Date.now();

  let live = 0;
  let upcoming = 0;
  let ended = 0;
  let endingSoon = 0;
  const platformSet = new Set<string>();
  const categoryCounts: Record<string, number> = {};

  for (const l of all) {
    platformSet.add(l.platform.name);

    if (l.category) {
      categoryCounts[l.category] = (categoryCounts[l.category] ?? 0) + 1;
    }

    const starts = l.sale_starts_at ? new Date(l.sale_starts_at).getTime() : null;
    const ends   = l.sale_ends_at   ? new Date(l.sale_ends_at).getTime()   : null;

    if (l.is_completed) { ended++; continue; }
    if (starts !== null && starts > now) { upcoming++; continue; }
    if (ends !== null && ends < now) { ended++; continue; }
    if (ends !== null && ends - now < 86_400_000) endingSoon++;
    live++;
  }

  const stats: StatsResult = {
    total: all.length,
    live,
    upcoming,
    ended,
    ending_soon: endingSoon,
    platforms: platformSet.size,
    categories: categoryCounts,
    scraped_at: all[0]?.scraped_at ?? null,
  };

  return NextResponse.json(stats, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
  });
}
