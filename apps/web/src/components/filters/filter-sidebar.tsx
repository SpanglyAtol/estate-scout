"use client";

import { useState } from "react";
import { SlidersHorizontal, X, ChevronDown, ChevronUp } from "lucide-react";
import type { SearchFilters } from "@/types";

const CATEGORIES = [
  "ceramics",
  "furniture",
  "jewelry",
  "art",
  "silver",
  "glass",
  "collectibles",
  "books",
  "clothing",
  "tools",
  "electronics",
  "toys",
];

const PLATFORMS = [
  { id: 1, label: "LiveAuctioneers" },
  { id: 2, label: "EstateSales.NET" },
  { id: 3, label: "HiBid" },
  { id: 4, label: "MaxSold" },
  { id: 5, label: "BidSpotter" },
];

const RADIUS_OPTIONS = [10, 25, 50, 100, 250];

interface FilterSidebarProps {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border-b border-antique-border pb-4 mb-4 last:border-0 last:mb-0 last:pb-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full text-sm font-semibold text-antique-text mb-3"
      >
        {title}
        {open ? (
          <ChevronUp className="w-4 h-4 text-antique-text-mute" />
        ) : (
          <ChevronDown className="w-4 h-4 text-antique-text-mute" />
        )}
      </button>
      {open && children}
    </div>
  );
}

