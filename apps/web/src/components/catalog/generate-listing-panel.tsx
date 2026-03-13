"use client";

import { useState } from "react";
import { Sparkles, Copy, Check, Loader2, AlertCircle } from "lucide-react";
import type { CatalogItem } from "./catalog-types";
import type { GeneratedListing } from "@/app/api/v1/catalog/generate-listing/route";

type Platform = "ebay" | "etsy" | "facebook" | "hibid";

const PLATFORMS: { id: Platform; label: string; icon: string; description: string }[] = [
  { id: "ebay", label: "eBay", icon: "🛒", description: "Keyword-dense, factual" },
  { id: "etsy", label: "Etsy", icon: "🧵", description: "Artisan, story-driven" },
  { id: "facebook", label: "Facebook", icon: "📘", description: "Casual, local" },
  { id: "hibid", label: "HiBid", icon: "🔨", description: "Auction catalog style" },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 text-xs text-antique-text-sec hover:text-antique-accent transition-colors px-2 py-1 rounded border border-antique-border hover:border-antique-accent"
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

interface Props {
  items: CatalogItem[];
}

export function GenerateListingPanel({ items }: Props) {
  const [selectedItemId, setSelectedItemId] = useState<string>(items[0]?.id ?? "");
  const [platform, setPlatform] = useState<Platform>("ebay");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GeneratedListing | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedItem = items.find((i) => i.id === selectedItemId);

  const handleGenerate = async () => {
    if (!selectedItem) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/v1/catalog/generate-listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item: selectedItem, platform }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? "Failed to generate listing");
      } else {
        setResult(data as GeneratedListing);
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Item selector */}
      {items.length === 0 ? (
        <div className="antique-card p-5 text-center text-antique-text-sec">
          <p className="text-sm">Add items to your catalog first to generate listings.</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            <label className="block text-sm font-medium text-antique-text">
              Select item to list
            </label>
            <select
              value={selectedItemId}
              onChange={(e) => { setSelectedItemId(e.target.value); setResult(null); }}
              className="w-full px-3 py-2 rounded-lg border border-antique-border bg-antique-bg text-antique-text text-sm focus:outline-none focus:ring-2 focus:ring-antique-accent focus:border-transparent"
            >
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title} — {item.category}
                </option>
              ))}
            </select>
          </div>

          {/* Platform tabs */}
          <div>
            <label className="block text-sm font-medium text-antique-text mb-2">
              Target platform
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setPlatform(p.id); setResult(null); }}
                  className={`flex flex-col items-center gap-1 px-3 py-3 rounded-xl border text-center transition-colors ${
                    platform === p.id
                      ? "border-antique-accent bg-antique-accent-s text-antique-accent"
                      : "border-antique-border bg-antique-bg text-antique-text-sec hover:border-antique-accent hover:text-antique-text"
                  }`}
                >
                  <span className="text-xl">{p.icon}</span>
                  <span className="text-xs font-semibold">{p.label}</span>
                  <span className="text-xs opacity-70">{p.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={loading || !selectedItem}
            className="w-full flex items-center justify-center gap-2 bg-antique-accent text-white px-5 py-3 rounded-xl font-semibold text-sm hover:bg-antique-accent-h transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating with AI…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate Listing
              </>
            )}
          </button>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-700 dark:text-red-300">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-antique-accent">
                <Check className="w-4 h-4" />
                Listing generated for{" "}
                {PLATFORMS.find((p) => p.id === platform)?.label}
              </div>

              {/* Title */}
              <div className="antique-card p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-antique-text-sec uppercase tracking-wide">
                    Title
                  </span>
                  <CopyButton text={result.title} />
                </div>
                <p className="text-sm text-antique-text font-medium">{result.title}</p>
                <p className="text-xs text-antique-text-mute">{result.title.length} characters</p>
              </div>

              {/* Price + Condition */}
              <div className="grid grid-cols-2 gap-3">
                <div className="antique-card p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-antique-text-sec uppercase tracking-wide">
                      Suggested Price
                    </span>
                    <CopyButton text={`$${result.price}`} />
                  </div>
                  <p className="text-lg font-bold text-antique-accent">
                    ${result.price.toLocaleString()}
                  </p>
                </div>
                <div className="antique-card p-4 space-y-2">
                  <span className="text-xs font-semibold text-antique-text-sec uppercase tracking-wide block">
                    Condition Label
                  </span>
                  <p className="text-sm text-antique-text">{result.conditionLabel}</p>
                </div>
              </div>

              {/* Tags */}
              {result.tags.length > 0 && (
                <div className="antique-card p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-antique-text-sec uppercase tracking-wide">
                      Tags ({result.tags.length})
                    </span>
                    <CopyButton text={result.tags.join(", ")} />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {result.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs border border-antique-border text-antique-text-sec px-2 py-0.5 rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              <div className="antique-card p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-antique-text-sec uppercase tracking-wide">
                    Description
                  </span>
                  <CopyButton text={result.description} />
                </div>
                <p className="text-sm text-antique-text leading-relaxed whitespace-pre-line">
                  {result.description}
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
