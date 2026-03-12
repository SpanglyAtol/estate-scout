import type { Metadata } from "next";
import Link from "next/link";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { computeAllSnapshots } from "@/lib/market-stats";
import type { MarketSnapshot } from "@/lib/market-stats";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Antique Pricing Guide — Market Data & Price Trends | Estate Scout",
  description:
    "Real sold-price data for antiques, jewelry, silver, watches, ceramics, and more. Browse category price trends powered by eBay completed sales.",
};

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function TrendBadge({ snapshot }: { snapshot: MarketSnapshot }) {
  const dir = snapshot.trend_direction;
  const pct = snapshot.trend_pct;

  if (!dir || dir === "stable") {
    return (
      <span className="flex items-center gap-1 text-xs text-gray-500 font-medium">
        <Minus className="w-3 h-3" />
        Stable
      </span>
    );
  }

  if (dir === "rising") {
    return (
      <span className="flex items-center gap-1 text-xs text-green-700 font-semibold">
        <TrendingUp className="w-3.5 h-3.5" />
        {pct !== null ? `+${pct}%` : "Rising"}
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1 text-xs text-red-600 font-semibold">
      <TrendingDown className="w-3.5 h-3.5" />
      {pct !== null ? `${pct}%` : "Falling"}
    </span>
  );
}

function CategoryCard({ snapshot }: { snapshot: MarketSnapshot }) {
  return (
    <Link
      href={`/pricing-guide/${snapshot.category}`}
      className="group block border border-antique-border rounded-xl bg-antique-surface hover:border-antique-accent transition-colors p-5 space-y-3"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-display font-semibold text-antique-text group-hover:text-antique-accent transition-colors text-base">
          {snapshot.display_label}
        </h2>
        <TrendBadge snapshot={snapshot} />
      </div>

      {snapshot.median_price && (
        <div>
          <p className="text-2xl font-bold text-antique-accent">{fmt(snapshot.median_price)}</p>
          <p className="text-xs text-antique-text-mute mt-0.5">median sold price</p>
        </div>
      )}

      {snapshot.p25_price && snapshot.p75_price && (
        <div className="h-2 bg-antique-muted rounded-full overflow-hidden relative">
          {/* Interquartile range bar */}
          {snapshot.min_price && snapshot.max_price && (
            <div
              className="absolute h-full bg-antique-accent/40 rounded-full"
              style={{
                left: `${((snapshot.p25_price - snapshot.min_price) / (snapshot.max_price - snapshot.min_price)) * 100}%`,
                width: `${((snapshot.p75_price - snapshot.p25_price) / (snapshot.max_price - snapshot.min_price)) * 100}%`,
              }}
            />
          )}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-antique-text-mute">
        {snapshot.p25_price && snapshot.p75_price ? (
          <span>
            Typical: {fmt(snapshot.p25_price)} – {fmt(snapshot.p75_price)}
          </span>
        ) : <span />}
        <span>{snapshot.sale_count} sales</span>
      </div>
    </Link>
  );
}

export default async function PricingGuidePage() {
  const snapshots = computeAllSnapshots(12);

  const rising = snapshots.filter((s) => s.trend_direction === "rising");
  const others = snapshots.filter((s) => s.trend_direction !== "rising");

  return (
    <div className="container mx-auto px-4 py-10 max-w-5xl">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-antique-text mb-2">
          Antique Pricing Guide
        </h1>
        <p className="text-antique-text-sec max-w-2xl">
          Market prices derived from real completed sales across eBay and major auction
          platforms. Updated daily. Click any category for 24-month price history.
        </p>
      </div>

      {snapshots.length === 0 ? (
        <div className="text-center py-20 text-antique-text-mute">
          <p className="text-lg font-medium mb-2">No pricing data yet</p>
          <p className="text-sm">
            Price data is collected from daily eBay sold listings scrapes.
            Check back after the first scrape run.
          </p>
        </div>
      ) : (
        <>
          {rising.length > 0 && (
            <section className="mb-10">
              <h2 className="text-sm font-semibold text-antique-text-mute uppercase tracking-widest mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-600" />
                Rising Markets
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {rising.map((s) => (
                  <CategoryCard key={s.category} snapshot={s} />
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="text-sm font-semibold text-antique-text-mute uppercase tracking-widest mb-4">
              All Categories
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {others.map((s) => (
                <CategoryCard key={s.category} snapshot={s} />
              ))}
            </div>
          </section>
        </>
      )}

      <p className="mt-10 text-xs text-antique-text-mute text-center">
        Price data sourced from eBay completed/sold listings in antique categories.
        Past performance does not guarantee future prices. For professional appraisal, consult a certified appraiser.
      </p>
    </div>
  );
}
