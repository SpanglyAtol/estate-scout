import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { computeCategorySnapshot, computePriceHistory, GUIDE_CATEGORIES, CATEGORY_DISPLAY } from "@/lib/market-stats";
import { PriceHistoryChart } from "@/components/market/price-history-chart";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { category: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const label = CATEGORY_DISPLAY[params.category];
  if (!label) return {};
  return {
    title: `${label} Price Guide — Sold Price History | Estate Scout`,
    description: `Real auction sold prices for ${label.toLowerCase()}. Monthly price trends, interquartile ranges, and comparable sales from eBay completed listings.`,
  };
}

export function generateStaticParams() {
  return GUIDE_CATEGORIES.map((c) => ({ category: c.slug }));
}

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default async function CategoryPricingGuidePage({ params }: PageProps) {
  const { category } = params;
  const label = CATEGORY_DISPLAY[category];
  if (!label) notFound();

  const snapshot = computeCategorySnapshot(category, 24);
  // Newest-first → reverse for chart (oldest left → newest right)
  const buckets = computePriceHistory(category, 24).slice().reverse();

  return (
    <div className="container mx-auto px-4 py-10 max-w-4xl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-antique-text-mute mb-6 flex-wrap">
        <Link href="/" className="hover:text-antique-accent transition-colors">Home</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <Link href="/pricing-guide" className="hover:text-antique-accent transition-colors">Pricing Guide</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-antique-text-sec">{label}</span>
      </nav>

      <h1 className="font-display text-3xl font-bold text-antique-text mb-1">{label}</h1>
      <p className="text-antique-text-mute text-sm mb-8">
        Market prices from real eBay completed/sold listings · Updated daily
      </p>

      {/* Summary cards */}
      {snapshot ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <div className="border border-antique-border rounded-xl p-4 bg-antique-surface">
            <p className="text-xs text-antique-text-mute uppercase tracking-wide mb-1">Median Price</p>
            <p className="text-xl font-bold text-antique-accent">
              {snapshot.median_price ? fmt(snapshot.median_price) : "—"}
            </p>
          </div>
          <div className="border border-antique-border rounded-xl p-4 bg-antique-surface">
            <p className="text-xs text-antique-text-mute uppercase tracking-wide mb-1">Typical Range</p>
            <p className="text-sm font-semibold text-antique-text">
              {snapshot.p25_price && snapshot.p75_price
                ? `${fmt(snapshot.p25_price)} – ${fmt(snapshot.p75_price)}`
                : "—"}
            </p>
          </div>
          <div className="border border-antique-border rounded-xl p-4 bg-antique-surface">
            <p className="text-xs text-antique-text-mute uppercase tracking-wide mb-1">Sales (24 mo)</p>
            <p className="text-xl font-bold text-antique-text">{snapshot.sale_count}</p>
          </div>
          <div className="border border-antique-border rounded-xl p-4 bg-antique-surface">
            <p className="text-xs text-antique-text-mute uppercase tracking-wide mb-1">Trend</p>
            <div className="flex items-center gap-1 mt-1">
              {snapshot.trend_direction === "rising" && (
                <>
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-semibold text-green-700">
                    +{snapshot.trend_pct}%
                  </span>
                </>
              )}
              {snapshot.trend_direction === "falling" && (
                <>
                  <TrendingDown className="w-4 h-4 text-red-500" />
                  <span className="text-sm font-semibold text-red-600">
                    {snapshot.trend_pct}%
                  </span>
                </>
              )}
              {(snapshot.trend_direction === "stable" || !snapshot.trend_direction) && (
                <>
                  <Minus className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-500">Stable</span>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="border border-antique-border rounded-xl p-6 bg-antique-surface mb-8 text-antique-text-mute text-sm">
          No price data yet for this category. Data populates daily from eBay sold listings.
        </div>
      )}

      {/* Price history chart */}
      <section className="border border-antique-border rounded-xl bg-antique-surface p-5 mb-8">
        <h2 className="font-display font-semibold text-antique-text mb-1">
          24-Month Price History
        </h2>
        <p className="text-xs text-antique-text-mute mb-4">
          Monthly median sold price · shaded area = interquartile range (25th–75th percentile)
        </p>
        <PriceHistoryChart
          category={category}
          initialBuckets={buckets}
          months={24}
          className="w-full"
        />
      </section>

      {/* Monthly data table */}
      {buckets.length > 0 && (
        <section className="border border-antique-border rounded-xl bg-antique-surface overflow-hidden mb-8">
          <div className="px-5 py-3 bg-antique-muted border-b border-antique-border">
            <h2 className="text-xs font-semibold text-antique-text-sec uppercase tracking-wide">
              Monthly Breakdown
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-antique-border">
                  <th className="text-left px-5 py-2.5 text-xs text-antique-text-mute font-medium">Month</th>
                  <th className="text-right px-5 py-2.5 text-xs text-antique-text-mute font-medium">Sales</th>
                  <th className="text-right px-5 py-2.5 text-xs text-antique-text-mute font-medium">Median</th>
                  <th className="text-right px-5 py-2.5 text-xs text-antique-text-mute font-medium hidden sm:table-cell">P25</th>
                  <th className="text-right px-5 py-2.5 text-xs text-antique-text-mute font-medium hidden sm:table-cell">P75</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-antique-border">
                {[...buckets].reverse().map((b) => {
                  const d = new Date(b.time_bucket + "T00:00:00Z");
                  const label = d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
                  return (
                    <tr key={b.time_bucket} className="hover:bg-antique-muted/40 transition-colors">
                      <td className="px-5 py-2.5 text-antique-text-sec">{label}</td>
                      <td className="px-5 py-2.5 text-right text-antique-text-mute">{b.sale_count}</td>
                      <td className="px-5 py-2.5 text-right font-medium text-antique-text">
                        {b.median_price ? fmt(b.median_price) : "—"}
                      </td>
                      <td className="px-5 py-2.5 text-right text-antique-text-mute hidden sm:table-cell">
                        {b.p25_price ? fmt(b.p25_price) : "—"}
                      </td>
                      <td className="px-5 py-2.5 text-right text-antique-text-mute hidden sm:table-cell">
                        {b.p75_price ? fmt(b.p75_price) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Other categories nav */}
      <section>
        <h2 className="text-sm font-semibold text-antique-text-mute uppercase tracking-widest mb-3">
          Other Categories
        </h2>
        <div className="flex flex-wrap gap-2">
          {GUIDE_CATEGORIES.filter((c) => c.slug !== category).map((c) => (
            <Link
              key={c.slug}
              href={`/pricing-guide/${c.slug}`}
              className="px-3 py-1.5 text-xs rounded-full border border-antique-border text-antique-text-sec hover:border-antique-accent hover:text-antique-accent transition-colors"
            >
              {c.label}
            </Link>
          ))}
        </div>
      </section>

      <p className="mt-10 text-xs text-antique-text-mute text-center">
        Data sourced from eBay completed listings. For professional appraisal, consult a certified appraiser.
      </p>
    </div>
  );
}
