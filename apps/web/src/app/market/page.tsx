"use client";

/**
 * Market Intelligence — /market
 *
 * Unified page combining:
 *   - AI Price Check (instant market value for any item)
 *   - Category Price Library (browse real sold-price ranges by category)
 *   - Market Trends (24-month category trend data from completed sales)
 */

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  TrendingUp, TrendingDown, Minus, Search, Loader2,
  ArrowRight, ChevronRight, BarChart3, BookOpen, Sparkles,
} from "lucide-react";
import { getValuation } from "@/lib/api-client";
import { CompGrid } from "@/components/valuation/comp-grid";
import type { ValuationResult } from "@/types";
import { cn } from "@/lib/cn";

// ── Library categories (shared between Library tab and old /library page) ─────

const LIB_CATEGORIES = [
  { name: "Ceramics & Porcelain",  emoji: "🏺", blurb: "Meissen, Limoges, Wedgwood, majolica, stoneware",             query: "antique porcelain ceramic vase figurine",                exampleRange: "$50 – $8,000"  },
  { name: "Silver & Metalware",    emoji: "🥄", blurb: "Sterling flatware, candlesticks, tea services, pewter",         query: "sterling silver antique flatware tea service",           exampleRange: "$80 – $12,000" },
  { name: "Furniture",             emoji: "🪑", blurb: "Victorian, Arts & Crafts, mid-century, Chippendale",           query: "antique furniture Victorian mahogany chest dresser",     exampleRange: "$200 – $25,000"},
  { name: "Art & Paintings",       emoji: "🖼", blurb: "Oil paintings, watercolors, prints, folk art",                  query: "antique oil painting signed original art",               exampleRange: "$100 – $50,000"},
  { name: "Jewelry & Watches",     emoji: "💎", blurb: "Estate jewelry, gold, gems, vintage timepieces",               query: "antique estate jewelry gold gemstone ring brooch",       exampleRange: "$75 – $30,000" },
  { name: "Books & Manuscripts",   emoji: "📚", blurb: "First editions, illustrated books, maps, ephemera",            query: "antique book first edition manuscript map",              exampleRange: "$20 – $5,000"  },
  { name: "Rugs & Textiles",       emoji: "🧵", blurb: "Persian rugs, Navajo blankets, tapestries, quilts",            query: "antique Persian oriental rug carpet handwoven",          exampleRange: "$150 – $15,000"},
  { name: "Glass & Crystal",       emoji: "🔮", blurb: "Tiffany, Murano, Lalique, Depression glass, art glass",        query: "antique glass crystal art glass Tiffany Lalique",        exampleRange: "$30 – $10,000" },
  { name: "Clocks & Instruments",  emoji: "⏰", blurb: "Mantel clocks, pocket watches, scientific instruments",         query: "antique clock mantel grandfather pocket watch",          exampleRange: "$100 – $8,000" },
  { name: "Coins & Stamps",        emoji: "🪙", blurb: "US coins, world coins, rare stamps, currency",                 query: "antique coin rare stamp currency collectible",           exampleRange: "$10 – $20,000" },
  { name: "Toys & Collectibles",   emoji: "🪆", blurb: "Cast iron banks, tin toys, dolls, advertising",                query: "antique toy cast iron bank tin toy collectible doll",    exampleRange: "$25 – $5,000"  },
  { name: "Silver & Gold Coins",   emoji: "🏅", blurb: "Bullion, pre-1933 gold, Morgan dollars, trade coins",          query: "silver gold coin Morgan dollar pre-1933 bullion",        exampleRange: "$25 – $50,000" },
] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = "price-check" | "library" | "trends";

interface PriceCheckResult {
  estimated_low: number | null;
  estimated_high: number | null;
  estimated_median: number | null;
  confidence: "high" | "medium" | "low" | "insufficient_data";
  data_points_used: number;
  asking_price_verdict: "fair" | "below_market" | "above_market" | "unknown" | null;
  asking_price_delta_pct: number | null;
  reasoning: string;
  key_value_factors: string[];
  market_trend_summary: string | null;
  comparable_sales: Array<{
    title: string;
    price: number;
    sale_date: string | null;
    platform: string;
    condition: string | null;
    url: string | null;
  }>;
  data_source: string;
  cached: boolean;
}

