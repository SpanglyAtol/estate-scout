"use client";

/**
 * Antique Price Library — /library
 *
 * A browsable reference for antique price ranges — no active sale required.
 * Users can explore by category or search any item description to get an
 * AI-backed price estimate from our database of completed auction sales.
 */

import { useState } from "react";
import { Search, Loader2, ChevronRight } from "lucide-react";
import { getValuation } from "@/lib/api-client";
import { CompGrid } from "@/components/valuation/comp-grid";
import type { ValuationResult } from "@/types";

// ── Category definitions ──────────────────────────────────────────────────────

const CATEGORIES = [
  {
    name: "Ceramics & Porcelain",
    emoji: "🏺",
    blurb: "Meissen, Limoges, Wedgwood, majolica, stoneware",
    query: "antique porcelain ceramic vase figurine",
    exampleRange: "$50 – $8,000",
  },
  {
    name: "Silver & Metalware",
    emoji: "🥄",
    blurb: "Sterling flatware, candlesticks, tea services, pewter",
    query: "sterling silver antique flatware tea service",
    exampleRange: "$80 – $12,000",
  },
  {
    name: "Furniture",
    emoji: "🪑",
    blurb: "Victorian, Arts & Crafts, mid-century, Chippendale",
    query: "antique furniture Victorian mahogany chest dresser",
    exampleRange: "$200 – $25,000",
  },
  {
    name: "Art & Paintings",
    emoji: "🖼",
    blurb: "Oil paintings, watercolors, prints, folk art",
    query: "antique oil painting signed original art",
    exampleRange: "$100 – $50,000",
  },
  {
    name: "Jewelry & Watches",
    emoji: "💎",
    blurb: "Estate jewelry, gold, gems, vintage timepieces",
    query: "antique estate jewelry gold gemstone ring brooch",
    exampleRange: "$75 – $30,000",
  },
  {
    name: "Books & Manuscripts",
    emoji: "📚",
    blurb: "First editions, illustrated books, maps, ephemera",
    query: "antique book first edition manuscript map",
    exampleRange: "$20 – $5,000",
  },
  {
    name: "Rugs & Textiles",
    emoji: "🧵",
    blurb: "Persian rugs, Navajo blankets, tapestries, quilts",
    query: "antique Persian oriental rug carpet handwoven",
    exampleRange: "$150 – $15,000",
  },
  {
    name: "Glass & Crystal",
    emoji: "🔮",
    blurb: "Tiffany, Murano, Lalique, Depression glass, art glass",
    query: "antique glass crystal art glass Tiffany Lalique",
    exampleRange: "$30 – $10,000",
  },
  {
    name: "Clocks & Instruments",
    emoji: "⏰",
    blurb: "Mantel clocks, pocket watches, scientific instruments",
    query: "antique clock mantel grandfather pocket watch",
    exampleRange: "$100 – $8,000",
  },
  {
    name: "Coins & Stamps",
    emoji: "🪙",
    blurb: "US coins, world coins, rare stamps, currency",
    query: "antique coin rare stamp currency collectible",
    exampleRange: "$10 – $20,000",
  },
  {
    name: "Toys & Collectibles",
    emoji: "🪆",
    blurb: "Cast iron banks, tin toys, dolls, advertising",
    query: "antique toy cast iron bank tin toy collectible doll",
    exampleRange: "$25 – $5,000",
  },
  {
    name: "Silver & Gold Coins",
    emoji: "🏅",
    blurb: "Bullion, pre-1933 gold, Morgan dollars, trade coins",
    query: "silver gold coin Morgan dollar pre-1933 bullion",
    exampleRange: "$25 – $50,000",
  },
] as const;

type Category = (typeof CATEGORIES)[number];

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LibraryPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ValuationResult | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runSearch(q: string, category?: Category) {
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

  function handleCategoryClick(cat: Category) {
    setQuery(cat.query);
    runSearch(cat.query, cat);
    // Smooth-scroll to results
    setTimeout(() => {
      document.getElementById("library-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }

  return (
    <div className="container mx-auto px-4 py-10 max-w-6xl space-y-12">
      {/* ── Hero ── */}
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <p className="text-xs font-semibold uppercase tracking-widest text-antique-accent">
          Reference Library
        </p>
        <h1 className="text-4xl font-bold text-antique-text font-display leading-tight">
          Antique Price Guide
        </h1>
        <p className="text-antique-text-sec">
          Explore what antiques actually sell for — backed by real completed auction results.
          No active listing needed.
        </p>

        {/* Search bar */}
        <form onSubmit={handleSubmit} className="flex gap-2 mt-6">
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
      </div>

      {/* ── Results ── */}
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
            <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 px-5 py-4 text-sm text-red-700 dark:text-red-400">
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

      {/* ── Category grid ── */}
      <div>
        <h2 className="text-xl font-bold text-antique-text font-display mb-5">Browse by Category</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.name}
              onClick={() => handleCategoryClick(cat)}
              disabled={loading}
              className={[
                "text-left p-4 rounded-2xl border transition-all group",
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

      {/* ── How it works ── */}
      <div className="bg-antique-muted border border-antique-border rounded-2xl p-6 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
        {[
          {
            icon: "🔍",
            title: "Real auction data",
            body: "Price ranges are built from completed auction results — what items actually sold for, not asking prices.",
          },
          {
            icon: "🤖",
            title: "AI-backed analysis",
            body: "Our model finds the closest matches to your item description and explains why it's confident or uncertain.",
          },
          {
            icon: "📅",
            title: "No sale needed",
            body: "Use the Library anytime to research before you buy, sell, or insure — even when nothing is currently for sale.",
          },
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
