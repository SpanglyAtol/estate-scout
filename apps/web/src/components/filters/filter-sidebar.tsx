"use client";

import { useState, useId } from "react";
import { SlidersHorizontal, X, ChevronDown, ChevronUp, Search } from "lucide-react";
import type { SearchFilters } from "@/types";
import {
  CATEGORIES,
  CATEGORY_MAP,
  PERIODS,
  COUNTRIES,
  CONDITIONS,
} from "@/lib/category-meta";
import { cn } from "@/lib/cn";

const PLATFORMS = [
  { id: 1, label: "LiveAuctioneers" },
  { id: 2, label: "EstateSales.NET" },
  { id: 3, label: "HiBid" },
  { id: 4, label: "MaxSold" },
  { id: 5, label: "BidSpotter" },
];

const RADIUS_OPTIONS = [10, 25, 50, 100, 250];

// Categories where period/era filter is meaningful
const PERIOD_CATEGORIES = new Set([
  "jewelry", "art", "ceramics", "silver", "furniture", "glass",
  "collectibles", "watches", "books", "clothing",
]);

// Categories where country of origin is meaningful
const COUNTRY_CATEGORIES = new Set([
  "jewelry", "art", "ceramics", "silver", "furniture", "glass", "watches",
]);

interface FilterSidebarProps {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
}

// ── Collapsible section ───────────────────────────────────────────────────────

function Section({
  title,
  children,
  defaultOpen = true,
  badge,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-antique-border pb-4 mb-4 last:border-0 last:mb-0 last:pb-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full text-sm font-semibold text-antique-text mb-3"
      >
        <span className="flex items-center gap-2">
          {title}
          {badge && (
            <span className="text-[10px] bg-antique-accent text-white rounded-full px-1.5 py-0.5 font-bold">
              {badge}
            </span>
          )}
        </span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-antique-text-mute flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-antique-text-mute flex-shrink-0" />
        )}
      </button>
      {open && children}
    </div>
  );
}

// ── Radio group ───────────────────────────────────────────────────────────────

function RadioGroup<T extends string | number | undefined>({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: T;
  options: { label: string; value: T }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-1.5">
      {options.map((opt) => (
        <label key={String(opt.value ?? "__all__")} className="flex items-center gap-2.5 cursor-pointer group">
          <input
            type="radio"
            name={name}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            className="w-4 h-4 accent-[var(--antique-accent,#8B6914)]"
          />
          <span className="text-sm text-antique-text-sec group-hover:text-antique-accent transition-colors">
            {opt.label}
          </span>
        </label>
      ))}
    </div>
  );
}

// ── PillGroup ─────────────────────────────────────────────────────────────────

