"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Search, Loader2, ArrowUpDown, LayoutGrid, LayoutList } from "lucide-react";
import { ListingGrid } from "@/components/listings/listing-grid";
import { FilterSidebar } from "@/components/filters/filter-sidebar";
import { SearchAffiliateAd } from "@/components/ads/search-affiliate-ad";
import { searchListings } from "@/lib/api-client";
import type { SearchFilters } from "@/types";
import { cn } from "@/lib/cn";

const PAGE_SIZE = 24;

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "",             label: "Default order"     },
  { value: "ending_soon",  label: "Ending soonest"    },
  { value: "price_asc",    label: "Price: Low → High" },
  { value: "price_desc",   label: "Price: High → Low" },
  { value: "newest",       label: "Newest first"      },
];

type ViewMode = "gallery" | "list";
const VIEW_MODE_KEY = "es_view_mode";

// ── helpers ───────────────────────────────────────────────────────────────────

function paramsToFilters(p: URLSearchParams): SearchFilters {
  const platformIds = p.getAll("platform_ids").map(Number).filter(Boolean);
  return {
    page:          1,
    page_size:     PAGE_SIZE,
    radius_miles:  Number(p.get("radius_miles") ?? "50") || 50,
    q:             p.get("q")         ?? undefined,
    status:        p.get("status")    ?? undefined,
    category:      p.get("category")  ?? undefined,
    sort:          (p.get("sort") as SearchFilters["sort"]) ?? undefined,
    min_price:     p.get("min_price") ? Number(p.get("min_price"))    : undefined,
    max_price:     p.get("max_price") ? Number(p.get("max_price"))    : undefined,
    ending_hours:  p.get("ending_hours") ? Number(p.get("ending_hours")) : undefined,
    pickup_only:   p.get("pickup_only") === "true" ? true : undefined,
    platform_ids:  platformIds.length ? platformIds : undefined,
    listing_type:  (p.get("listing_type") as SearchFilters["listing_type"]) ?? undefined,
  };
}

function filtersToParams(f: SearchFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q)             p.set("q",            f.q);
  if (f.status)        p.set("status",        f.status);
  if (f.category)      p.set("category",      f.category);
  if (f.sort)          p.set("sort",          f.sort);
  if (f.min_price)     p.set("min_price",     String(f.min_price));
  if (f.max_price)     p.set("max_price",     String(f.max_price));
  if (f.ending_hours)  p.set("ending_hours",  String(f.ending_hours));
  if (f.pickup_only)   p.set("pickup_only",   "true");
  if (f.listing_type)  p.set("listing_type",  f.listing_type);
  if (f.radius_miles && f.radius_miles !== 50)
                       p.set("radius_miles",  String(f.radius_miles));
  if (f.platform_ids?.length)
    f.platform_ids.forEach((id) => p.append("platform_ids", String(id)));
  return p;
}

// ── inner component (requires useSearchParams — wrapped in Suspense below) ────

