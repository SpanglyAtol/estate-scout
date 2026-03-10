"use client";

import { useState, useMemo } from "react";
import {
  MapPin, Search, ExternalLink, Calendar, Clock,
  Building2, Star, ChevronRight,
} from "lucide-react";
import { mockEstateSales, type MockEstateSale } from "@/app/api/v1/_mock-data";
import { AdUnit } from "@/components/ads/ad-unit";
import { trackAffiliateClick } from "@/lib/analytics";

const ESTATE_PREP_TAG = process.env.NEXT_PUBLIC_AMAZON_ASSOCIATES_TAG;
const ESTATE_PREP_LINKS = [
  { label: "Packing & moving supplies", keywords: "moving boxes packing supplies" },
  { label: "Storage & organization",    keywords: "storage bins closet organizers" },
  { label: "Cleaning & restoration",    keywords: "cleaning restoration kit antique" },
];

function buildAmazonUrl(keywords: string): string {
  if (!ESTATE_PREP_TAG) return "#";
  return `https://www.amazon.com/s?${new URLSearchParams({ k: keywords, tag: ESTATE_PREP_TAG, linkCode: "ure" })}`;
}

// ── Platform directory ─────────────────────────────────────────────────────────

const PLATFORMS = [
  {
    name: "EstateSales.NET",
    description: "Largest US estate sale directory. Browse by city.",
    url: "https://www.estatesales.net/WA/Seattle",
    color: "blue",
    emoji: "🏡",
  },
  {
    name: "EstateSales.org",
    description: "Nationwide sale listings with 'near me' search.",
    url: "https://estatesales.org/estate-sales-near-me",
    color: "indigo",
    emoji: "📦",
  },
  {
    name: "gsalr.com",
    description: "Map-based estate sale finder across the whole US.",
    url: "https://www.gsalr.com/",
    color: "violet",
    emoji: "🗺️",
  },
  {
    name: "Facebook Marketplace",
    description: "Neighborhood estate and garage sales posted daily.",
    url: "https://www.facebook.com/marketplace/search/?q=estate+sale",
    color: "sky",
    emoji: "👥",
  },
  {
    name: "MaxSold",
    description: "Online-only estate auctions with local pickup.",
    url: "https://maxsold.com/auctions",
    color: "amber",
    emoji: "🔨",
  },
  {
    name: "HiBid",
    description: "Live and timed auctions from local auction houses.",
    url: "https://hibid.com/auctions",
    color: "orange",
    emoji: "🏷️",
  },
  {
    name: "Craigslist",
    description: "Local garage and estate sales posted by owners.",
    url: "https://seattle.craigslist.org/search/sss?query=estate+sale",
    color: "green",
    emoji: "📋",
  },
  {
    name: "Nextdoor",
    description: "Hyper-local neighborhood sales posted by neighbors.",
    url: "https://nextdoor.com/find-nearby/",
    color: "teal",
    emoji: "🏘️",
  },
];

// Platform card color scheme
const cardColors: Record<string, { bg: string; border: string; btn: string }> = {
  blue:   { bg: "bg-blue-50",   border: "border-blue-100",   btn: "bg-blue-600 hover:bg-blue-700" },
  indigo: { bg: "bg-indigo-50", border: "border-indigo-100", btn: "bg-indigo-600 hover:bg-indigo-700" },
  violet: { bg: "bg-violet-50", border: "border-violet-100", btn: "bg-violet-600 hover:bg-violet-700" },
  sky:    { bg: "bg-sky-50",    border: "border-sky-100",    btn: "bg-sky-600 hover:bg-sky-700" },
  amber:  { bg: "bg-amber-50",  border: "border-amber-100",  btn: "bg-amber-600 hover:bg-amber-700" },
  orange: { bg: "bg-orange-50", border: "border-orange-100", btn: "bg-orange-600 hover:bg-orange-700" },
  green:  { bg: "bg-green-50",  border: "border-green-100",  btn: "bg-green-600 hover:bg-green-700" },
  teal:   { bg: "bg-teal-50",   border: "border-teal-100",   btn: "bg-teal-600 hover:bg-teal-700" },
};

