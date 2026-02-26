import Link from "next/link";
import { Search, MessageSquare, Bell } from "lucide-react";
import { ListingGrid } from "@/components/listings/listing-grid";
import { getListings } from "@/lib/api-client";
import type { Listing } from "@/types";

// Always fetch fresh scraped data — never serve a stale static render
export const dynamic = "force-dynamic";

// Server component - renders on the server for SEO
export default async function HomePage() {
  // Fetch initial listings server-side (empty array if backend not up yet)
  let listings: Listing[] = [];
  try {
    listings = await getListings({ page_size: 24 });
  } catch {
    // Backend not running yet - show empty state
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Hero */}
      <section className="text-center mb-12 py-8">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
          Find Estate Sales Across{" "}
          <span className="text-blue-600">Every Platform</span>
        </h1>
        <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
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
        </Link>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-3 mt-6 text-sm">
          <div className="bg-blue-50 text-blue-700 px-4 py-1.5 rounded-full font-medium">
            ✓ Unified search across 4+ platforms
          </div>
          <div className="bg-blue-50 text-blue-700 px-4 py-1.5 rounded-full font-medium">
            ✓ AI price checking
          </div>
          <div className="bg-blue-50 text-blue-700 px-4 py-1.5 rounded-full font-medium">
            ✓ Real-time alerts
          </div>
        </div>
      </section>

      {/* Quick action cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
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

      {/* Live listings */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Live Now</h2>
          <Link href="/search" className="text-blue-600 text-sm hover:underline">
            View all →
          </Link>
        </div>
        <ListingGrid
          listings={listings}
          emptyMessage="No listings yet — run a scraper to populate data."
        />
      </section>
    </div>
  );
}
