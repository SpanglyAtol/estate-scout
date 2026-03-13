"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Bookmark, Trash2, ExternalLink, Search, Bell, BellOff, Plus } from "lucide-react";
import type { SearchFilters } from "@/types";

interface SavedSearch {
  id: number;
  name: string;
  filters: SearchFilters;
  notify_email: boolean;
  created_at: string;
}

const LS_KEY = "es_saved_searches";

function filtersToUrl(filters: SearchFilters): string {
  const p = new URLSearchParams();
  if (filters.q)              p.set("q",              filters.q);
  if (filters.category)       p.set("category",       filters.category);
  if (filters.sub_category)   p.set("sub_category",   filters.sub_category);
  if (filters.listing_type)   p.set("listing_type",   filters.listing_type);
  if (filters.status)         p.set("status",         filters.status);
  if (filters.min_price)      p.set("min_price",      String(filters.min_price));
  if (filters.max_price)      p.set("max_price",      String(filters.max_price));
  if (filters.maker)          p.set("maker",          filters.maker);
  if (filters.period)         p.set("period",         filters.period);
  if (filters.country_of_origin) p.set("country_of_origin", filters.country_of_origin);
  if (filters.condition)      p.set("condition",      filters.condition);
  if (filters.sort)           p.set("sort",           filters.sort);
  if (filters.ending_hours)   p.set("ending_hours",   String(filters.ending_hours));
  if (filters.pickup_only)    p.set("pickup_only",    "true");
  if (filters.platform_ids?.length)
    filters.platform_ids.forEach((id) => p.append("platform_ids", String(id)));
  return `/search?${p.toString()}`;
}

function humanizeFilter(key: string, value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const labels: Record<string, string> = {
    q: `"${value}"`,
    category: String(value).replace(/_/g, " "),
    sub_category: String(value).replace(/_/g, " "),
    listing_type: String(value).replace(/_/g, " "),
    status: String(value).replace(/_/g, " "),
    min_price: `min $${value}`,
    max_price: `max $${value}`,
    maker: String(value).replace(/_/g, " "),
    period: String(value).replace(/_/g, " "),
    country_of_origin: String(value).replace(/_/g, " "),
    condition: String(value),
    ending_hours: `ends in ${value}h`,
    sort: String(value).replace(/_/g, " "),
    pickup_only: "pickup only",
  };
  return labels[key] ?? null;
}

function FilterTags({ filters }: { filters: SearchFilters }) {
  const tags: string[] = [];
  const skip = new Set(["page", "page_size", "radius_miles", "lat", "lon"]);
  for (const [k, v] of Object.entries(filters)) {
    if (skip.has(k) || !v) continue;
    if (Array.isArray(v)) {
      if (v.length) tags.push(`platforms: ${v.join(", ")}`);
    } else {
      const label = humanizeFilter(k, v);
      if (label) tags.push(label);
    }
  }
  if (tags.length === 0) return <span className="text-xs text-antique-text-mute italic">All listings</span>;
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {tags.map((t) => (
        <span
          key={t}
          className="text-xs px-2 py-0.5 rounded-full bg-antique-accent/10 text-antique-accent border border-antique-accent/20 capitalize"
        >
          {t}
        </span>
      ))}
    </div>
  );
}

