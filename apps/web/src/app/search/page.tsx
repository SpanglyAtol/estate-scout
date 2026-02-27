"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Search, Loader2 } from "lucide-react";
import { ListingGrid } from "@/components/listings/listing-grid";
import { FilterSidebar } from "@/components/filters/filter-sidebar";
import { searchListings } from "@/lib/api-client";
import type { SearchFilters } from "@/types";

const PAGE_SIZE = 24;

// Inner component that can safely use useSearchParams (wrapped in Suspense below)
function SearchPageInner() {
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status") ?? undefined;

  const [filters, setFilters] = useState<SearchFilters>({
    page: 1,
    page_size: PAGE_SIZE,
    radius_miles: 50,
    status: initialStatus,
  });
  const [query, setQuery] = useState("");

  const { data: listings = [], isLoading, isFetching } = useQuery({
    queryKey: ["search", filters],
    queryFn: () => searchListings(filters),
    enabled: true,
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setFilters((f) => ({ ...f, q: query, page: 1, page_size: PAGE_SIZE }));
  }

  // When the sidebar changes filters, reset page_size so we start fresh
  function handleFiltersChange(newFilters: SearchFilters) {
    setFilters({ ...newFilters, page: 1, page_size: PAGE_SIZE });
  }

  function loadMore() {
    setFilters((f) => ({ ...f, page_size: (f.page_size ?? PAGE_SIZE) + PAGE_SIZE }));
  }

  const currentPageSize = filters.page_size ?? PAGE_SIZE;
  // If we got a full page, there are likely more results
  const hasMore = listings.length >= currentPageSize;
  // Show spinner on the button while re-fetching for load-more (not initial load)
  const isLoadingMore = isFetching && listings.length > 0;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Search bar */}
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

      {/* Content: sidebar + results */}
      <div className="flex gap-8 items-start">
        {/* FilterSidebar handles its own mobile/desktop rendering */}
        <FilterSidebar filters={filters} onChange={handleFiltersChange} />

        {/* Results panel */}
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="text-center py-20 text-gray-400">
              <div className="text-4xl mb-3">⏳</div>
              <p>Searching across all platforms...</p>
            </div>
          ) : (
            <>
              {listings.length > 0 && (
                <p className="text-sm text-gray-500 mb-4">
                  {listings.length} listing{listings.length !== 1 ? "s" : ""} found
                </p>
              )}

              <ListingGrid listings={listings} />

              {/* Load More button — only shown when a full page was returned */}
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
                      `Load more listings`
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

// Wrapping in Suspense is required by Next.js when using useSearchParams in a client component
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