function PillGroup({
  options,
  value,
  onChange,
}: {
  options: { slug: string; label: string }[];
  value: string | undefined;
  onChange: (slug: string | undefined) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.slug}
          onClick={() => onChange(value === opt.slug ? undefined : opt.slug)}
          className={cn(
            "text-xs px-3 py-1.5 rounded-full border transition-colors",
            value === opt.slug
              ? "bg-antique-accent text-white border-antique-accent"
              : "bg-antique-surface text-antique-text-sec border-antique-border hover:border-antique-accent hover:text-antique-accent"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── The sidebar ───────────────────────────────────────────────────────────────

export function FilterSidebar({ filters, onChange }: FilterSidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [makerInput, setMakerInput] = useState(filters.maker ?? "");
  const uid = useId();

  const selectedCategoryMeta = filters.category ? CATEGORY_MAP[filters.category] : null;

  const activeFilterCount = [
    filters.category,
    filters.sub_category,
    filters.pickup_only,
    filters.ending_hours,
    filters.min_price,
    filters.max_price,
    filters.platform_ids?.length,
    filters.status,
    filters.listing_type,
    filters.period,
    filters.country_of_origin,
    filters.condition,
    filters.maker,
    filters.radius_miles && filters.radius_miles !== 50 ? filters.radius_miles : null,
  ].filter(Boolean).length;

  function update(patch: Partial<SearchFilters>) {
    onChange({ ...filters, ...patch, page: 1 });
  }

  function clearAll() {
    setMakerInput("");
    onChange({ page: 1, page_size: filters.page_size, q: filters.q });
  }

  function commitMaker() {
    const val = makerInput.trim().toLowerCase().replace(/\s+/g, "_");
    update({ maker: val || undefined });
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

      {/* ── LISTING TYPE ─────────────────────────────────────────────────────── */}
      <Section title="Listing Type">
        <RadioGroup
          name={`${uid}-listing_type`}
          value={filters.listing_type ?? (undefined as undefined)}
          options={[
            { label: "All types",                 value: undefined as undefined },
            { label: "Auctions (online bidding)", value: "auction" as const },
            { label: "Estate Sales (in-person)",  value: "estate_sale" as const },
            { label: "Buy Now (fixed price)",     value: "buy_now" as const },
          ]}
          onChange={(v) => update({ listing_type: v })}
        />
      </Section>

      {/* ── STATUS ───────────────────────────────────────────────────────────── */}
      <Section title="Status">
        <RadioGroup
          name={`${uid}-status`}
          value={filters.status ?? (undefined as undefined)}
          options={[
            { label: "All listings", value: undefined as undefined },
            { label: "Upcoming",     value: "upcoming" },
            { label: "Live now",     value: "live" },
            { label: "Ending soon",  value: "ending_soon" },
            { label: "Ended",        value: "ended" },
          ]}
          onChange={(v) => update({ status: v })}
        />
      </Section>

      {/* ── CATEGORY ─────────────────────────────────────────────────────────── */}
      <Section title="Category">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.slug}
              onClick={() =>
                update({
                  category:      filters.category === cat.slug ? undefined : cat.slug,
                  sub_category:  undefined,
                  period:        undefined,
                })
              }
              className={cn(
                "text-xs px-3 py-1.5 rounded-full border transition-colors",
                filters.category === cat.slug
                  ? "bg-antique-accent text-white border-antique-accent"
                  : "bg-antique-surface text-antique-text-sec border-antique-border hover:border-antique-accent hover:text-antique-accent"
              )}
              title={cat.description}
            >
              {cat.icon} {cat.shortLabel}
            </button>
          ))}
        </div>
      </Section>

      {/* ── SUBCATEGORY — adaptive ────────────────────────────────────────────── */}
      {selectedCategoryMeta && selectedCategoryMeta.subcategories.length > 0 && (
        <Section title={`${selectedCategoryMeta.shortLabel} Type`} badge="New">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => update({ sub_category: undefined })}
              className={cn(
                "text-xs px-3 py-1.5 rounded-full border transition-colors",
                !filters.sub_category
                  ? "bg-antique-accent text-white border-antique-accent"
                  : "bg-antique-surface text-antique-text-sec border-antique-border hover:border-antique-accent hover:text-antique-accent"
              )}
            >
              All
            </button>
            {selectedCategoryMeta.subcategories.map((sc) => (
              <button
                key={sc.slug}
                onClick={() =>
                  update({ sub_category: filters.sub_category === sc.slug ? undefined : sc.slug })
                }
                className={cn(
                  "text-xs px-3 py-1.5 rounded-full border transition-colors",
                  filters.sub_category === sc.slug
                    ? "bg-antique-accent text-white border-antique-accent"
                    : "bg-antique-surface text-antique-text-sec border-antique-border hover:border-antique-accent hover:text-antique-accent"
                )}
              >
                {sc.label}
              </button>
            ))}
          </div>
        </Section>
      )}

      {/* ── CATEGORY-SPECIFIC ATTRIBUTE FILTERS ──────────────────────────────── */}
      {selectedCategoryMeta?.attributeFilters?.map((af) => (
        <Section key={af.key} title={af.label} defaultOpen={false}>
          {af.type === "select" ? (
            <PillGroup
              options={af.options.map((o) => ({ slug: o.value, label: o.label }))}
              value={(filters as Record<string, unknown>)[`attr_${af.key}`] as string | undefined}
              onChange={(v) =>
                update({ [`attr_${af.key}`]: v } as Partial<SearchFilters>)
              }
            />
          ) : (
            <div className="space-y-1.5">
              {af.options.map((opt) => {
                const currentAttr = (filters as Record<string, unknown>)[`attr_${af.key}`] as string | undefined;
                return (
                  <label key={opt.value} className="flex items-center gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={currentAttr === opt.value}
                      onChange={(e) =>
                        update({ [`attr_${af.key}`]: e.target.checked ? opt.value : undefined } as Partial<SearchFilters>)
                      }
                      className="w-4 h-4 accent-[var(--antique-accent,#8B6914)]"
                    />
                    <span className="text-sm text-antique-text-sec group-hover:text-antique-accent transition-colors">
                      {opt.label}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </Section>
      ))}

      {/* ── PERIOD / ERA ─────────────────────────────────────────────────────── */}
      {(!filters.category || PERIOD_CATEGORIES.has(filters.category)) && (
        <Section title="Period / Era" defaultOpen={false}>
          <PillGroup
            options={PERIODS}
            value={filters.period}
            onChange={(v) => update({ period: v })}
          />
        </Section>
      )}

      {/* ── MAKER / BRAND ────────────────────────────────────────────────────── */}
      <Section title="Maker / Brand" defaultOpen={false}>
        <form onSubmit={(e) => { e.preventDefault(); commitMaker(); }} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-antique-text-mute pointer-events-none" />
            <input
              type="text"
              placeholder={
                selectedCategoryMeta
                  ? (
                      {
                        watches:   "Rolex, Omega, Hamilton…",
                        jewelry:   "Cartier, Tiffany, Gorham…",
                        ceramics:  "Wedgwood, Meissen, Rookwood…",
                        silver:    "Gorham, Tiffany, Reed & Barton…",
                        furniture: "Stickley, Heywood-Wakefield…",
                        art:       "Artist surname…",
                      } as Record<string, string>
                    )[selectedCategoryMeta.slug] ?? "Any maker or brand"
                  : "Any maker or brand"
              }
              value={makerInput}
              onChange={(e) => setMakerInput(e.target.value)}
              onBlur={commitMaker}
              className="w-full pl-8 pr-3 py-2 text-sm border border-antique-border bg-antique-surface text-antique-text rounded-lg focus:ring-2 focus:ring-antique-accent focus:border-transparent outline-none"
            />
          </div>
        </form>
        {filters.maker && (
          <div className="mt-2 flex items-center gap-1.5">
            <span className="text-xs bg-antique-accent/10 text-antique-accent border border-antique-accent/30 rounded-full px-2.5 py-1">
              {filters.maker.replace(/_/g, " ")}
            </span>
            <button
              onClick={() => { setMakerInput(""); update({ maker: undefined }); }}
              className="text-antique-text-mute hover:text-antique-accent"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </Section>

      {/* ── CONDITION ────────────────────────────────────────────────────────── */}
      <Section title="Condition" defaultOpen={false}>
        <PillGroup
          options={CONDITIONS}
          value={filters.condition}
          onChange={(v) => update({ condition: v })}
        />
      </Section>

      {/* ── COUNTRY OF ORIGIN ────────────────────────────────────────────────── */}
      {(!filters.category || COUNTRY_CATEGORIES.has(filters.category)) && (
        <Section title="Country of Origin" defaultOpen={false}>
          <PillGroup
            options={COUNTRIES}
            value={filters.country_of_origin}
            onChange={(v) => update({ country_of_origin: v })}
          />
        </Section>
      )}

      {/* ── PRICE RANGE ──────────────────────────────────────────────────────── */}
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
        <div className="flex flex-wrap gap-1.5 mt-2">
          {[
            { label: "< $100",   min: undefined, max: 100   },
            { label: "< $500",   min: undefined, max: 500   },
            { label: "< $1,000", min: undefined, max: 1000  },
            { label: "$1k+",     min: 1000,      max: undefined },
          ].map((preset) => (
            <button
              key={preset.label}
              onClick={() => update({ min_price: preset.min, max_price: preset.max })}
              className={cn(
                "text-xs px-2.5 py-1 rounded-full border transition-colors",
                filters.min_price === preset.min && filters.max_price === preset.max
                  ? "bg-antique-accent text-white border-antique-accent"
                  : "bg-antique-surface text-antique-text-mute border-antique-border hover:border-antique-accent hover:text-antique-accent"
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </Section>

      {/* ── SEARCH RADIUS ────────────────────────────────────────────────────── */}
      <Section title="Search Radius" defaultOpen={false}>
        <div className="flex flex-wrap gap-2">
          {RADIUS_OPTIONS.map((miles) => (
            <button
              key={miles}
              onClick={() => update({ radius_miles: miles })}
              className={cn(
                "text-xs px-3 py-1.5 rounded-full border transition-colors",
                (filters.radius_miles ?? 50) === miles
                  ? "bg-antique-accent text-white border-antique-accent"
                  : "bg-antique-surface text-antique-text-sec border-antique-border hover:border-antique-accent hover:text-antique-accent"
              )}
            >
              {miles} mi
            </button>
          ))}
        </div>
        <p className="text-xs text-antique-text-mute mt-2">
          Use &ldquo;Near Me&rdquo; in search to set your location
        </p>
      </Section>

      {/* ── ENDING TIME ──────────────────────────────────────────────────────── */}
      <Section title="Ending" defaultOpen={false}>
        <RadioGroup
          name={`${uid}-ending`}
          value={filters.ending_hours ?? (undefined as undefined)}
          options={[
            { label: "Any time",          value: undefined as undefined },
            { label: "Ending in 2 hours", value: 2 },
            { label: "Ending today",      value: 24 },
            { label: "Ending in 3 days",  value: 72 },
            { label: "Ending this week",  value: 168 },
          ]}
          onChange={(v) => update({ ending_hours: v })}
        />
      </Section>

      {/* ── DELIVERY ─────────────────────────────────────────────────────────── */}
      <Section title="Delivery" defaultOpen={false}>
        <label className="flex items-center gap-2.5 cursor-pointer group">
          <input
            type="checkbox"
            checked={filters.pickup_only ?? false}
            onChange={(e) => update({ pickup_only: e.target.checked || undefined })}
            className="w-4 h-4 accent-[var(--antique-accent,#8B6914)]"
          />
          <span className="text-sm text-antique-text-sec group-hover:text-antique-accent transition-colors">
            Pickup only (no shipping)
          </span>
        </label>
      </Section>

      {/* ── PLATFORM ─────────────────────────────────────────────────────────── */}
      <Section title="Platform" defaultOpen={false}>
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
                  className="w-4 h-4 accent-[var(--antique-accent,#8B6914)]"
                />
                <span className="text-sm text-antique-text-sec group-hover:text-antique-accent transition-colors">
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
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
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
      <aside className="hidden lg:block w-60 flex-shrink-0">
        <div className="bg-antique-surface border border-antique-border rounded-2xl p-5 sticky top-4 max-h-[calc(100vh-6rem)] overflow-y-auto">
          {content}
        </div>
      </aside>
    </>
  );
}
