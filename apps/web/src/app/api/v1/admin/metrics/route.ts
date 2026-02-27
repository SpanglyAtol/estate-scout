import { NextResponse } from "next/server";
import { getListings } from "@/lib/scraped-data";

export interface AdminMetrics {
  total: number;
  by_status: {
    live: number;
    upcoming: number;
    ended: number;
    ending_soon: number;
  };
  by_platform: {
    name: string;
    display_name: string;
    count: number;
    pct: number;
  }[];
  by_category: {
    name: string;
    count: number;
    pct: number;
  }[];
  quality: {
    with_image: number;
    with_image_pct: number;
    with_location: number;
    with_location_pct: number;
    with_price: number;
    with_price_pct: number;
    with_category: number;
    with_category_pct: number;
  };
  latest_scraped_at: string | null;
  data_age_hours: number | null;
}

export async function GET() {
  const all = getListings();
  const now = Date.now();
  const total = all.length;

  if (total === 0) {
    return NextResponse.json({ error: "No listings loaded" }, { status: 404 });
  }

  let live = 0, upcoming = 0, ended = 0, endingSoon = 0;
  let withImage = 0, withLocation = 0, withPrice = 0, withCategory = 0;

  const platformCounts: Record<string, { display_name: string; count: number }> = {};
  const categoryCounts: Record<string, number> = {};
  let latestScrapedAt: string | null = null;

  for (const l of all) {
    const starts = l.sale_starts_at ? new Date(l.sale_starts_at).getTime() : null;
    const ends   = l.sale_ends_at   ? new Date(l.sale_ends_at).getTime()   : null;

    if (l.is_completed)                              { ended++; }
    else if (starts !== null && starts > now)        { upcoming++; }
    else if (ends !== null   && ends < now)          { ended++; }
    else {
      if (ends !== null && ends - now < 86_400_000) endingSoon++;
      live++;
    }

    if (l.primary_image_url)                    withImage++;
    if (l.city || l.state || l.zip_code)        withLocation++;
    if (l.current_price !== null)               withPrice++;
    if (l.category) {
      withCategory++;
      categoryCounts[l.category] = (categoryCounts[l.category] ?? 0) + 1;
    }

    const pName = l.platform.name;
    if (!platformCounts[pName]) {
      platformCounts[pName] = { display_name: l.platform.display_name, count: 0 };
    }
    platformCounts[pName].count++;

    if (l.scraped_at && (!latestScrapedAt || l.scraped_at > latestScrapedAt)) {
      latestScrapedAt = l.scraped_at;
    }
  }

  const byPlatform = Object.entries(platformCounts)
    .sort(([, a], [, b]) => b.count - a.count)
    .map(([name, data]) => ({
      name,
      display_name: data.display_name,
      count: data.count,
      pct: Math.round((data.count / total) * 100),
    }));

  const byCategory = Object.entries(categoryCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([name, count]) => ({
      name,
      count,
      pct: Math.round((count / total) * 100),
    }));

  const dataAgeHours = latestScrapedAt
    ? Math.round((now - new Date(latestScrapedAt).getTime()) / 3_600_000)
    : null;

  const metrics: AdminMetrics = {
    total,
    by_status: { live, upcoming, ended, ending_soon: endingSoon },
    by_platform: byPlatform,
    by_category: byCategory,
    quality: {
      with_image:         withImage,
      with_image_pct:     Math.round((withImage     / total) * 100),
      with_location:      withLocation,
      with_location_pct:  Math.round((withLocation  / total) * 100),
      with_price:         withPrice,
      with_price_pct:     Math.round((withPrice     / total) * 100),
      with_category:      withCategory,
      with_category_pct:  Math.round((withCategory  / total) * 100),
    },
    latest_scraped_at: latestScrapedAt,
    data_age_hours:    dataAgeHours,
  };

  return NextResponse.json(metrics, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
  });
}