interface MarketSnapshot {
  category: string;
  display_label: string;
  sale_count: number;
  median_price: number | null;
  p25_price: number | null;
  p75_price: number | null;
  min_price: number | null;
  max_price: number | null;
  trend_pct: number | null;
  trend_direction: string | null;
  last_updated: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const CONFIDENCE_BADGE: Record<string, { label: string; cls: string }> = {
  high:              { label: "High confidence",   cls: "text-green-700 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-950/30 dark:border-green-800" },
  medium:            { label: "Medium confidence", cls: "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/30 dark:border-amber-800" },
  low:               { label: "Low confidence",    cls: "text-orange-700 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-950/30 dark:border-orange-800" },
  insufficient_data: { label: "Insufficient data", cls: "text-antique-text-mute bg-antique-muted border-antique-border" },
};

const VERDICT_CFG: Record<string, { label: string; cls: string; icon: string }> = {
  fair:         { label: "Fair market price",        cls: "text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-950/30",  icon: "✓" },
  below_market: { label: "Below market — good deal", cls: "text-blue-700 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/30",    icon: "↓" },
  above_market: { label: "Above market — negotiate", cls: "text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-950/30",        icon: "↑" },
  unknown:      { label: "Price verdict unknown",    cls: "text-antique-text-mute bg-antique-muted",                              icon: "?" },
};

const EXAMPLES = [
  "Tiffany & Co sterling silver candlestick 1900s",
  "Meissen porcelain figurine 18th century",
  "Louis Vuitton steamer trunk circa 1920",
  "Rolex Submariner ref 5512 1965",
  "Chippendale mahogany highboy 18th century",
  "Weller Louwelsa vase arts and crafts",
];

// ── Tab header ────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: React.ReactNode; description: string }[] = [
  {
    id: "price-check",
    label: "Price Check",
    icon: <Sparkles className="w-4 h-4" />,
    description: "Get an instant AI-powered market value for any item",
  },
  {
    id: "library",
    label: "Price Library",
    icon: <BookOpen className="w-4 h-4" />,
    description: "Browse real sold-price ranges by antique category",
  },
  {
    id: "trends",
    label: "Market Trends",
    icon: <BarChart3 className="w-4 h-4" />,
    description: "24-month price trends from completed auction sales",
  },
];

// ── Price Check Tab ───────────────────────────────────────────────────────────