function SearchPageInner() {
  const router     = useRouter();
  const pathname   = usePathname();
  const rawParams  = useSearchParams();

  const [filters, setFilters] = useState<SearchFilters>(() =>
    paramsToFilters(rawParams)
  );
  const [query, setQuery] = useState(rawParams.get("q") ?? "");
  const [viewMode, setViewMode] = useState<ViewMode>("gallery");

  // Restore persisted view mode preference
  useEffect(() => {
    const saved = localStorage.getItem(VIEW_MODE_KEY);
    if (saved === "list" || saved === "gallery") setViewMode(saved);
  }, []);

  function toggleViewMode(mode: ViewMode) {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_KEY, mode);
  }

  // Sync filters → URL (replace so back-button still works naturally)
  useEffect(() => {
    const params  = filtersToParams(filters);
    const search  = params.toString();
    router.replace(`${pathname}${search ? "?" + search : ""}`, { scroll: false });
  }, [filters, pathname, router]);

  const { data: listings = [], isLoading, isFetching } = useQuery({
    queryKey: ["search", filters],
    queryFn:  () => searchListings(filters),
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setFilters((f) => ({ ...f, q: query || undefined, page: 1, page_size: PAGE_SIZE }));
  }

  function handleFiltersChange(newFilters: SearchFilters) {
    setFilters({ ...newFilters, page: 1, page_size: PAGE_SIZE });
  }

  function handleSort(value: string) {
    setFilters((f) => ({
      ...f,
      sort: (value as SearchFilters["sort"]) || undefined,
      page: 1,
      page_size: PAGE_SIZE,
    }));
  }

  function loadMore() {
    setFilters((f) => ({ ...f, page_size: (f.page_size ?? PAGE_SIZE) + PAGE_SIZE }));
  }

  const currentPageSize = filters.page_size ?? PAGE_SIZE;
  const hasMore         = listings.length >= currentPageSize;
  const isLoadingMore   = isFetching && listings.length > 0;

  return (
    <div className="container mx-auto px-4 py-8">

      {/* ── Search bar ── */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <div className="flex-1 flex items-center gap-2 bg-antique-surface border border-antique-border rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-antique-accent focus-within:border-transparent">
          <Search className="w-5 h-5 text-antique-text-mute flex-shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search antiques, ceramics, furniture..."
            className="flex-1 outline-none text-sm bg-transparent text-antique-text placeholder:text-antique-text-mute"
          />
        </div>
        <button
          type="submit"
          className="bg-antique-accent text-white px-6 py-3 rounded-xl hover:bg-antique-accent-h transition-colors font-medium"
        >
          Search
        </button>
      </form>

      {/* ── Contextual affiliate strip (query/filter-aware) ── */}
      <SearchAffiliateAd filters={filters} />

      {/* ── Sidebar + results ── */}
      <div className="flex gap-8 items-start">
        <FilterSidebar filters={filters} onChange={handleFiltersChange} />

        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="text-center py-20 text-antique-text-mute">
              <div className="text-4xl mb-3">⏳</div>
              <p>Searching across all platforms...</p>
            </div>
          ) : (
            <>
              {/* Results header: count + sort + view toggle */}
              <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                <p className="text-sm text-antique-text-mute">
                  {listings.length > 0
                    ? `${listings.length} listing${listings.length !== 1 ? "s" : ""} found`
                    : "No listings found — try broadening your filters"}
                </p>

                <div className="flex items-center gap-2">
                  {/* Sort dropdown */}
                  <div className="flex items-center gap-1.5 text-sm">
                    <ArrowUpDown className="w-3.5 h-3.5 text-antique-text-mute" />
                    <select
                      value={filters.sort ?? ""}
                      onChange={(e) => handleSort(e.target.value)}
                      className="bg-antique-surface border border-antique-border rounded-lg px-3 py-1.5 text-sm text-antique-text focus:ring-2 focus:ring-antique-accent focus:border-transparent outline-none cursor-pointer"
                    >
                      {SORT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* View mode toggle */}
                  <div className="flex items-center border border-antique-border rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleViewMode("gallery")}
                      className={cn(
                        "p-1.5 transition-colors",
                        viewMode === "gallery"
                          ? "bg-antique-accent text-white"
                          : "bg-antique-surface text-antique-text-mute hover:text-antique-text"
                      )}
                      aria-label="Gallery view"
                      title="Gallery view"
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => toggleViewMode("list")}
                      className={cn(
                        "p-1.5 transition-colors",
                        viewMode === "list"
                          ? "bg-antique-accent text-white"
                          : "bg-antique-surface text-antique-text-mute hover:text-antique-text"
                      )}
                      aria-label="List view"
                      title="List view"
                    >
                      <LayoutList className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <ListingGrid listings={listings} viewMode={viewMode} />

              {/* Load more */}
              {hasMore && (
                <div className="mt-8 text-center">
                  <button
                    onClick={loadMore}
                    disabled={isLoadingMore}
                    className="inline-flex items-center gap-2 bg-antique-surface border border-antique-border text-antique-text-sec px-8 py-3 rounded-xl hover:border-antique-accent hover:text-antique-accent hover:shadow-sm transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoadingMore ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading more...
                      </>
                    ) : (
                      `Load ${PAGE_SIZE} more listings`
                    )}
                  </button>
                </div>
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
            <div className="text-4xl mb-3">⏳</div>
            <p>Loading search...</p>
          </div>
        </div>
      }
    >
      <SearchPageInner />
    </Suspense>
  );
}
