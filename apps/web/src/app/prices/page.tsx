/**
 * Market Prices — Historical Price Charts
 * ─────────────────────────────────────────
 * Aggregates sold + asking prices from the scraped dataset and renders
 * inline SVG charts per category. No external charting library needed.
 *
 * Data sources:
 *  - Listings with is_completed=true + final_price → sold price comps
 *    (populated once the eBay sold listings scraper runs)
 *  - Listings with current_price → live asking price distribution
 *
 * Charts rendered:
 *  1. Category median price bar chart (all categories)
 *  2. Per-category price histogram (price buckets × count)
 *  3. Platform avg price comparison
 *  4. Recent sold prices table (eBay data)
 */
import { TrendingUp, DollarSign, BarChart3, Tag, ShoppingBag } from "lucide-react";
import { getListings } from "@/lib/scraped-data";
import type { MockListing } from "@/app/api/v1/_mock-data";

export const dynamic = "force-dynamic";

// ── Colour palette ────────────────────────────────────────────────────────────
const HEX_COLOURS = [
  "#8B6914", "#60A5FA", "#4ADE80",
  "#FBBF24", "#A78BFA", "#FB7185",
  "#2DD4BF", "#FB923C",
];

// ── Data utilities ────────────────────────────────────────────────────────────

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function avg(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function priceBuckets(
  prices: number[],
  bucketCount = 8,
): { label: string; count: number }[] {
  if (!prices.length) return [];
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (min === max) return [{ label: `$${Math.round(min)}`, count: prices.length }];

  const step = (max - min) / bucketCount;
  const buckets = Array.from({ length: bucketCount }, (_, i) => ({
    lo: min + i * step,
    hi: min + (i + 1) * step,
    count: 0,
  }));

  for (const p of prices) {
    const idx = Math.min(Math.floor((p - min) / step), bucketCount - 1);
    buckets[idx].count++;
  }

  return buckets.map(({ lo, count }) => ({
    label: lo >= 1000 ? `$${(lo / 1000).toFixed(1)}k` : `$${Math.round(lo)}`,
    count,
  }));
}

function formatPrice(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${Math.round(n).toLocaleString()}`;
}

// ── SVG Bar Chart ─────────────────────────────────────────────────────────────

function BarChart({
  bars,
  colour,
  height = 120,
}: {
  bars: { label: string; value: number }[];
  colour: string;
  height?: number;
}) {
  if (!bars.length) return null;
  const maxVal = Math.max(...bars.map((b) => b.value), 1);
  const w = 100 / bars.length;

  return (
    <svg
      viewBox={`0 0 100 ${height}`}
      className="w-full"
      preserveAspectRatio="none"
      aria-hidden
    >
      {bars.map((bar, i) => {
        const barH = (bar.value / maxVal) * (height - 20);
        const x = i * w + w * 0.1;
        const y = height - 16 - barH;
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={w * 0.8}
              height={barH}
              fill={colour}
              rx="1"
              opacity={bar.value === 0 ? 0.15 : 0.85}
            />
            <text
              x={x + w * 0.4}
              y={height - 2}
              textAnchor="middle"
              fontSize="4"
              fill="currentColor"
              className="text-antique-text-mute"
            >
              {bar.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Horizontal Bar ────────────────────────────────────────────────────────────

function HBar({ pct, colour }: { pct: number; colour: string }) {
  return (
    <div className="w-full bg-antique-subtle rounded-full h-2 mt-1.5">
      <div
        className="h-2 rounded-full transition-all"
        style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: colour }}
      />
    </div>
  );
}

// ── Section title ─────────────────────────────────────────────────────────────

function SectionTitle({
  icon: Icon,
  children,
}: {
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <h2 className="font-display text-base font-bold text-antique-text mb-5 flex items-center gap-2">
      <Icon className="w-4 h-4 text-antique-accent" />
      {children}
    </h2>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="antique-card p-4 text-center">
      <div className="font-display text-2xl font-bold text-antique-text tabular-nums">
        {value}
      </div>
      <div className="text-xs text-antique-text-mute mt-0.5">{label}</div>
      {sub && (
        <div className="text-xs text-antique-text-mute opacity-70 mt-0.5">{sub}</div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PricesPage() {
  const all: MockListing[] = getListings();

  // Separate sold (eBay/completed) from live listings
  const sold = all.filter(
    (l) => l.is_completed && (l.final_price ?? l.current_price) !== null,
  );
  const live = all.filter(
    (l) => !l.is_completed && l.current_price !== null,
  );
  const withPrice = all.filter(
    (l) => (l.final_price ?? l.current_price) !== null,
  );

  const allPrices = withPrice.map(
    (l) => (l.final_price ?? l.current_price)!,
  );

  // ── Category aggregates ───────────────────────────────────────────────────
  const catMap: Record<
    string,
    { prices: number[]; sold: number[]; count: number }
  > = {};

  for (const l of withPrice) {
    const cat = l.category || "Uncategorised";
    if (!catMap[cat]) catMap[cat] = { prices: [], sold: [], count: 0 };
    const price = (l.final_price ?? l.current_price)!;
    catMap[cat].prices.push(price);
    catMap[cat].count++;
    if (l.is_completed) catMap[cat].sold.push(price);
  }

  const catStats = Object.entries(catMap)
    .map(([name, { prices, sold, count }]) => ({
      name,
      count,
      median:    median(prices),
      avg:       avg(prices),
      soldCount: sold.length,
      soldAvg:   sold.length ? avg(sold) : null,
      min:       Math.min(...prices),
      max:       Math.max(...prices),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  const maxMedian = Math.max(...catStats.map((c) => c.median), 1);

  // ── Platform price comparison ─────────────────────────────────────────────
  const platMap: Record<string, number[]> = {};
  for (const l of withPrice) {
    const name = l.platform.display_name;
    if (!platMap[name]) platMap[name] = [];
    platMap[name].push((l.final_price ?? l.current_price)!);
  }
  const platStats = Object.entries(platMap)
    .map(([name, prices]) => ({ name, avg: avg(prices), count: prices.length }))
    .sort((a, b) => b.avg - a.avg);
  const maxPlatAvg = Math.max(...platStats.map((p) => p.avg), 1);

  // ── Global histogram ──────────────────────────────────────────────────────
  const globalBuckets = priceBuckets(allPrices, 10);

  // ── Recent sold (eBay) ────────────────────────────────────────────────────
  const recentSold = sold
    .filter((l) => l.platform.name === "ebay")
    .sort((a, b) => (b.scraped_at ?? "").localeCompare(a.scraped_at ?? ""))
    .slice(0, 20);

  const soldPrices = sold.map((l) => (l.final_price ?? l.current_price)!);
  const livePrices = live.map((l) => l.current_price!);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">

      {/* ── Header ── */}
      <div className="mb-8">
        <p className="text-antique-accent font-display text-xs tracking-[0.2em] uppercase mb-1">
          Market Intelligence
        </p>
        <h1 className="font-display text-2xl font-bold text-antique-text flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-antique-accent" />
          Market Prices
        </h1>
        <p className="text-sm text-antique-text-mute mt-1">
          Price distribution across {all.length.toLocaleString()} listings from{" "}
          {Object.keys(platMap).length} platforms.
          {sold.length > 0 && (
            <> Includes {sold.length.toLocaleString()} sold price comps.</>
          )}
        </p>
      </div>

      {/* ── KPI row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <StatCard
          label="Median Asking"
          value={formatPrice(median(livePrices))}
          sub={`${live.length.toLocaleString()} live listings`}
        />
        <StatCard
          label="Avg Asking"
          value={formatPrice(avg(livePrices))}
          sub="current listings"
        />
        {soldPrices.length > 0 ? (
          <>
            <StatCard
              label="Median Sold"
              value={formatPrice(median(soldPrices))}
              sub={`${sold.length.toLocaleString()} sold comps`}
            />
            <StatCard
              label="Avg Sold"
              value={formatPrice(avg(soldPrices))}
              sub="actual sale prices"
            />
          </>
        ) : (
          <>
            <StatCard
              label="Price Range"
              value={allPrices.length ? `${formatPrice(Math.min(...allPrices))} – ${formatPrice(Math.max(...allPrices))}` : "—"}
              sub="min → max"
            />
            <StatCard
              label="Categories"
              value={String(catStats.length)}
              sub="with price data"
            />
          </>
        )}
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

        {/* Category median prices */}
        <div className="antique-card p-6">
          <SectionTitle icon={Tag}>Median Price by Category</SectionTitle>
          <div className="space-y-4">
            {catStats.map(({ name, median: med, count }, i) => (
              <div key={name}>
                <div className="flex items-center justify-between text-sm">
                  <span className="capitalize font-medium text-antique-text">{name}</span>
                  <span className="tabular-nums text-antique-text-mute text-xs">
                    {formatPrice(med)}{" "}
                    <span className="opacity-60">({count} listings)</span>
                  </span>
                </div>
                <HBar
                  pct={Math.round((med / maxMedian) * 100)}
                  colour={HEX_COLOURS[i % HEX_COLOURS.length]}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Platform avg price comparison */}
        <div className="antique-card p-6">
          <SectionTitle icon={ShoppingBag}>Avg Price by Platform</SectionTitle>
          <div className="space-y-4">
            {platStats.map(({ name, avg: platAvg, count }, i) => (
              <div key={name}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-antique-text">{name}</span>
                  <span className="tabular-nums text-antique-text-mute text-xs">
                    {formatPrice(platAvg)}{" "}
                    <span className="opacity-60">({count})</span>
                  </span>
                </div>
                <HBar
                  pct={Math.round((platAvg / maxPlatAvg) * 100)}
                  colour={HEX_COLOURS[i % HEX_COLOURS.length]}
                />
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ── Global price histogram ── */}
      <div className="antique-card p-6 mb-6">
        <SectionTitle icon={BarChart3}>Price Distribution (All Listings)</SectionTitle>
        {globalBuckets.length > 0 ? (
          <>
            <div className="h-32">
              <BarChart
                bars={globalBuckets.map(({ label, count }) => ({ label, value: count }))}
                colour={HEX_COLOURS[0]}
                height={120}
              />
            </div>
            <p className="text-xs text-antique-text-mute mt-3 text-center">
              Price bucket → number of listings. Skewed right is typical for antiques markets.
            </p>
          </>
        ) : (
          <p className="text-sm text-antique-text-mute">No price data available yet.</p>
        )}
      </div>

      {/* ── Per-category histograms ── */}
      {catStats.length > 0 && (
        <div className="mb-6">
          <div className="ornament-divider mb-6 text-xs text-antique-text-mute tracking-widest uppercase">
            Price Distribution by Category
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {catStats.slice(0, 6).map(({ name, median: catMed, min, max, count }, i) => {
              const catPrices = withPrice
                .filter((l) => (l.category || "Uncategorised") === name)
                .map((l) => (l.final_price ?? l.current_price)!);
              const buckets = priceBuckets(catPrices, 6);

              return (
                <div key={name} className="antique-card p-4">
                  <h3 className="font-display text-sm font-semibold text-antique-text capitalize mb-1">
                    {name}
                  </h3>
                  <p className="text-xs text-antique-text-mute mb-3">
                    {count} listings · median {formatPrice(catMed)}
                  </p>
                  <div className="h-24">
                    <BarChart
                      bars={buckets.map(({ label, count: c }) => ({ label, value: c }))}
                      colour={HEX_COLOURS[i % HEX_COLOURS.length]}
                      height={90}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-antique-text-mute mt-2">
                    <span>Low: {formatPrice(min)}</span>
                    <span>High: {formatPrice(max)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Sold price comps (eBay) ── */}
      {recentSold.length > 0 ? (
        <div className="antique-card p-6 mb-6">
          <SectionTitle icon={DollarSign}>Recent Sold Prices (eBay)</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-antique-border text-left text-xs text-antique-text-mute uppercase tracking-wide">
                  <th className="pb-2 pr-4 font-medium">Item</th>
                  <th className="pb-2 pr-4 font-medium text-right">Sold For</th>
                  <th className="pb-2 font-medium">Condition</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-antique-border">
                {recentSold.map((l) => (
                  <tr key={l.external_id} className="hover:bg-antique-subtle/50 transition-colors">
                    <td className="py-2 pr-4">
                      <a
                        href={l.external_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-antique-accent hover:underline line-clamp-1 max-w-xs inline-block"
                      >
                        {l.title}
                      </a>
                    </td>
                    <td className="py-2 pr-4 text-right font-semibold tabular-nums text-antique-text">
                      {formatPrice((l.final_price ?? l.current_price)!)}
                    </td>
                    <td className="py-2 text-antique-text-mute text-xs">
                      {l.condition ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="antique-card p-6 mb-6">
          <SectionTitle icon={DollarSign}>Sold Price Comps</SectionTitle>
          <div className="text-center py-8 text-antique-text-mute">
            <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No sold price data yet</p>
            <p className="text-xs mt-1 max-w-sm mx-auto">
              Sold price comparables will appear here once the eBay sold listings
              scraper runs. Trigger it from the{" "}
              <a href="/admin" className="text-antique-accent hover:underline">
                Admin dashboard
              </a>
              .
            </p>
          </div>
        </div>
      )}

      {/* ── How prices are calculated ── */}
      <div className="antique-card p-6">
        <h2 className="font-display text-sm font-bold text-antique-text mb-3">
          About This Data
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-antique-text-sec leading-relaxed">
          <div>
            <p className="font-semibold text-antique-text mb-1">Asking Prices</p>
            <p>
              Current bid / list prices from MaxSold, BidSpotter, HiBid, and
              EstateSales.NET. Refreshed daily. These are what sellers hope to
              get — actual hammer prices may differ.
            </p>
          </div>
          <div>
            <p className="font-semibold text-antique-text mb-1">Sold Comps</p>
            <p>
              Completed listing prices from eBay Sold Listings and 1stDibs.
              These are real transactions — the most reliable market-rate
              signals for AI valuation.
            </p>
          </div>
          <div>
            <p className="font-semibold text-antique-text mb-1">Methodology</p>
            <p>
              Median is preferred over average for skewed antiques pricing. The
              histogram shows frequency at each price bucket to reveal market
              clustering.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
