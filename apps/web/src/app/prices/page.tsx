/**
 * AI Price Guide — per-item market value lookup.
 *
 * Get an instant market value estimate for any antique or collectible.
 * Powered by Claude with real comparable auction sale data.
 */
"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, TrendingUp, Loader2, ArrowRight } from "lucide-react";
import { CATEGORIES } from "@/lib/category-meta";

export const dynamic = "force-dynamic";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PriceCheckResult {
  estimated_low: number | null;
  estimated_high: number | null;
  estimated_median: number | null;
  confidence: "high" | "medium" | "low" | "insufficient_data";
  data_points_used: number;
  asking_price: number | null;
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

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const CONFIDENCE_BADGE: Record<string, { label: string; cls: string }> = {
  high:              { label: "High confidence",   cls: "text-green-700 bg-green-50 border-green-200" },
  medium:            { label: "Medium confidence", cls: "text-amber-700 bg-amber-50 border-amber-200" },
  low:               { label: "Low confidence",    cls: "text-orange-700 bg-orange-50 border-orange-200" },
  insufficient_data: { label: "Insufficient data", cls: "text-gray-500 bg-gray-50 border-gray-200" },
};

const VERDICT_CFG: Record<string, { label: string; cls: string; icon: string }> = {
  fair:         { label: "Fair market price",        cls: "text-green-700 bg-green-50",  icon: "✓" },
  below_market: { label: "Below market — good deal", cls: "text-blue-700 bg-blue-50",    icon: "↓" },
  above_market: { label: "Above market — negotiate", cls: "text-red-700 bg-red-50",      icon: "↑" },
  unknown:      { label: "Price verdict unknown",    cls: "text-gray-600 bg-gray-50",    icon: "?" },
};

const EXAMPLES = [
  "Tiffany & Co sterling silver candlestick 1900s",
  "Meissen porcelain figurine 18th century",
  "Louis Vuitton steamer trunk circa 1920",
  "Rolex Submariner ref 5512 1965",
  "Chippendale mahogany highboy 18th century",
  "Weller Louwelsa vase arts and crafts",
];

// ── Search + results component ────────────────────────────────────────────────

function PriceGuideSearch({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [result, setResult] = useState<PriceCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialQuery) runCheck(initialQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runCheck(q: string) {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    router.replace(`/prices?q=${encodeURIComponent(q.trim())}`, { scroll: false });
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
    <div className="space-y-8">
      {/* Search form */}
      <form onSubmit={(e) => { e.preventDefault(); runCheck(query); }} className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-antique-text-mute pointer-events-none" />
          <input
            ref={inputRef}
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

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-3 py-12 justify-center text-antique-text-sec">
          <Loader2 className="w-6 h-6 animate-spin text-antique-accent" />
          <span>
            Analyzing market data for <strong className="text-antique-text">&ldquo;{query}&rdquo;</strong>…
          </span>
        </div>
      )}

      {/* Result card */}
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

          {/* Reasoning */}
          {result.reasoning && (
            <div className="bg-antique-muted/60 rounded-xl p-4 border border-antique-border">
              <p className="text-sm text-antique-text-sec leading-relaxed">{result.reasoning}</p>
            </div>
          )}

          {/* Key value factors */}
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

          {/* Market trend */}
          {result.market_trend_summary && (
            <p className="text-xs text-antique-text-mute italic border-t border-antique-border pt-4">
              {result.market_trend_summary}
            </p>
          )}

          {/* Comparable sales */}
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

          {/* Footer */}
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

// ── Page ──────────────────────────────────────────────────────────────────────

function PriceGuidePageInner() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";

  return (
    <div className="container mx-auto px-4 py-10 max-w-3xl">
      <div className="mb-10">
        <p className="text-antique-accent font-display text-xs tracking-[0.2em] uppercase mb-1">
          AI-Powered
        </p>
        <h1 className="font-display text-3xl font-bold text-antique-text flex items-center gap-3 mb-2">
          <TrendingUp className="w-7 h-7 text-antique-accent" />
          Antique Price Guide
        </h1>
        <p className="text-antique-text-sec">
          Get an instant market value estimate for any antique, collectible, or estate item.
          Powered by Claude with real auction comparable sales.
        </p>
      </div>

      <PriceGuideSearch initialQuery={initialQuery} />

      {/* Market data link */}
      <div className="mt-6 p-4 border border-antique-border rounded-xl bg-antique-surface/60 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-antique-text">Browse Category Price Trends</p>
          <p className="text-xs text-antique-text-mute mt-0.5">
            See median sold prices, 24-month charts, and market trends for every antique category.
          </p>
        </div>
        <Link
          href="/pricing-guide"
          className="shrink-0 text-xs font-semibold text-antique-accent border border-antique-accent px-3 py-1.5 rounded-lg hover:bg-antique-accent hover:text-white transition-colors"
        >
          View Market Data →
        </Link>
      </div>

      {/* Category links */}
      <div className="mt-14">
        <p className="text-xs font-semibold text-antique-text-mute uppercase tracking-wide mb-4">
          Browse prices by category
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.slug}
              href={`/categories/${cat.slug}`}
              className="flex items-center gap-3 p-3 rounded-xl border border-antique-border bg-antique-surface hover:border-antique-accent hover:bg-antique-muted transition-colors group"
            >
              <span className="text-xl">{cat.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-antique-text group-hover:text-antique-accent transition-colors truncate">
                  {cat.shortLabel}
                </p>
                <p className="text-xs text-antique-text-mute truncate">{cat.description.split(" — ")[0]}</p>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-antique-text-mute group-hover:text-antique-accent transition-colors flex-shrink-0" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PricesPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-20 flex justify-center">
        <Loader2 className="w-8 h-8 text-antique-accent animate-spin" />
      </div>
    }>
      <PriceGuidePageInner />
    </Suspense>
  );
}
