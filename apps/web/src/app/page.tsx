import React from "react";
import Link from "next/link";
import { Search, Clock, Calendar, TrendingUp, Package, MapPin } from "lucide-react";
import { ListingGrid } from "@/components/listings/listing-grid";
import { CuratedPicks } from "@/components/home/curated-picks";
import { getStats, searchListingsArray } from "@/lib/api-client";
import { CATEGORIES } from "@/lib/category-meta";
import type { StatsResult } from "@/lib/api-client";
import type { Listing } from "@/types";

// Always fetch fresh scraped data — never serve a stale static render
export const dynamic = "force-dynamic";

export default async function HomePage() {
  let endingSoon: Listing[] = [];
  let upcoming: Listing[]   = [];
  let live: Listing[]       = [];
  let featured: Listing[]   = [];
  let estateSales: Listing[]= [];
  let stats: StatsResult | null = null;

  try {
    [featured, endingSoon, live, upcoming, estateSales, stats] = await Promise.all([
      // Featured: individual items (single antiques/collectibles) currently live
      searchListingsArray({ item_type: "individual_item", status: "live", page_size: 6 }),
      searchListingsArray({ status: "ending_soon", page_size: 6 }),
      // Live auctions: auction catalogs and any live listings
      searchListingsArray({ status: "live", page_size: 12 }),
      searchListingsArray({ status: "upcoming", page_size: 6 }),
      // Estate sales & lots go at the bottom
      searchListingsArray({ listing_type: "estate_sale", page_size: 6 }),
      getStats(),
    ]);
  } catch {
    // Backend not running yet — show empty state gracefully
  }

  // Fallback: if all time-filtered sections returned empty, load recent listings
  // regardless of status so the homepage always has content to show.
  let recentFallback: Listing[] = [];
  const totalTimeFiltered = featured.length + endingSoon.length + live.length + upcoming.length;
  if (totalTimeFiltered === 0) {
    try {
      recentFallback = await searchListingsArray({ sort: "newest", page_size: 24 });
    } catch {
      // silently skip
    }
  }

  return (
    <div className="container mx-auto px-4">

      {/* ── Hero ──────────────────────────────────────────────────────────────── */}
      <section className="text-center pt-16 pb-12">
        <p className="text-antique-accent font-display text-sm tracking-[0.2em] uppercase mb-4">
          Antiques &amp; Estate Sales
        </p>

        <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-antique-text leading-tight mb-5 max-w-3xl mx-auto">
          Discover Rare Finds Across Every Auction Platform
        </h1>

        <p className="text-antique-text-sec text-lg mb-8 max-w-xl mx-auto leading-relaxed">
          Search LiveAuctioneers, EstateSales.NET, HiBid, MaxSold and more from a single, elegant interface.
        </p>

        {/* Search bar */}
        <Link
          href="/search"
          className="inline-flex items-center gap-3 bg-antique-surface border border-antique-border rounded-xl px-6 py-4 text-antique-text-mute text-left w-full max-w-xl mx-auto hover:border-antique-accent hover:shadow-md transition-all group"
        >
          <Search className="w-5 h-5 text-antique-accent flex-shrink-0" />
          <span className="flex-1">Search antiques, furniture, ceramics, silverware…</span>
          <span className="text-xs bg-antique-accent-lt text-antique-accent px-3 py-1.5 rounded-lg font-medium whitespace-nowrap group-hover:bg-antique-accent group-hover:text-white transition-colors">
            Search →
          </span>
        </Link>

        {/* Quick browse pills → category pages */}
        <div className="flex flex-wrap justify-center gap-2 mt-6 text-sm">
          {[
            { label: "Ceramics",   href: "/categories/ceramics"    },
            { label: "Silver",     href: "/categories/silver"      },
            { label: "Jewelry",    href: "/categories/jewelry"     },
            { label: "Furniture",  href: "/categories/furniture"   },
            { label: "Art",        href: "/categories/art"         },
            { label: "All categories", href: "/categories"         },
            { label: "Near Me",    href: "/map"                    },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="px-3 py-1.5 rounded-full border border-antique-border text-antique-text-sec hover:border-antique-accent hover:text-antique-accent transition-colors text-xs"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </section>

      {/* ── Stats strip ───────────────────────────────────────────────────────── */}
      {stats && (
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-14">
          {[
            { icon: Package,    value: stats.total.toLocaleString(),         label: "Total listings",  color: "text-antique-accent" },
            { icon: TrendingUp, value: stats.live.toLocaleString(),          label: "Live auctions",   color: "text-antique-accent" },
            { icon: Clock,      value: stats.ending_soon.toLocaleString(),   label: "Ending today",    color: "text-antique-accent" },
            { icon: Calendar,   value: stats.upcoming.toLocaleString(),      label: "Upcoming",        color: "text-antique-accent" },
          ].map(({ icon: Icon, value, label, color }) => (
            <div key={label} className="antique-card p-4 text-center">
              <Icon className={`w-5 h-5 ${color} mx-auto mb-1.5`} />
              <div className="font-display text-2xl font-bold text-antique-text">{value}</div>
              <div className="text-xs text-antique-text-mute mt-0.5">{label}</div>
            </div>
          ))}
        </section>
      )}

      {/* ── Browse by Category ────────────────────────────────────────────────── */}
      <section className="mb-14">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-semibold text-antique-text">
            Browse by Category
          </h2>
          <Link
            href="/categories"
            className="text-xs text-antique-accent hover:underline"
          >
            View all →
          </Link>
        </div>

        {/* Horizontally scrollable row of category pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.slug}
              href={`/categories/${cat.slug}`}
              className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-antique-border bg-antique-surface text-antique-text-sec hover:border-antique-accent hover:text-antique-accent transition-colors text-sm whitespace-nowrap"
            >
              <span>{cat.icon}</span>
              <span>{cat.shortLabel}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Curator's Picks (AI-powered, client-side hydrated) ────────────────── */}
      <CuratedPicks />

      {/* ── Featured Individual Items ─────────────────────────────────────────── */}
      {featured.length > 0 && (
        <section className="mb-14">
          <SectionHeader
            icon={<span className="text-antique-accent font-display">✦</span>}
            title="Featured Items"
            subtitle="Curated individual pieces currently at auction"
            href="/search?listing_type=auction&status=live"
            linkLabel="Browse all auctions"
          />
          <ListingGrid listings={featured} showAds={false} />
        </section>
      )}

      {/* ── Ending Soon ───────────────────────────────────────────────────────── */}
      {endingSoon.length > 0 && (
        <section className="mb-14">
          <SectionHeader
            icon={<span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />}
            title="Ending Soon"
            subtitle="Closing within 24 hours"
            href="/search?status=ending_soon"
            linkLabel={stats?.ending_soon ? `View all ${stats.ending_soon}` : "View all"}
          />
          <ListingGrid listings={endingSoon} showAds={false} />
        </section>
      )}

      {/* ── Live Auctions ─────────────────────────────────────────────────────── */}
      <section className="mb-14">
        <SectionHeader
          icon={<TrendingUp className="w-5 h-5 text-antique-accent" />}
          title="Live Auctions"
          subtitle={stats ? `${((stats.live ?? 0) + (stats.upcoming ?? 0)).toLocaleString()} active listings` : undefined}
          href="/search?status=live"
          linkLabel="Browse all"
        />
        <ListingGrid
          listings={live}
          emptyMessage="No live listings yet — check back soon or run a scraper."
        />
      </section>

      {/* ── Upcoming Auctions ─────────────────────────────────────────────────── */}
      {upcoming.length > 0 && (
        <section className="mb-14">
          <SectionHeader
            icon={<Calendar className="w-5 h-5 text-antique-accent" />}
            title="Upcoming Auctions"
            subtitle="Not yet open for bidding"
            href="/search?status=upcoming"
            linkLabel={stats?.upcoming ? `View all ${stats.upcoming}` : "View all"}
          />
          <ListingGrid listings={upcoming} showAds={false} />
        </section>
      )}

      {/* ── Ornamental divider ────────────────────────────────────────────────── */}
      {estateSales.length > 0 && (
        <div className="ornament-divider mb-12 text-xs text-antique-text-mute tracking-widest uppercase">
          Estate Sales
        </div>
      )}

      {/* ── Estate Sales preview ──────────────────────────────────────────────── */}
      {estateSales.length > 0 && (
        <section className="mb-14">
          <SectionHeader
            icon={<MapPin className="w-5 h-5 text-antique-accent" />}
            title="Estate Sales Near You"
            subtitle="In-person sales — browse all 8 platforms in one place"
            href="/estate-sales"
            linkLabel="Find estate sales →"
          />
          <ListingGrid listings={estateSales} showAds={false} />
        </section>
      )}

      {/* ── Recent Listings fallback (shown when time-filtered sections are empty) */}
      {recentFallback.length > 0 && (
        <section className="mb-14">
          <SectionHeader
            icon={<Package className="w-5 h-5 text-antique-accent" />}
            title="Recent Listings"
            subtitle={`${recentFallback.length} listings from all platforms`}
            href="/search"
            linkLabel="Browse all"
          />
          <ListingGrid listings={recentFallback} />
        </section>
      )}

      {/* ── Map CTA ───────────────────────────────────────────────────────────── */}
      <section className="mb-14">
        <Link
          href="/map"
          className="flex flex-col sm:flex-row items-center justify-between gap-4 antique-card p-6 hover:border-antique-accent hover:shadow-md transition-all group"
        >
          <div>
            <p className="font-display text-lg font-bold text-antique-text group-hover:text-antique-accent transition-colors">
              Find Sales Near You
            </p>
            <p className="text-sm text-antique-text-sec mt-1">
              Browse the interactive map to discover estate sales and auctions in your area.
            </p>
          </div>
          <span className="px-5 py-2.5 bg-antique-accent text-white rounded-lg text-sm font-semibold hover:bg-antique-accent-h transition-colors whitespace-nowrap">
            Open Map →
          </span>
        </Link>
      </section>

    </div>
  );
}

// ── Section header component ──────────────────────────────────────────────────

function SectionHeader({
  icon,
  title,
  subtitle,
  href,
  linkLabel,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-2.5">
        {icon}
        <h2
          className="font-display text-xl font-bold text-antique-text"
          dangerouslySetInnerHTML={{ __html: title }}
        />
        {subtitle && (
          <span className="text-sm text-antique-text-mute font-body hidden sm:inline">
            — {subtitle}
          </span>
        )}
      </div>
      <Link
        href={href}
        className="text-antique-accent text-sm hover:text-antique-accent-h font-medium transition-colors"
      >
        {linkLabel} →
      </Link>
    </div>
  );
}