export function FilterSidebar({ filters, onChange }: FilterSidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const activeFilterCount = [
    filters.category,
    filters.pickup_only,
    filters.ending_hours,
    filters.min_price,
    filters.max_price,
    filters.platform_ids?.length,
    filters.status,
    filters.listing_type,
    filters.radius_miles && filters.radius_miles !== 50 ? filters.radius_miles : null,
  ].filter(Boolean).length;

  function update(patch: Partial<SearchFilters>) {
    onChange({ ...filters, ...patch, page: 1 });
  }

  function clearAll() {
    onChange({ page: 1, page_size: filters.page_size, q: filters.q });
  }

  const content = (
    <div className="space-y-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-bold text-antique-text">Filters</h2>
        {activeFilterCount > 0 && (
          <button
            onClick={clearAll}
            className="text-xs text-antique-accent hover:text-antique-accent-h font-medium"
          >
            Clear all ({activeFilterCount})
          </button>
        )}
      </div>

      {/* Listing Type */}
      <Section title="Listing Type">
        <div className="space-y-1.5">
          {[
            { label: "All types",                 value: undefined       },
            { label: "Auctions (online bidding)", value: "auction"       },
            { label: "Estate Sales (in-person)",  value: "estate_sale"   },
            { label: "Buy Now (fixed price)",      value: "buy_now"       },
          ].map((opt) => (
            <label key={opt.label} className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="radio"
                name="listing_type"
                checked={(filters.listing_type ?? undefined) === opt.value}
                onChange={() => update({ listing_type: opt.value as SearchFilters["listing_type"] })}
                className="w-4 h-4"
              />
              <span className="text-sm text-antique-text-sec group-hover:text-antique-accent transition-colors">
                {opt.label}
              </span>
            </label>
          ))}
        </div>
      </Section>

      {/* Status */}
      <Section title="Status">
        <div className="space-y-1.5">
          {[
            { label: "All listings", value: undefined },
            { label: "Upcoming", value: "upcoming" },
            { label: "Live now", value: "live" },
            { label: "Ending soon", value: "ending_soon" },
            { label: "Ended", value: "ended" },
          ].map((opt) => (
            <label key={opt.label} className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="radio"
                name="status"
                checked={(filters.status ?? undefined) === opt.value}
                onChange={() => update({ status: opt.value })}
                className="w-4 h-4"
              />
              <span className="text-sm text-antique-text-sec group-hover:text-antique-accent transition-colors">
                {opt.label}
              </span>
            </label>
          ))}
        </div>
      </Section>

      {/* Category */}
      <Section title="Category">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => update({ category: filters.category === cat ? undefined : cat })}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors capitalize ${
                filters.category === cat
                  ? "bg-antique-accent text-white border-antique-accent"
                  : "bg-antique-surface text-antique-text-sec border-antique-border hover:border-antique-accent"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </Section>

      {/* Price range */}
      <Section title="Price Range">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <label className="text-xs text-antique-text-mute mb-1 block">Min ($)</label>
            <input
              type="number"
              min={0}
              placeholder="0"
              value={filters.min_price ?? ""}
              onChange={(e) =>
                update({ min_price: e.target.value ? Number(e.target.value) : undefined })
              }
              className="w-full border border-antique-border bg-antique-surface text-antique-text rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-antique-accent focus:border-transparent outline-none"
            />
          </div>
          <span className="text-antique-text-mute mt-5">—</span>
          <div className="flex-1">
            <label className="text-xs text-antique-text-mute mb-1 block">Max ($)</label>
            <input
              type="number"
              min={0}
              placeholder="Any"
              value={filters.max_price ?? ""}
              onChange={(e) =>
                update({ max_price: e.target.value ? Number(e.target.value) : undefined })
              }
              className="w-full border border-antique-border bg-antique-surface text-antique-text rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-antique-accent focus:border-transparent outline-none"
            />
          </div>
        </div>
      </Section>

      {/* Location radius */}
      <Section title="Search Radius">
        <div className="flex flex-wrap gap-2">
          {RADIUS_OPTIONS.map((miles) => (
            <button
              key={miles}
              onClick={() => update({ radius_miles: miles })}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                (filters.radius_miles ?? 50) === miles
                  ? "bg-antique-accent text-white border-antique-accent"
                  : "bg-antique-surface text-antique-text-sec border-antique-border hover:border-antique-accent"
              }`}
            >
              {miles} mi
            </button>
          ))}
        </div>
        <p className="text-xs text-antique-text-mute mt-2">Location required for radius filtering</p>
      </Section>

      {/* Ending time */}
      <Section title="Ending">
        <div className="space-y-1.5">
          {[
            { label: "Any time", value: undefined },
            { label: "Ending in 2 hours", value: 2 },
            { label: "Ending today", value: 24 },
            { label: "Ending in 3 days", value: 72 },
            { label: "Ending this week", value: 168 },
          ].map((opt) => (
            <label key={opt.label} className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="radio"
                name="ending_hours"
                checked={(filters.ending_hours ?? undefined) === opt.value}
                onChange={() => update({ ending_hours: opt.value })}
                className="w-4 h-4"
              />
              <span className="text-sm text-antique-text-sec group-hover:text-antique-accent transition-colors">
                {opt.label}
              </span>
            </label>
          ))}
        </div>
      </Section>

      {/* Pickup / shipping */}
      <Section title="Delivery">
        <label className="flex items-center gap-2.5 cursor-pointer group">
          <input
            type="checkbox"
            checked={filters.pickup_only ?? false}
            onChange={(e) => update({ pickup_only: e.target.checked || undefined })}
            className="w-4 h-4"
          />
          <span className="text-sm text-antique-text-sec group-hover:text-antique-accent transition-colors">
            Pickup only (no shipping)
          </span>
        </label>
      </Section>

      {/* Platforms */}
      <Section title="Platform">
        <div className="space-y-1.5">
          {PLATFORMS.map((p) => {
            const selected = filters.platform_ids?.includes(p.id) ?? false;
            return (
              <label key={p.id} className="flex items-center gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={(e) => {
                    const current = filters.platform_ids ?? [];
                    const next = e.target.checked
                      ? [...current, p.id]
                      : current.filter((id) => id !== p.id);
                    update({ platform_ids: next.length ? next : undefined });
                  }}
                  className="accent-blue-600"
                />
                <span className="text-sm text-gray-700 group-hover:text-blue-600 transition-colors">
                  {p.label}
                </span>
              </label>
            );
          })}
        </div>
      </Section>
    </div>
  );

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden flex items-center gap-2 bg-antique-surface border border-antique-border rounded-xl px-4 py-2.5 text-sm font-medium text-antique-text hover:border-antique-accent transition-colors"
      >
        <SlidersHorizontal className="w-4 h-4" />
        Filters
        {activeFilterCount > 0 && (
          <span className="bg-antique-accent text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {activeFilterCount}
          </span>
        )}
      </button>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer */}
          <div className="relative ml-auto w-80 max-w-full h-full bg-antique-surface shadow-2xl overflow-y-auto p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-antique-text">Filters</h2>
              <button onClick={() => setMobileOpen(false)}>
                <X className="w-5 h-5 text-antique-text-mute" />
              </button>
            </div>
            {content}
            <button
              onClick={() => setMobileOpen(false)}
              className="mt-6 w-full bg-antique-accent text-white py-3 rounded-xl font-semibold hover:bg-antique-accent-h transition-colors"
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-56 flex-shrink-0">
        <div className="bg-antique-surface border border-antique-border rounded-2xl p-5 sticky top-4">
          {content}
        </div>
      </aside>
    </>
  );
}
