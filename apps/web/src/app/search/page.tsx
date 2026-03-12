"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Search, Loader2, ArrowUpDown, LayoutGrid, LayoutList,
  ChevronLeft, ChevronRight, Bookmark, MapPin,
} from "lucide-react";
import { ListingGrid } from "@/components/listings/listing-grid";
import { FilterSidebar } from "@/components/filters/filter-sidebar";
import { SearchAffiliateAd } from "@/components/ads/search-affiliate-ad";
import { searchListings } from "@/lib/api-client";
import type { SearchFilters } from "@/types";
import { cn } from "@/lib/cn";

const PAGE_SIZE = 24;

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "",            label: "Best match"        },
  { value: "newest",      label: "Newest first"      },
  { value: "ending_soon", label: "Ending soonest"    },
  { value: "price_asc",   label: "Price: Low → High" },
  { value: "price_desc",  label: "Price: High → Low" },
];

// Quick-filter presets displayed above the results
const QUICK_FILTERS: { label: string; filters: Partial<SearchFilters> }[] = [
  { label: "Under $100",    filters: { max_price: 100 } },
  { label: "Under $500",    filters: { max_price: 500 } },
  { label: "Ending Today",  filters: { ending_hours: 24 } },
  { label: "Live Now",      filters: { status: "live" } },
  { label: "Newly Listed",  filters: { sort: "newest" } },
  { label: "With Estimate", filters: { status: "upcoming" } },
];

type ViewMode = "gallery" | "list";
const VIEW_MODE_KEY = "es_view_mode";

// ── Helpers ───────────────────────────────────────────────────────────────────

function paramsToFilters(p: URLSearchParams): SearchFilters {
  const platformIds = p.getAll("platform_ids").map(Number).filter(Boolean);
  return {
    page:             parseInt(p.get("page") ?? "1") || 1,
    page_size:        PAGE_SIZE,
    radius_miles:     Number(p.get("radius_miles") ?? "50") || 50,
    q:                p.get("q")              || undefined,
    status:           p.get("status")         || undefined,
    category:         p.get("category")       || undefined,
    sub_category:     p.get("sub_category")   || undefined,
    sort:             (p.get("sort") as SearchFilters["sort"]) || undefined,
    min_price:        p.get("min_price") ? Number(p.get("min_price")) : undefined,
    max_price:        p.get("max_price") ? Number(p.get("max_price")) : undefined,
    ending_hours:     p.get("ending_hours") ? Number(p.get("ending_hours")) : undefined,
    pickup_only:      p.get("pickup_only") === "true" ? true : undefined,
    platform_ids:     platformIds.length ? platformIds : undefined,
    listing_type:     (p.get("listing_type") as SearchFilters["listing_type"]) || undefined,
    maker:            p.get("maker")           || undefined,
    period:           p.get("period")          || undefined,
    country_of_origin:p.get("country_of_origin") || undefined,
    condition:        p.get("condition")       || undefined,
  };
}

function filtersToParams(f: SearchFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q)              p.set("q",              f.q);
  if (f.status)         p.set("status",         f.status);
  if (f.category)       p.set("category",       f.category);
  if (f.sub_category)   p.set("sub_category",   f.sub_category);
  if (f.sort)           p.set("sort",           f.sort);
  if (f.min_price)      p.set("min_price",      String(f.min_price));
  if (f.max_price)      p.set("max_price",      String(f.max_price));
  if (f.ending_hours)   p.set("ending_hours",   String(f.ending_hours));
  if (f.pickup_only)    p.set("pickup_only",    "true");
  if (f.listing_type)   p.set("listing_type",   f.listing_type);
  if (f.maker)          p.set("maker",          f.maker);
  if (f.period)         p.set("period",         f.period);
  if (f.country_of_origin) p.set("country_of_origin", f.country_of_origin);
  if (f.condition)      p.set("condition",      f.condition);
  if (f.page && f.page > 1) p.set("page",      String(f.page));
  if (f.radius_miles && f.radius_miles !== 50)
    p.set("radius_miles", String(f.radius_miles));
  if (f.platform_ids?.length)
    f.platform_ids.forEach((id) => p.append("platform_ids", String(id)));
  return p;
}

// ── Inner component ───────────────────────────────────────────────────────────