// Sale card platform badge colors
const badgeColors: Record<string, { bg: string; text: string }> = {
  "estatesales.net":  { bg: "bg-blue-100",   text: "text-blue-700" },
  "estatesales.org":  { bg: "bg-indigo-100", text: "text-indigo-700" },
  "maxsold":          { bg: "bg-amber-100",  text: "text-amber-700" },
  "hibid":            { bg: "bg-orange-100", text: "text-orange-700" },
  "facebook":         { bg: "bg-sky-100",    text: "text-sky-700" },
  "craigslist":       { bg: "bg-green-100",  text: "text-green-700" },
  "nextdoor":         { bg: "bg-teal-100",   text: "text-teal-700" },
  "gsalr":            { bg: "bg-violet-100", text: "text-violet-700" },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function daysUntil(iso: string): string {
  const diff = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return `In ${diff} days`;
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function EstateSalesPage() {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return mockEstateSales;
    return mockEstateSales.filter(
      (s) =>
        s.city.toLowerCase().includes(q) ||
        s.neighborhood.toLowerCase().includes(q) ||
        s.zip_code.includes(q) ||
        s.state.toLowerCase().includes(q) ||
        s.title.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <div className="container mx-auto px-4 py-10 max-w-6xl">

      {/* ── Hero ── */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-sm font-semibold px-4 py-1.5 rounded-full mb-4">
          <MapPin className="w-4 h-4" />
          8 Platforms · One Place
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-3">
          Find Local Estate Sales Near You
        </h1>
        <p className="text-gray-500 text-lg max-w-2xl mx-auto mb-8">
          Browse upcoming estate sales and in-person auctions across EstateSales.net,
          MaxSold, HiBid, Facebook Marketplace, Craigslist, Nextdoor, and more — all in one place.
        </p>

        {/* Location filter */}
        <div className="relative max-w-md mx-auto">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by city, zip code, or neighborhood…"
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-sm shadow-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* ── Top ad placement: AdSense + estate-prep affiliate strip ── */}
      <AdUnit slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_ESTATE ?? ""} format="rectangle" className="mb-6" />
      {ESTATE_PREP_TAG && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mb-10 px-4 py-2.5 bg-antique-surface border border-antique-border rounded-xl text-sm">
          <span className="text-antique-text-mute text-[11px] uppercase tracking-widest shrink-0 font-medium">
            Sponsored
          </span>
          {ESTATE_PREP_LINKS.map((link) => {
            const url = buildAmazonUrl(link.keywords);
            return (
              <a
                key={link.keywords}
                href={url}
                target="_blank"
                rel="noopener noreferrer sponsored"
                onClick={() => trackAffiliateClick({ category: "estate_sale", keywords: link.keywords, url })}
                className="text-antique-accent hover:text-antique-accent-h hover:underline transition-colors font-medium"
              >
                {link.label}
              </a>
            );
          })}
          <span className="ml-auto text-antique-text-mute text-[11px] shrink-0">via Amazon ↗</span>
        </div>
      )}

      {/* ── Browse by Platform ── */}
      <section className="mb-14">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-gray-900">Browse by Platform</h2>
          <span className="text-sm text-gray-400 hidden sm:block">Opens the source site in a new tab</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {PLATFORMS.map((p) => {
            const c = cardColors[p.color];
            return (
              <a
                key={p.name}
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`rounded-2xl border p-4 flex flex-col gap-3 transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 ${c.bg} ${c.border}`}
              >
                <span className="text-2xl" aria-hidden="true">{p.emoji}</span>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 text-sm leading-tight">{p.name}</p>
                  <p className="text-xs text-gray-500 mt-1 leading-snug">{p.description}</p>
                </div>
                <span
                  className={`inline-flex items-center gap-1 text-xs font-semibold text-white px-3 py-1.5 rounded-lg self-start transition-colors ${c.btn}`}
                >
                  Browse <ExternalLink className="w-3 h-3" />
                </span>
              </a>
            );
          })}
        </div>
      </section>

      {/* ── Upcoming Sales Grid ── */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-gray-900">
            Upcoming Sales
            {query.trim() && (
              <span className="ml-2 text-sm font-normal text-gray-400">
                — {filtered.length} result{filtered.length !== 1 ? "s" : ""} for &ldquo;{query}&rdquo;
              </span>
            )}
          </h2>
          <span className="text-sm text-gray-400 hidden sm:block">{mockEstateSales.length} sales loaded</span>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <MapPin className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-semibold text-gray-600">No sales found for &ldquo;{query}&rdquo;</p>
            <p className="text-sm mt-1">Try a different city, zip, or neighborhood</p>
            <button
              onClick={() => setQuery("")}
              className="mt-4 text-sm text-blue-600 hover:underline"
            >
              Clear filter
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((sale) => (
              <SaleCard key={sale.id} sale={sale} />
            ))}
          </div>
        )}
      </section>

      {/* ── Footer note ── */}
      <p className="text-center text-xs text-gray-400 mt-12">
        Demo data for the Seattle metro area.{" "}
        <span className="text-gray-500 font-medium">
          Live nationwide data coming soon — we&apos;re building scrapers for all 8 platforms.
        </span>
      </p>
    </div>
  );
}

