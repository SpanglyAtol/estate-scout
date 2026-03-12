/**
 * MarketContextStrip — server component.
 * Shows a compact market summary for the listing's category on the detail page.
 */
import Link from "next/link";
import { computeCategorySnapshot, GUIDE_CATEGORIES } from "@/lib/market-stats";
import type { Listing } from "@/types";

interface Props {
  listing: Listing;
}

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const TREND_ICON: Record<string, string> = {
  rising:  "↑",
  falling: "↓",
  stable:  "→",
};
const TREND_COLOR: Record<string, string> = {
  rising:  "text-green-700",
  falling: "text-red-600",
  stable:  "text-gray-500",
};

/** Match a listing's free-text category field to one of our guide category slugs */
function matchSlug(category: string | null | undefined): string | null {
  if (!category) return null;
  const lc = category.toLowerCase();
  for (const cat of GUIDE_CATEGORIES) {
    if (cat.keywords.some((kw) => lc.includes(kw))) return cat.slug;
    if (lc.includes(cat.slug)) return cat.slug;
  }
  return null;
}

export async function MarketContextStrip({ listing }: Props) {
  const slug = matchSlug(listing.category);
  if (!slug) return null;

  const snap = computeCategorySnapshot(slug, 12);
  if (!snap || !snap.median_price) return null;

  const hasGuide = true; // pricing guide exists for all known slugs

  return (
    <section className="border border-antique-border rounded-lg bg-antique-surface/60 p-4 text-sm">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs text-antique-text-mute uppercase tracking-wide mb-1 font-medium">
            {snap.display_label} Market
          </p>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-lg font-bold text-antique-text">
              {fmt(snap.median_price)}
            </span>
            <span className="text-xs text-antique-text-mute">median sold price</span>
            {snap.trend_direction && (
              <span className={`text-xs font-semibold ${TREND_COLOR[snap.trend_direction]}`}>
                {TREND_ICON[snap.trend_direction]}
                {snap.trend_pct !== null && ` ${Math.abs(snap.trend_pct)}%`}
              </span>
            )}
          </div>
          {snap.p25_price && snap.p75_price && (
            <p className="text-xs text-antique-text-mute mt-0.5">
              Typical range: {fmt(snap.p25_price)} – {fmt(snap.p75_price)} &nbsp;·&nbsp;{" "}
              {snap.sale_count} recent sales
            </p>
          )}
        </div>

        {hasGuide && (
          <Link
            href={`/pricing-guide/${slug}`}
            className="shrink-0 text-xs font-medium text-antique-accent hover:underline"
          >
            View pricing guide →
          </Link>
        )}
      </div>
    </section>
  );
}