export default function SavedSearchesPage() {
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newQ, setNewQ] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY);
    if (stored) {
      try { setSearches(JSON.parse(stored)); } catch { /* ignore */ }
    }
  }, []);

  function save(updated: SavedSearch[]) {
    setSearches(updated);
    localStorage.setItem(LS_KEY, JSON.stringify(updated));
  }

  function remove(id: number) {
    save(searches.filter((s) => s.id !== id));
  }

  function toggleNotify(id: number) {
    save(searches.map((s) => s.id === id ? { ...s, notify_email: !s.notify_email } : s));
  }

  function addNew(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    const ns: SavedSearch = {
      id: Date.now(),
      name: newName.trim(),
      filters: newQ ? { q: newQ.trim() } : {},
      notify_email: false,
      created_at: new Date().toISOString(),
    };
    save([...searches, ns]);
    setNewName("");
    setNewQ("");
    setShowNewForm(false);
  }

  return (
    <div className="container mx-auto px-4 py-10 max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-antique-text flex items-center gap-2">
            <Bookmark className="w-6 h-6 text-antique-accent" />
            Saved Searches
          </h1>
          <p className="text-antique-text-sec text-sm mt-1">
            Re-run your favourite searches in one click. Searches are stored locally in your browser.
          </p>
        </div>
        <button
          onClick={() => setShowNewForm((v) => !v)}
          className="flex items-center gap-1.5 bg-antique-accent text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-antique-accent-h transition-colors"
        >
          <Plus className="w-4 h-4" /> New Search
        </button>
      </div>

      {/* New search form */}
      {showNewForm && (
        <form
          onSubmit={addNew}
          className="bg-antique-surface border border-antique-border rounded-2xl p-5 mb-6 space-y-3"
        >
          <h2 className="font-semibold text-antique-text text-sm">Create saved search</h2>
          <div>
            <label className="text-xs text-antique-text-mute mb-1 block">Name *</label>
            <input
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder='e.g. "Victorian silver under $500"'
              className="w-full border border-antique-border bg-antique-bg text-antique-text rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-antique-accent focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-antique-text-mute mb-1 block">Search query (optional)</label>
            <input
              value={newQ}
              onChange={(e) => setNewQ(e.target.value)}
              placeholder="e.g. rolex watch"
              className="w-full border border-antique-border bg-antique-bg text-antique-text rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-antique-accent focus:border-transparent outline-none"
            />
          </div>
          <p className="text-xs text-antique-text-mute">
            Tip: Apply your filters on the{" "}
            <Link href="/search" className="text-antique-accent hover:underline">search page</Link>
            {" "}then use the{" "}
            <strong>Save</strong> button in the results header to save your exact filter combination.
          </p>
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              className="bg-antique-accent text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-antique-accent-h transition-colors"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setShowNewForm(false)}
              className="border border-antique-border text-antique-text-sec px-5 py-2 rounded-lg text-sm hover:border-antique-accent hover:text-antique-accent transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {searches.length === 0 ? (
        <div className="text-center py-20 bg-antique-surface border border-antique-border rounded-2xl">
          <Search className="w-12 h-12 text-antique-text-mute mx-auto mb-4 opacity-50" />
          <h2 className="font-display text-lg text-antique-text mb-2">No saved searches yet</h2>
          <p className="text-antique-text-sec text-sm mb-6 max-w-xs mx-auto">
            Search for antiques, apply filters, then hit the{" "}
            <strong>Save</strong> button to bookmark your search here.
          </p>
          <Link
            href="/search"
            className="inline-flex items-center gap-2 bg-antique-accent text-white px-5 py-2.5 rounded-xl hover:bg-antique-accent-h transition-colors font-medium text-sm"
          >
            <Search className="w-4 h-4" /> Start searching
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {searches.map((s) => (
            <div
              key={s.id}
              className="bg-antique-surface border border-antique-border rounded-2xl p-5 flex flex-col sm:flex-row sm:items-start gap-4 hover:border-antique-accent/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-antique-text">{s.name}</p>
                <FilterTags filters={s.filters} />
                <p className="text-xs text-antique-text-mute mt-2">
                  Saved {new Date(s.created_at).toLocaleDateString("en-US", {
                    month: "short", day: "numeric", year: "numeric",
                  })}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => toggleNotify(s.id)}
                  title={s.notify_email ? "Disable email alerts" : "Enable email alerts"}
                  className={`p-2 rounded-lg border transition-colors ${
                    s.notify_email
                      ? "bg-antique-accent/10 border-antique-accent/30 text-antique-accent"
                      : "border-antique-border text-antique-text-mute hover:border-antique-accent hover:text-antique-accent"
                  }`}
                >
                  {s.notify_email ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                </button>
                <Link
                  href={filtersToUrl(s.filters)}
                  className="flex items-center gap-1.5 bg-antique-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-antique-accent-h transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Run
                </Link>
                <button
                  onClick={() => remove(s.id)}
                  title="Delete saved search"
                  className="p-2 rounded-lg border border-antique-border text-antique-text-mute hover:border-red-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