// ── Sale Card ──────────────────────────────────────────────────────────────────

function SaleCard({ sale }: { sale: MockEstateSale }) {
  const badge = badgeColors[sale.platform] ?? { bg: "bg-gray-100", text: "text-gray-600" };
  const startLabel = daysUntil(sale.starts_at);
  const isSoon = startLabel === "Today" || startLabel === "Tomorrow";

  return (
    <article className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">
      {/* Preview image */}
      <div className="relative h-44 bg-gray-100 flex-shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={sale.preview_image_url}
          alt={sale.title}
          className="w-full h-full object-cover"
        />
        {sale.is_featured && (
          <div className="absolute top-2 left-2 flex items-center gap-1 bg-amber-400 text-amber-900 text-xs font-bold px-2.5 py-0.5 rounded-full shadow">
            <Star className="w-3 h-3" /> Featured
          </div>
        )}
        {isSoon && (
          <div className="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold px-2.5 py-0.5 rounded-full shadow">
            {startLabel}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col gap-2 flex-1">
        {/* Platform + item count */}
        <div className="flex items-center justify-between">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`}>
            {sale.platform_display}
          </span>
          <span className="text-xs text-gray-400">{sale.item_count_est.toLocaleString()}+ items</span>
        </div>

        {/* Title */}
        <h3 className="font-bold text-gray-900 text-sm leading-snug line-clamp-2">
          {sale.title}
        </h3>

        {/* Company */}
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="line-clamp-1">{sale.company}</span>
        </div>

        {/* Location */}
        <div className="flex items-start gap-1.5 text-xs text-gray-500">
          <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>{sale.neighborhood} · {sale.city}, {sale.state} {sale.zip_code}</span>
        </div>

        {/* Dates */}
        <div className="flex items-center gap-1.5 text-xs">
          <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <span className="font-semibold text-gray-700">{startLabel}</span>
          <span className="text-gray-300">·</span>
          <span className="text-gray-500">{fmtDate(sale.starts_at)}–{fmtDate(sale.ends_at)}</span>
        </div>

        {/* Hours */}
        <div className="flex items-start gap-1.5 text-xs text-gray-400">
          <Clock className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>{sale.hours}</span>
        </div>

        {/* Category tags */}
        <div className="flex flex-wrap gap-1 mt-1">
          {sale.categories.slice(0, 4).map((cat) => (
            <span
              key={cat}
              className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full"
            >
              {cat}
            </span>
          ))}
        </div>

        {/* View CTA */}
        <a
          href={sale.platform_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-auto pt-3 flex items-center justify-center gap-1.5 w-full text-sm font-semibold text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 hover:bg-blue-50 rounded-xl py-2.5 transition-colors"
        >
          View Full Sale <ChevronRight className="w-4 h-4" />
        </a>
      </div>
    </article>
  );
}
