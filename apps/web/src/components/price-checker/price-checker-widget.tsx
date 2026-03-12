"use client";

import { useState } from "react";
import type { Listing } from "@/types";

// ── Types ────────────────────────────────────────────────────────────────────

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

interface Props {
  listing: Listing;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const CONFIDENCE_LABEL: Record<string, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
  insufficient_data: "Insufficient data",
};

const CONFIDENCE_COLOR: Record<string, string> = {
  high: "text-green-700 bg-green-50 border-green-200",
  medium: "text-amber-700 bg-amber-50 border-amber-200",
  low: "text-orange-700 bg-orange-50 border-orange-200",
  insufficient_data: "text-gray-500 bg-gray-50 border-gray-200",
};

const VERDICT_CONFIG: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  fair: {
    label: "Fair price",
    color: "text-green-700 bg-green-50",
    icon: "✓",
  },
  below_market: {
    label: "Below market — good deal",
    color: "text-blue-700 bg-blue-50",
    icon: "↓",
  },
  above_market: {
    label: "Above market — negotiate",
    color: "text-red-700 bg-red-50",
    icon: "↑",
  },
  unknown: {
    label: "Verdict unknown",
    color: "text-gray-600 bg-gray-50",
    icon: "?",
  },
};

// ── Component ─────────────────────────────────────────────────────────────────

export function PriceCheckerWidget({ listing }: Props) {
  const [result, setResult] = useState<PriceCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const askingPrice =
    listing.current_price ?? listing.buy_now_price ?? listing.final_price;

  async function runCheck() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/v1/price-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: listing.title,
          description: listing.description,
          category: listing.category,
          maker: listing.maker,
          brand: listing.brand,
          period: listing.period,
          country_of_origin: listing.country_of_origin,
          condition: listing.condition,
          asking_price: askingPrice,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="border border-[--antique-accent]/30 rounded-lg bg-[--antique-ivory]/60 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-serif text-lg font-semibold text-[--antique-dark]">
            AI Price Check
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Powered by Claude Opus — expert antique market analysis
          </p>
        </div>
        {!result && (
          <button
            onClick={runCheck}
            disabled={loading}
            className="px-4 py-2 rounded-md text-sm font-medium bg-[--antique-accent] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Analyzing…
              </span>
            ) : (
              "Check Price"
            )}
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
          {error}
        </p>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-5">
          {/* Price range */}
          <div className="flex flex-wrap gap-4 items-end">
            {result.estimated_median ? (
              <>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                    Estimated Value
                  </p>
                  <p className="text-2xl font-bold text-[--antique-dark]">
                    {fmt(result.estimated_median)}
                  </p>
                  {result.estimated_low && result.estimated_high && (
                    <p className="text-sm text-gray-500">
                      Range: {fmt(result.estimated_low)} – {fmt(result.estimated_high)}
                    </p>
                  )}
                </div>
                {askingPrice && result.asking_price_verdict && result.asking_price_verdict !== "unknown" && (
                  <div
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
                      VERDICT_CONFIG[result.asking_price_verdict].color
                    }`}
                  >
                    <span className="text-lg leading-none">
                      {VERDICT_CONFIG[result.asking_price_verdict].icon}
                    </span>
                    {VERDICT_CONFIG[result.asking_price_verdict].label}
                    {result.asking_price_delta_pct !== null && (
                      <span className="text-xs opacity-75">
                        ({result.asking_price_delta_pct > 0 ? "+" : ""}
                        {result.asking_price_delta_pct.toFixed(0)}%)
                      </span>
                    )}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-500 italic">
                No estimate available — insufficient data for this item.
              </p>
            )}

            {/* Confidence badge */}
            <span
              className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
                CONFIDENCE_COLOR[result.confidence]
              }`}
            >
              {CONFIDENCE_LABEL[result.confidence]}
              {result.data_points_used > 0 && (
                <span className="opacity-70"> · {result.data_points_used} data points</span>
              )}
            </span>
          </div>

          {/* Reasoning */}
          {result.reasoning && (
            <div className="bg-white/70 rounded-md p-4 border border-gray-100">
              <p className="text-sm text-gray-700 leading-relaxed">{result.reasoning}</p>
            </div>
          )}

          {/* Key value factors */}
          {result.key_value_factors.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Key Value Factors
              </p>
              <ul className="space-y-1">
                {result.key_value_factors.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-[--antique-accent] mt-0.5 shrink-0">›</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Market trend */}
          {result.market_trend_summary && (
            <p className="text-xs text-gray-500 italic border-t pt-3">
              {result.market_trend_summary}
            </p>
          )}

          {/* Comparable sales */}
          {result.comparable_sales.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Comparable Sales
              </p>
              <div className="divide-y divide-gray-100">
                {result.comparable_sales.slice(0, 5).map((c, i) => (
                  <div key={i} className="py-2 flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 truncate">{c.title}</p>
                      <p className="text-xs text-gray-400">
                        {c.platform}{c.sale_date ? ` · ${c.sale_date.slice(0, 10)}` : ""}
                        {c.condition ? ` · ${c.condition}` : ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      {c.url ? (
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-[--antique-accent] hover:underline"
                        >
                          {fmt(c.price)}
                        </a>
                      ) : (
                        <span className="text-sm font-medium text-gray-700">
                          {fmt(c.price)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Re-run button */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              {result.cached ? "Cached result" : "Fresh analysis"} ·{" "}
              {result.data_source === "claude_with_market_data"
                ? "AI + market database"
                : result.data_source === "claude_no_data"
                ? "AI estimate (no market data)"
                : "Statistical estimate"}
            </p>
            <button
              onClick={runCheck}
              disabled={loading}
              className="text-xs text-[--antique-accent] hover:underline disabled:opacity-50"
            >
              {loading ? "Analyzing…" : "Re-run"}
            </button>
          </div>
        </div>
      )}

      {/* Pre-check state */}
      {!result && !loading && !error && (
        <div className="text-sm text-gray-500 space-y-1">
          <p>Get an AI-powered market value estimate and verdict on this asking price.</p>
          {askingPrice && (
            <p>
              Asking price:{" "}
              <strong className="text-[--antique-dark]">{fmt(askingPrice)}</strong>
            </p>
          )}
        </div>
      )}
    </section>
  );
}
