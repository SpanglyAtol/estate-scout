"use client";

import { useState } from "react";
import { Sparkles, Loader2, X, TrendingUp } from "lucide-react";
import { type CatalogItem } from "./catalog-types";

interface Props {
  item: CatalogItem;
  onUpdated: (item: CatalogItem) => void;
  onClose: () => void;
}

export function AiAnalysisPanel({ item, onUpdated, onClose }: Props) {
  const [query, setQuery] = useState(
    item.title + (item.description ? `. ${item.description.slice(0, 120)}` : "")
  );
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const analysis = item.aiAnalysis;

  async function runAnalysis() {
    if (!query.trim() || loading) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/v1/valuation/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query_text: query }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const patch: Partial<CatalogItem> = {
        lastAnalyzed: new Date().toISOString(),
        aiAnalysis: {
          narrative: data.narrative ?? "",
          priceLow:  data.price_range?.low  ?? null,
          priceMid:  data.price_range?.mid  ?? null,
          priceHigh: data.price_range?.high ?? null,
          priceCount: data.price_range?.count ?? 0,
          queriedWith: query,
        },
      };

      onUpdated({ ...item, ...patch });
    } catch {
      setError("Analysis failed — please try again.");
    }

    setLoading(false);
  }

  const fmt = (n: number | null) =>
    n != null ? `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-antique-surface border border-antique-border rounded-xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-antique-border">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-antique-accent" />
            <h2 className="font-display text-lg font-bold text-antique-text">AI Analysis</h2>
          </div>
          <button onClick={onClose} className="p-1 text-antique-text-mute hover:text-antique-text transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <p className="text-xs font-semibold text-antique-text-sec uppercase tracking-wide mb-1.5">
              Item: {item.title}
            </p>
          </div>

          {/* Query field */}
          <div>
            <label className="block text-xs font-semibold text-antique-text-sec uppercase tracking-wide mb-1.5">
              Query for AI
            </label>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              rows={3}
              placeholder="Describe your item for pricing or identification…"
              className="w-full border border-antique-border rounded-lg px-3 py-2.5 text-sm bg-antique-bg text-antique-text placeholder:text-antique-text-mute focus:outline-none focus:border-antique-accent transition-colors resize-none"
            />
            <p className="text-xs text-antique-text-mute mt-1">
              You can ask: &ldquo;How much is this worth?&rdquo;, &ldquo;Identify this piece&rdquo;, &ldquo;What is the history of this maker?&rdquo;
            </p>
          </div>

          <button
            onClick={runAnalysis}
            disabled={!query.trim() || loading}
            className="w-full flex items-center justify-center gap-2 bg-antique-accent hover:bg-antique-accent-h disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Analysing…</>
            ) : (
              <><Sparkles className="w-4 h-4" /> Get AI Analysis</>
            )}
          </button>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {/* Results */}
          {analysis && (
            <div className="space-y-4 pt-1">
              {/* Price range */}
              {(analysis.priceMid != null) && (
                <div className="antique-card p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-4 h-4 text-antique-accent" />
                    <p className="text-xs font-semibold text-antique-text-sec uppercase tracking-wide">
                      Estimated Value
                    </p>
                    {analysis.priceCount > 0 && (
                      <span className="ml-auto text-xs text-antique-text-mute">
                        based on {analysis.priceCount} sales
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <div className="text-sm text-antique-text-mute">Low</div>
                      <div className="font-display text-lg font-bold text-antique-text">{fmt(analysis.priceLow)}</div>
                    </div>
                    <div className="border-x border-antique-border">
                      <div className="text-sm text-antique-accent">Median</div>
                      <div className="font-display text-2xl font-bold text-antique-accent">{fmt(analysis.priceMid)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-antique-text-mute">High</div>
                      <div className="font-display text-lg font-bold text-antique-text">{fmt(analysis.priceHigh)}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Narrative */}
              {analysis.narrative && (
                <div className="antique-card-warm p-4 rounded-xl">
                  <p className="text-xs font-semibold text-antique-text-sec uppercase tracking-wide mb-2">
                    AI Assessment
                  </p>
                  <p className="text-sm text-antique-text leading-relaxed">{analysis.narrative}</p>
                </div>
              )}

              {item.lastAnalyzed && (
                <p className="text-xs text-antique-text-mute">
                  Last analysed {new Date(item.lastAnalyzed).toLocaleDateString()}
                  {" "}·{" "}
                  <a href="/valuation" className="text-antique-accent hover:underline">Open full Price Check →</a>
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
