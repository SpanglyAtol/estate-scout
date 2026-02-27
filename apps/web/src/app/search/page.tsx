"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Search, Loader2, ArrowUpDown } from "lucide-react";
import { ListingGrid } from "@/components/listings/listing-grid";
import { FilterSidebar } from "@/components/filters/filter-sidebar";
import { searchListings } from "@/lib/api-client";
import type { SearchFilters } from "@/types";

const PAGE_SIZE = 24;

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "",             label: "Default order"     },
  { value: "ending_soon",  label: "Ending soonest"    },
  { value: "price_asc",    label: "Price: Low → High" },
  { value: "price_desc",   label: "Price: High → Low" },
  { value: "newest",       label: "Newest first"      },
];

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

  // When sidebar filters change, reset paging but keep page_size if it was bumped
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
        <div className="flex-1 flex items-center gap-2 bg-white border border-gray-300 rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
          <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search antiques, ceramics, furniture..."
            className="flex-1 outline-none text-sm bg-transparent"
          />
        </div>
        <button
          type="submit"
          className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors font-medium"
        >
          Search
        </button>
      </form>

      {/* ── Sidebar + results ── */}
      <div className="flex gap-8 items-start">
        <FilterSidebar filters={filters} onChange={handleFiltersChange} />

        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="text-center py-20 text-gray-400">
              <div className="text-4xl mb-3">⏳</div>
              <p>Searching across all platforms...</p>
            </div>
          ) : (
            <>
              {/* Results header: count + sort */}
              <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                <p className="text-sm text-gray-500">
                  {listings.length > 0
                    ? `${listings.length} listing${listings.length !== 1 ? "s" : ""} found`
                    : "No listings found — try broadening your filters"}
                </p>

                {/* Sort dropdown */}
                <div className="flex items-center gap-1.5 text-sm">
                  <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
                  <select
                    value={filters.sort ?? ""}
                    onChange={(e) => handleSort(e.target.value)}
                    className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none cursor-pointer"
                  >
                    {SORT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <ListingGrid listings={listings} />

              {/* Load more */}
              {hasMore && (
                <div className="mt-8 text-center">
                  <button
                    onClick={loadMore}
                    disabled={isLoadingMore}
                    className="inline-flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-8 py-3 rounded-xl hover:border-blue-400 hover:text-blue-600 hover:shadow-sm transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
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
          <div className="text-center py-20 text-gray-400">
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
