"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, ArrowUpDown, LayoutGrid, LayoutList, TrendingUp } from "lucide-react";
import Link from "next/link";
import { ListingGrid } from "@/components/listings/listing-grid";
import { FilterSidebar } from "@/components/filters/filter-sidebar";
import { searchListings } from "@/lib/api-client";
import { CATEGORY_MAP } from "@/lib/category-meta";
import type { SearchFilters } from "@/types";
import { cn } from "@/lib/cn";

const PAGE_SIZE = 24;

const SORT_OPTIONS = [
  { value: "",            label: "Default order"     },
  { value: "ending_soon", label: "Ending soonest"    },
  { value: "price_asc",   label: "Price: Low → High" },
  { value: "price_desc",  label: "Price: High → Low" },
  { value: "newest",      label: "Newest first"      },
];

type ViewMode = "gallery" | "list";
const VIEW_MODE_KEY = "es_view_mode";

function CategoryBrowserInner({ slug }: { slug: string }) {
  const router = useRouter();
  const meta = CATEGORY_MAP[slug];

  const [filters, setFilters] = useState<SearchFilters>({
    category:  slug,
    page:      1,
    page_size: PAGE_SIZE,
  });
  const [viewMode, setViewMode] = useState<ViewMode>("gallery");

  useEffect(() => {
    const saved = localStorage.getItem(VIEW_MODE_KEY);
    if (saved === "list" || saved === "gallery") setViewMode(saved as ViewMode);
  }, []);

  // If user picks a different category in the sidebar, navigate there
  useEffect(() => {
    if (filters.category && filters.category !== slug) {
      router.push(`/categories/${filters.category}`);
    }
  }, [filters.category, slug, router]);

  function toggleViewMode(mode: ViewMode) {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_KEY, mode);
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

  function loadMore() {
    setFilters((f) => ({ ...f, page_size: (f.page_size ?? PAGE_SIZE) + PAGE_SIZE }));
  }

  const { data: listings = [], isLoading, isFetching } = useQuery({
    queryKey: ["category", slug, filters],
    queryFn:  () => searchListings(filters),
  });

  const currentPageSize = filters.page_size ?? PAGE_SIZE;
  const hasMore         = listings.length >= currentPageSize;
  const isLoadingMore   = isFetching && listings.length > 0;

  if (!meta) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <p className="text-4xl mb-4">🔍</p>
        <h1 className="font-display text-2xl text-antique-text mb-3">Category not found</h1>
        <p className="text-antique-text-sec mb-6">
          We don&apos;t recognise the category &ldquo;{slug}&rdquo;.
        </p>
        <Link
          href="/categories"
          className="inline-flex items-center gap-2 bg-antique-accent text-white px-5 py-2.5 rounded-xl hover:bg-antique-accent-h transition-colors font-medium"
        >
          <ArrowLeft className="w-4 h-4" /> Browse all categories
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">

      {/* ── Breadcrumb + header ───────────────────────────────────────────────── */}
      <div className="mb-7">
        <nav className="flex items-center gap-1.5 text-xs text-antique-text-mute mb-4">
          <Link href="/" className="hover:text-antique-accent transition-colors">Home</Link>
          <span>/</span>
          <Link href="/categories" className="hover:text-antique-accent transition-colors">Categories</Link>
          <span>/</span>
          <span className="text-antique-text-sec">{meta.label}</span>
        </nav>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4">
            <span className="text-4xl leading-none mt-0.5">{meta.icon}</span>
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-bold text-antique-text leading-tight">
                {meta.label}
              </h1>
              <p className="text-antique-text-sec mt-1 max-w-2xl">{meta.longDescription}</p>
            </div>
          </div>

          {/* Market prices link */}
          <Link
            href={`/prices?category=${slug}`}
            className="flex-shrink-0 inline-flex items-center gap-1.5 text-xs font-medium text-antique-text-sec border border-antique-border rounded-lg px-3 py-2 hover:border-antique-accent hover:text-antique-accent transition-colors bg-antique-surface"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            {meta.shortLabel} market prices
          </Link>
        </div>
      </div>

      {/* ── Sidebar + results ─────────────────────────────────────────────────── */}
      <div className="flex gap-8 items-start">
        <FilterSidebar filters={filters} onChange={handleFiltersChange} />

        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="text-center py-20 text-antique-text-mute">
              <div className="text-4xl mb-3">{meta.icon}</div>
              <p>Loading {meta.label.toLowerCase()}…</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                <p className="text-sm text-antique-text-mute">
                  {listings.length > 0
                    ? `${listings.length} ${meta.label.toLowerCase()} listing${listings.length !== 1 ? "s" : ""} found`
                    : `No ${meta.label.toLowerCase()} listings found — try broadening your filters`}
                </p>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 text-sm">
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

                  <div className="flex items-center border border-antique-border rounded-lg overflow-hidden">
                    {(["gallery", "list"] as ViewMode[]).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => toggleViewMode(mode)}
                        aria-label={`${mode} view`}
                        title={`${mode} view`}
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

              {hasMore && (
                <div className="mt-8 text-center">
                  <button
                    onClick={loadMore}
                    disabled={isLoadingMore}
                    className="inline-flex items-center gap-2 bg-antique-surface border border-antique-border text-antique-text-sec px-8 py-3 rounded-xl hover:border-antique-accent hover:text-antique-accent hover:shadow-sm transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoadingMore
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Loading more…</>
                      : `Load ${PAGE_SIZE} more listings`}
                  </button>
                </div>
              )}

              <div className="mt-10 text-center">
                <Link
                  href="/categories"
                  className="inline-flex items-center gap-1.5 text-sm text-antique-text-mute hover:text-antique-accent transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Browse all categories
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function CategoryBrowser({ slug }: { slug: string }) {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-20 text-antique-text-mute">
            <div className="text-4xl mb-3">⏳</div>
            <p>Loading category…</p>
          </div>
        </div>
      }
    >
      <CategoryBrowserInner slug={slug} />
    </Suspense>
  );
}
