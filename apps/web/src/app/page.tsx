import Link from "next/link";
import { Search, MessageSquare, Bell, TrendingUp, Clock, Calendar, Package } from "lucide-react";
import { ListingGrid } from "@/components/listings/listing-grid";
import { getStats, searchListings } from "@/lib/api-client";
import type { StatsResult } from "@/lib/api-client";
import type { Listing } from "@/types";

// Always fetch fresh scraped data — never serve a stale static render
export const dynamic = "force-dynamic";

// Server component - renders on the server for SEO
export default async function HomePage() {
  // Fetch everything in parallel
  let endingSoon: Listing[] = [];
  let upcoming: Listing[] = [];
  let live: Listing[] = [];
  let stats: StatsResult | null = null;

  try {
    [endingSoon, upcoming, live, stats] = await Promise.all([
      searchListings({ status: "ending_soon", page_size: 6 }),
      searchListings({ status: "upcoming",    page_size: 6 }),
      searchListings({ status: "live",        page_size: 12 }),
      getStats(),
    ]);
  } catch {
    // Backend not running yet — show empty state gracefully
  }

  const totalActive = (stats?.live ?? 0) + (stats?.upcoming ?? 0);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Hero */}
      <section className="text-center mb-8 py-6">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
          Find Estate Sales Across{" "}
          <span className="text-blue-600">Every Platform</span>
        </h1>
        <p className="text-lg text-gray-600 mb-6 max-w-2xl mx-auto">
          Search LiveAuctioneers, EstateSales.NET, HiBid, MaxSold and more —
          all in one place. With AI-powered price checking.
        </p>

        {/* Hero search */}
        <Link
          href="/search"
          className="inline-flex items-center gap-3 bg-white border-2 border-gray-300 rounded-2xl px-6 py-4 text-gray-500 text-left w-full max-w-xl mx-auto hover:border-blue-400 hover:shadow-md transition-all"
        >
          <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
          <span>Search antiques, furniture, ceramics...</span>
          <span className="ml-auto text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-lg font-medium whitespace-nowrap">
            Search →
          </span>
        </Link>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-3 mt-5 text-sm">
          <div className="bg-blue-50 text-blue-700 px-4 py-1.5 rounded-full font-medium">
            ✓ Unified search across {stats?.platforms ?? 4}+ platforms
          </div>
          <div className="bg-blue-50 text-blue-700 px-4 py-1.5 rounded-full font-medium">
            ✓ AI price checking
          </div>
          <div className="bg-blue-50 text-blue-700 px-4 py-1.5 rounded-full font-medium">
            ✓ Real-time alerts
          </div>
        </div>
      </section>

      {/* Stats bar */}
      {stats && (
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
          <div className="bg-white border border-gray-200 rounded-2xl p-4 text-center">
            <Package className="w-5 h-5 text-blue-500 mx-auto mb-1" />
            <div className="text-2xl font-bold text-gray-900">{stats.total.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-0.5">Total listings</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-4 text-center">
            <TrendingUp className="w-5 h-5 text-green-500 mx-auto mb-1" />
            <div className="text-2xl font-bold text-gray-900">{stats.live.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-0.5">Live auctions</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-4 text-center">
            <Clock className="w-5 h-5 text-red-500 mx-auto mb-1" />
            <div className="text-2xl font-bold text-gray-900">{stats.ending_soon.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-0.5">Ending today</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-4 text-center">
            <Calendar className="w-5 h-5 text-blue-400 mx-auto mb-1" />
            <div className="text-2xl font-bold text-gray-900">{stats.upcoming.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-0.5">Upcoming</div>
          </div>
        </section>
      )}

      {/* Quick action cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        <Link
          href="/search"
          className="bg-white rounded-2xl p-6 border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all group"
        >
          <Search className="w-8 h-8 text-blue-500 mb-3 group-hover:scale-110 transition-transform" />
          <h2 className="font-bold text-lg text-gray-900 mb-1">Search & Filter</h2>
          <p className="text-sm text-gray-500">
            Filter by location radius, price range, pickup vs. shipping, ending soon.
          </p>
        </Link>

        <Link
          href="/valuation"
          className="bg-white rounded-2xl p-6 border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all group"
        >
          <MessageSquare className="w-8 h-8 text-green-500 mb-3 group-hover:scale-110 transition-transform" />
          <h2 className="font-bold text-lg text-gray-900 mb-1">AI Price Check</h2>
          <p className="text-sm text-gray-500">
            Describe an item and see comparable completed sales + estimated value.
          </p>
        </Link>

        <Link
          href="/saved"
          className="bg-white rounded-2xl p-6 border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all group"
        >
          <Bell className="w-8 h-8 text-amber-500 mb-3 group-hover:scale-110 transition-transform" />
          <h2 className="font-bold text-lg text-gray-900 mb-1">Smart Alerts</h2>
          <p className="text-sm text-gray-500">
            Get notified when Imari plates under $100 show up within 50 miles.
          </p>
        </Link>
      </section>

      {/* Ending Soon */}
      {endingSoon.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <h2 className="text-xl font-bold text-gray-900">Ending Soon</h2>
              <span className="text-sm text-gray-400 font-normal hidden sm:inline">
                — closing within 24 hours
              </span>
            </div>
            <Link
              href="/search?status=ending_soon"
              className="text-blue-600 text-sm hover:underline font-medium"
            >
              View all {stats?.ending_soon ? `${stats.ending_soon} ` : ""}→
            </Link>
          </div>
          <ListingGrid listings={endingSoon} showAds={false} />
        </section>
      )}

      {/* Upcoming Auctions */}
      {upcoming.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-500" />
              <h2 className="text-xl font-bold text-gray-900">Upcoming Auctions</h2>
              <span className="text-sm text-gray-400 font-normal hidden sm:inline">
                — not yet open for bidding
              </span>
            </div>
            <Link
              href="/search?status=upcoming"
              className="text-blue-600 text-sm hover:underline font-medium"
            >
              View all {stats?.upcoming ? `${stats.upcoming} ` : ""}→
            </Link>
          </div>
          <ListingGrid listings={upcoming} showAds={false} />
        </section>
      )}

      {/* Live Now */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-500" />
            <h2 className="text-xl font-bold text-gray-900">Live Now</h2>
            {totalActive > 0 && (
              <span className="text-sm text-gray-400 font-normal hidden sm:inline">
                — {totalActive.toLocaleString()} active auctions
              </span>
            )}
          </div>
          <Link href="/search" className="text-blue-600 text-sm hover:underline font-medium">
            Browse all →
          </Link>
        </div>
        <ListingGrid
          listings={live}
          emptyMessage="No listings yet — run a scraper to populate data."
        />
      </section>
    </div>
  );
}
