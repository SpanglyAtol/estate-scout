"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { ListingGrid } from "@/components/listings/listing-grid";
import { FilterSidebar } from "@/components/filters/filter-sidebar";
import { searchListings } from "@/lib/api-client";
import type { SearchFilters } from "@/types";

export default function SearchPage() {
  const [filters, setFilters] = useState<SearchFilters>({
    page: 1,
    page_size: 24,
    radius_miles: 50,
  });
  const [query, setQuery] = useState("");

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ["search", filters],
    queryFn: () => searchListings(filters),
    enabled: true,
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setFilters((f) => ({ ...f, q: query, page: 1 }));
  }

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
        <FilterSidebar filters={filters} onChange={setFilters} />

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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