function PriceCheckTab({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [result, setResult] = useState<PriceCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialQuery) runCheck(initialQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runCheck(q: string) {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    router.replace(`/market?tab=price-check&q=${encodeURIComponent(q.trim())}`, { scroll: false });
    try {
      const res = await fetch("/api/v1/price-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: q.trim() }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Search form */}
      <form onSubmit={(e) => { e.preventDefault(); runCheck(query); }} className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-antique-text-mute pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Describe the item — maker, type, era, condition…"
            className="w-full pl-12 pr-4 py-3.5 border border-antique-border rounded-xl bg-antique-surface text-antique-text placeholder:text-antique-text-mute focus:outline-none focus:border-antique-accent focus:ring-1 focus:ring-antique-accent transition-colors text-base"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="flex items-center gap-2 bg-antique-accent hover:bg-antique-accent-h disabled:opacity-50 text-white px-6 py-3.5 rounded-xl font-semibold transition-colors flex-shrink-0"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
          Check Price
        </button>
      </form>

      {/* Example queries */}
      {!result && !loading && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-antique-text-mute self-center mr-1">Try:</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => { setQuery(ex); runCheck(ex); }}
              className="text-xs bg-antique-muted border border-antique-border text-antique-text-sec hover:border-antique-accent hover:text-antique-accent px-3 py-1.5 rounded-full transition-colors"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-3 py-12 justify-center text-antique-text-sec">
          <Loader2 className="w-6 h-6 animate-spin text-antique-accent" />
          <span>
            Analyzing market data for <strong className="text-antique-text">&ldquo;{query}&rdquo;</strong>…
          </span>
        </div>
      )}

      {result && !loading && (
        <div className="antique-card p-6 space-y-6">
          {/* Price headline */}
          <div className="flex flex-wrap items-end gap-4">
            {result.estimated_median ? (
              <>
                <div>
                  <p className="text-xs text-antique-text-mute uppercase tracking-wide mb-1">Estimated Market Value</p>
                  <p className="font-display text-4xl font-bold text-antique-text">{fmt(result.estimated_median)}</p>
                  {result.estimated_low != null && result.estimated_high != null && (
                    <p className="text-sm text-antique-text-sec mt-1">
                      Range: {fmt(result.estimated_low)} – {fmt(result.estimated_high)}
                    </p>
                  )}
                </div>

                {result.asking_price_verdict && result.asking_price_verdict !== "unknown" && VERDICT_CFG[result.asking_price_verdict] && (
                  <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold ${VERDICT_CFG[result.asking_price_verdict].cls}`}>
                    <span className="text-xl leading-none">{VERDICT_CFG[result.asking_price_verdict].icon}</span>
                    {VERDICT_CFG[result.asking_price_verdict].label}
                    {result.asking_price_delta_pct != null && (
                      <span className="text-xs opacity-70 ml-1">
                        ({result.asking_price_delta_pct > 0 ? "+" : ""}{result.asking_price_delta_pct.toFixed(0)}%)
                      </span>
                    )}
                  </div>
                )}
              </>
            ) : (
              <p className="text-antique-text-sec italic">
                No estimate available — try adding more detail (maker, era, condition, marks).
              </p>
            )}

            {CONFIDENCE_BADGE[result.confidence] && (
              <span className={`text-xs px-3 py-1.5 rounded-full border font-medium ml-auto ${CONFIDENCE_BADGE[result.confidence].cls}`}>
                {CONFIDENCE_BADGE[result.confidence].label}
                {result.data_points_used > 0 && (
                  <span className="opacity-70"> · {result.data_points_used} comps</span>
                )}
              </span>
            )}
          </div>

          {result.reasoning && (
            <div className="bg-antique-muted/60 rounded-xl p-4 border border-antique-border">
              <p className="text-sm text-antique-text-sec leading-relaxed">{result.reasoning}</p>
            </div>
          )}

          {result.key_value_factors.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-antique-text-mute uppercase tracking-wide mb-3">Key Value Factors</p>
              <ul className="space-y-1.5">
                {result.key_value_factors.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-antique-text-sec">
                    <span className="text-antique-accent mt-0.5 shrink-0">›</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.market_trend_summary && (
            <p className="text-xs text-antique-text-mute italic border-t border-antique-border pt-4">
              {result.market_trend_summary}
            </p>
          )}

          {result.comparable_sales.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-antique-text-mute uppercase tracking-wide mb-3">
                Comparable Sales ({result.comparable_sales.length})
              </p>
              <div className="divide-y divide-antique-border">
                {result.comparable_sales.slice(0, 6).map((c, i) => (
                  <div key={i} className="py-3 flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-antique-text truncate">{c.title}</p>
                      <p className="text-xs text-antique-text-mute mt-0.5">
                        {c.platform}
                        {c.sale_date ? ` · ${c.sale_date.slice(0, 10)}` : ""}
                        {c.condition ? ` · ${c.condition}` : ""}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {c.url ? (
                        <a href={c.url} target="_blank" rel="noopener noreferrer"
                          className="text-sm font-bold text-antique-accent hover:underline">
                          {fmt(c.price)}
                        </a>
                      ) : (
                        <span className="text-sm font-bold text-antique-text">{fmt(c.price)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-antique-border text-xs text-antique-text-mute">
            <span>
              {result.cached ? "Cached result" : "Fresh analysis"} ·{" "}
              {result.data_source === "claude_with_market_data"
                ? "AI + market database"
                : result.data_source === "claude_no_data"
                ? "AI estimate (no comps)"
                : "Statistical estimate"}
            </span>
            <button onClick={() => runCheck(query)} className="text-antique-accent hover:underline">
              Re-run
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Library Tab ───────────────────────────────────────────────────────────────

type LibCategory = (typeof LIB_CATEGORIES)[number];

function LibraryTab() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ValuationResult | null>(null);
  const [activeCategory, setActiveCategory] = useState<LibCategory | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runSearch(q: string, category?: LibCategory) {
    if (!q.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);
    setActiveCategory(category ?? null);
    try {
      const res = await getValuation({ query_text: q });
      setResult(res);
    } catch {
      setError("Price lookup unavailable — make sure the backend is running.");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    runSearch(query);
  }

  function handleCategoryClick(cat: LibCategory) {
    setQuery(cat.query);
    runSearch(cat.query, cat);
    setTimeout(() => {
      document.getElementById("library-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }

  return (
    <div className="space-y-10">
      {/* Search bar */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-antique-text-mute pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='e.g. "Meissen porcelain figurine" or "Tiffany lamp"'
            className="w-full pl-10 pr-4 py-3 border border-antique-border rounded-xl bg-antique-surface text-antique-text placeholder:text-antique-text-mute focus:outline-none focus:border-antique-accent transition-colors"
          />
        </div>
        <button
          type="submit"
          disabled={!query.trim() || loading}
          className="flex items-center gap-2 bg-antique-accent text-white px-5 py-3 rounded-xl font-semibold hover:bg-antique-accent-h disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Look up
        </button>
      </form>

      {/* Results */}
      {(loading || result || error) && (
        <div id="library-results" className="space-y-4">
          {activeCategory && (
            <div className="flex items-center gap-2 text-sm text-antique-text-sec">
              <span className="text-xl">{activeCategory.emoji}</span>
              <span className="font-medium text-antique-text">{activeCategory.name}</span>
              <ChevronRight className="w-4 h-4" />
              <span>{query}</span>
            </div>
          )}
          {loading && (
            <div className="flex items-center justify-center gap-3 py-16 text-antique-text-mute">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span>Searching completed auction records…</span>
            </div>
          )}
          {error && (
            <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 px-5 py-4 text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}
          {result && !loading && (
            <CompGrid
              comps={result.comparable_sales}
              priceRange={result.price_range}
              confidenceLevel={result.confidence_level}
              confidenceReason={result.confidence_reason}
              priceSpread={result.price_spread}
              clarifyingPrompts={result.clarifying_prompts}
              detectionSummary={result.detection_summary}
              isHighAmbiguity={result.is_high_ambiguity}
            />
          )}
        </div>
      )}

      {/* Category grid */}
      <div>
        <h2 className="text-lg font-bold text-antique-text font-display mb-4">Browse by Category</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {LIB_CATEGORIES.map((cat) => (
            <button
              key={cat.name}
              onClick={() => handleCategoryClick(cat)}
              disabled={loading}
              className={[
                "text-left p-4 rounded-2xl border transition-all",
                "hover:border-antique-accent hover:shadow-md hover:-translate-y-0.5",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                activeCategory?.name === cat.name
                  ? "border-antique-accent bg-antique-accent-s shadow-md"
                  : "border-antique-border bg-antique-surface",
              ].join(" ")}
            >
              <span className="text-3xl block mb-2">{cat.emoji}</span>
              <p className="font-semibold text-sm text-antique-text leading-snug">{cat.name}</p>
              <p className="text-xs text-antique-text-mute mt-1 leading-relaxed line-clamp-2">{cat.blurb}</p>
              <p className="text-xs font-medium text-antique-accent mt-2">{cat.exampleRange}</p>
            </button>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div className="bg-antique-muted border border-antique-border rounded-2xl p-6 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
        {[
          { icon: "🔍", title: "Real auction data", body: "Price ranges built from completed auction results — what items actually sold for, not asking prices." },
          { icon: "🤖", title: "AI-backed analysis", body: "Finds closest matches to your description and explains its confidence level." },
          { icon: "📅", title: "No sale needed", body: "Research before you buy, sell, or insure — even when nothing is currently listed." },
        ].map(({ icon, title, body }) => (
          <div key={title} className="space-y-2">
            <span className="text-4xl block">{icon}</span>
            <p className="font-semibold text-antique-text">{title}</p>
            <p className="text-sm text-antique-text-sec leading-relaxed">{body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Market Trends Tab ─────────────────────────────────────────────────────────

function TrendBadge({ snapshot }: { snapshot: MarketSnapshot }) {
  const dir = snapshot.trend_direction;
  const pct = snapshot.trend_pct;

  if (!dir || dir === "stable") {
    return <span className="flex items-center gap-1 text-xs text-antique-text-mute font-medium"><Minus className="w-3 h-3" />Stable</span>;
  }
  if (dir === "rising") {
    return <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-semibold"><TrendingUp className="w-3.5 h-3.5" />{pct !== null ? `+${pct}%` : "Rising"}</span>;
  }
  return <span className="flex items-center gap-1 text-xs text-red-500 font-semibold"><TrendingDown className="w-3.5 h-3.5" />{pct !== null ? `${pct}%` : "Falling"}</span>;
}

function MarketTrendsTab() {
  const [snapshots, setSnapshots] = useState<MarketSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/v1/market/index")
      .then((r) => r.ok ? r.json() : Promise.reject(r.statusText))
      .then((data: { snapshots: MarketSnapshot[] }) => setSnapshots(data.snapshots ?? []))
      .catch(() => setError("Market data temporarily unavailable."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-antique-text-mute gap-3">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span>Loading market data…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 px-5 py-4 text-sm text-red-700 dark:text-red-400">
        {error}
      </div>
    );
  }

  if (snapshots.length === 0) {
    return (
      <div className="text-center py-20 text-antique-text-mute">
        <p className="text-lg font-medium mb-2">No pricing data yet</p>
        <p className="text-sm">Market data populates daily from eBay sold listings. Check back soon.</p>
      </div>
    );
  }

  const rising = snapshots.filter((s) => s.trend_direction === "rising");
  const others = snapshots.filter((s) => s.trend_direction !== "rising");

  return (
    <div className="space-y-8">
      {rising.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-antique-text-mute uppercase tracking-widest mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
            Rising Markets
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rising.map((s) => <TrendCard key={s.category} snapshot={s} />)}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold text-antique-text-mute uppercase tracking-widest mb-4">
          All Categories
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {others.map((s) => <TrendCard key={s.category} snapshot={s} />)}
        </div>
      </section>

      <p className="text-xs text-antique-text-mute text-center pt-2">
        Price data sourced from eBay completed/sold listings. Past performance does not guarantee future prices.
        For professional appraisal, consult a certified appraiser.
      </p>
    </div>
  );
}

function TrendCard({ snapshot }: { snapshot: MarketSnapshot }) {
  return (
    <Link
      href={`/pricing-guide/${snapshot.category}`}
      className="group block border border-antique-border rounded-xl bg-antique-surface hover:border-antique-accent hover:shadow-md transition-all p-5 space-y-3"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display font-semibold text-antique-text group-hover:text-antique-accent transition-colors text-base">
          {snapshot.display_label}
        </h3>
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
          <span>Typical: {fmt(snapshot.p25_price)} – {fmt(snapshot.p75_price)}</span>
        ) : <span />}
        <span className="flex items-center gap-1">
          {snapshot.sale_count} sales <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
        </span>
      </div>
    </Link>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function MarketPageInner() {
  const searchParams = useSearchParams();
  const initialTab   = (searchParams.get("tab") as Tab) || "price-check";
  const initialQuery = searchParams.get("q") ?? "";

  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const router = useRouter();

  function switchTab(tab: Tab) {
    setActiveTab(tab);
    router.replace(`/market?tab=${tab}`, { scroll: false });
  }

  return (
    <div className="container mx-auto px-4 py-10 max-w-5xl">
      {/* Page header */}
      <div className="mb-8 text-center max-w-2xl mx-auto">
        <p className="text-xs font-semibold uppercase tracking-widest text-antique-accent mb-2">
          Market Intelligence
        </p>
        <h1 className="font-display text-4xl font-bold text-antique-text leading-tight mb-3">
          Antique Price Guide
        </h1>
        <p className="text-antique-text-sec">
          AI-powered valuations, real sold-price data, and 24-month market trends —
          everything you need to buy and sell with confidence.
        </p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 p-1 bg-antique-muted border border-antique-border rounded-2xl mb-8">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => switchTab(tab.id)}
            className={cn(
              "flex-1 flex flex-col sm:flex-row items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all",
              activeTab === tab.id
                ? "bg-antique-surface text-antique-text shadow-sm border border-antique-border"
                : "text-antique-text-sec hover:text-antique-text"
            )}
          >
            <span className={cn(activeTab === tab.id ? "text-antique-accent" : "")}>
              {tab.icon}
            </span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab description */}
      <p className="text-sm text-antique-text-mute text-center mb-8 -mt-4">
        {TABS.find((t) => t.id === activeTab)?.description}
      </p>

      {/* Tab content */}
      <div>
        {activeTab === "price-check" && <PriceCheckTab initialQuery={initialQuery} />}
        {activeTab === "library"     && <LibraryTab />}
        {activeTab === "trends"      && <MarketTrendsTab />}
      </div>
    </div>
  );
}

export default function MarketPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-20 flex justify-center">
        <Loader2 className="w-8 h-8 text-antique-accent animate-spin" />
      </div>
    }>
      <MarketPageInner />
    </Suspense>
  );
}