function SearchPageInner() {
  const router    = useRouter();
  const pathname  = usePathname();
  const rawParams = useSearchParams();

  const [filters, setFilters] = useState<SearchFilters>(() => paramsToFilters(rawParams));
  const [query, setQuery]     = useState(rawParams.get("q") ?? "");
  const [viewMode, setViewMode] = useState<ViewMode>("gallery");

  useEffect(() => {
    const saved = localStorage.getItem(VIEW_MODE_KEY);
    if (saved === "list" || saved === "gallery") setViewMode(saved as ViewMode);
  }, []);

  function toggleViewMode(mode: ViewMode) {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_KEY, mode);
  }

  // Sync filters → URL
  useEffect(() => {
    const params = filtersToParams(filters);
    const search = params.toString();
    router.replace(`${pathname}${search ? "?" + search : ""}`, { scroll: false });
  }, [filters, pathname, router]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["search", filters],
    queryFn:  () => searchListings(filters),
    placeholderData: (prev) => prev,
  });

  const listings    = data?.results ?? [];
  const total       = data?.total ?? 0;
  const totalPages  = data?.total_pages ?? 1;
  const currentPage = filters.page ?? 1;

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setFilters((f) => ({ ...f, q: query || undefined, page: 1 }));
  }

  function handleFiltersChange(newFilters: SearchFilters) {
    setFilters({ ...newFilters, page: 1, page_size: PAGE_SIZE });
  }

  function handleSort(value: string) {
    setFilters((f) => ({
      ...f,
      sort: (value as SearchFilters["sort"]) || undefined,
      page: 1,
    }));
  }

  function goToPage(p: number) {
    setFilters((f) => ({ ...f, page: Math.max(1, Math.min(totalPages, p)) }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function applyQuickFilter(qf: Partial<SearchFilters>) {
    setFilters((f) => ({ ...f, ...qf, page: 1 }));
  }

  function handleNearMe() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      setFilters((f) => ({
        ...f,
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        page: 1,
      }));
    });
  }

  function saveSearch() {
    const name = prompt("Name this saved search:", filters.q ?? "My Search");
    if (!name) return;
    const saved = JSON.parse(localStorage.getItem("es_saved_searches") ?? "[]");
    saved.push({ id: Date.now(), name, filters, created_at: new Date().toISOString() });
    localStorage.setItem("es_saved_searches", JSON.stringify(saved));
    alert(`Search "${name}" saved! View your saved searches in the Catalog.`);
  }

  const showingFrom = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const showingTo   = Math.min(currentPage * PAGE_SIZE, total);

  return (
    <div className="container mx-auto px-4 py-8">

      {/* ── Search bar ── */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <div className="flex-1 flex items-center gap-2 bg-antique-surface border border-antique-border rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-antique-accent focus-within:border-transparent">
          <Search className="w-5 h-5 text-antique-text-mute flex-shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search antiques, ceramics, furniture, silver…"
            className="flex-1 outline-none text-sm bg-transparent text-antique-text placeholder:text-antique-text-mute"
          />
        </div>
        <button
          type="button"
          onClick={handleNearMe}
          title="Find listings near me"
          className="border border-antique-border bg-antique-surface text-antique-text-sec px-4 py-3 rounded-xl hover:border-antique-accent hover:text-antique-accent transition-colors"
        >
          <MapPin className="w-4 h-4" />
        </button>
        <button
          type="submit"
          className="bg-antique-accent text-white px-6 py-3 rounded-xl hover:bg-antique-accent-h transition-colors font-medium whitespace-nowrap"
        >
          Search
        </button>
      </form>

      {/* ── Quick-filter chips ── */}
      <div className="flex flex-wrap gap-2 mb-5">
        {QUICK_FILTERS.map((qf) => {
          const isActive = Object.entries(qf.filters).every(
            ([k, v]) => (filters as Record<string, unknown>)[k] === v
          );
          return (
            <button
              key={qf.label}
              onClick={() =>
                isActive
                  ? setFilters((f) => {
                      const next = { ...f };
                      Object.keys(qf.filters).forEach((k) => delete (next as Record<string, unknown>)[k]);
                      return { ...next, page: 1 };
                    })
                  : applyQuickFilter(qf.filters)
              }
              className={cn(
                "text-xs px-3.5 py-1.5 rounded-full border font-medium transition-colors",
                isActive
                  ? "bg-antique-accent text-white border-antique-accent"
                  : "bg-antique-surface text-antique-text-sec border-antique-border hover:border-antique-accent hover:text-antique-accent"
              )}
            >
              {qf.label}
            </button>
          );
        })}
      </div>

      {/* ── Affiliate strip ── */}
      <SearchAffiliateAd filters={filters} />

      {/* ── Sidebar + results ── */}
      <div className="flex gap-8 items-start">
        <FilterSidebar filters={filters} onChange={handleFiltersChange} />

        <div className="flex-1 min-w-0">
          {isLoading && !data ? (
            <div className="text-center py-20 text-antique-text-mute">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
              <p>Searching across all platforms…</p>
            </div>
          ) : (
            <>
              {/* Results header */}
              <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <p className="text-sm text-antique-text-mute">
                    {total > 0
                      ? <>
                          <span className="font-semibold text-antique-text">
                            {total.toLocaleString()}
                          </span>{" "}
                          result{total !== 1 ? "s" : ""}
                          {total > PAGE_SIZE && (
                            <span className="text-antique-text-mute">
                              {" "}— showing {showingFrom}–{showingTo}
                            </span>
                          )}
                        </>
                      : "No listings found — try broadening your filters"}
                  </p>
                  {isFetching && data && (
                    <Loader2 className="w-4 h-4 animate-spin text-antique-text-mute" />
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Save search button */}
                  {total > 0 && (
                    <button
                      onClick={saveSearch}
                      title="Save this search"
                      className="flex items-center gap-1.5 text-xs text-antique-text-sec border border-antique-border bg-antique-surface rounded-lg px-3 py-1.5 hover:border-antique-accent hover:text-antique-accent transition-colors"
                    >
                      <Bookmark className="w-3.5 h-3.5" />
                      Save
                    </button>
                  )}

                  {/* Sort */}
                  <div className="flex items-center gap-1.5">
                    <ArrowUpDown className="w-3.5 h-3.5 text-antique-text-mute" />
                    <select
                      value={filters.sort ?? ""}
                      onChange={(e) => handleSort(e.target.value)}
                      className="bg-antique-surface border border-antique-border rounded-lg px-3 py-1.5 text-sm text-antique-text focus:ring-2 focus:ring-antique-accent focus:border-transparent outline-none cursor-pointer"
                    >
                      {SORT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* View toggle */}
                  <div className="flex items-center border border-antique-border rounded-lg overflow-hidden">
                    {(["gallery", "list"] as ViewMode[]).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => toggleViewMode(mode)}
                        aria-label={`${mode} view`}
                        className={cn(
                          "p-1.5 transition-colors",
                          viewMode === mode
                            ? "bg-antique-accent text-white"
                            : "bg-antique-surface text-antique-text-mute hover:text-antique-text"
                        )}
                      >
                        {mode === "gallery"
                          ? <LayoutGrid className="w-4 h-4" />
                          : <LayoutList className="w-4 h-4" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <ListingGrid listings={listings} viewMode={viewMode} />

              {/* ── Pagination ── */}
              {totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-2">
                  <button
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage <= 1}
                    className="flex items-center gap-1 px-4 py-2 rounded-lg border border-antique-border bg-antique-surface text-antique-text-sec text-sm hover:border-antique-accent hover:text-antique-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" /> Prev
                  </button>

                  {/* Page number pills */}
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    // Show pages around current page
                    let p: number;
                    if (totalPages <= 7) {
                      p = i + 1;
                    } else if (currentPage <= 4) {
                      p = i + 1;
                    } else if (currentPage >= totalPages - 3) {
                      p = totalPages - 6 + i;
                    } else {
                      p = currentPage - 3 + i;
                    }
                    return (
                      <button
                        key={p}
                        onClick={() => goToPage(p)}
                        className={cn(
                          "w-9 h-9 rounded-lg text-sm font-medium transition-colors border",
                          p === currentPage
                            ? "bg-antique-accent text-white border-antique-accent"
                            : "bg-antique-surface text-antique-text-sec border-antique-border hover:border-antique-accent hover:text-antique-accent"
                        )}
                      >
                        {p}
                      </button>
                    );
                  })}

                  <button
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                    className="flex items-center gap-1 px-4 py-2 rounded-lg border border-antique-border bg-antique-surface text-antique-text-sec text-sm hover:border-antique-accent hover:text-antique-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {totalPages > 1 && (
                <p className="text-center text-xs text-antique-text-mute mt-3">
                  Page {currentPage} of {totalPages.toLocaleString()} ({total.toLocaleString()} total results)
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Suspense wrapper — required by Next.js for useSearchParams in client components
export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-20 text-antique-text-mute">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
            <p>Loading search…</p>
          </div>
        </div>
      }
    >
      <SearchPageInner />
    </Suspense>
  );
}
