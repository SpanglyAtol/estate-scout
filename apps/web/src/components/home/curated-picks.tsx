"use client";

import Link from "next/link";
import Image from "next/image";
import { Sparkles, TrendingUp, Star, Gem, BookOpen, Tag } from "lucide-react";
import { useEffect, useState } from "react";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/cn";

interface CuratedListing {
  id: number;
  title: string;
  primary_image_url: string | null;
  current_price: number | null;
  buy_now_price: number | null;
  estimate_low: number | null;
  category: string | null;
  city: string | null;
  state: string | null;
  curatorial_note: string;
  featured_reason: string;
  platform: { display_name: string };
  sale_ends_at: string | null;
}

interface CuratedData {
  generated_at: string | null;
  featured: CuratedListing[];
  category_picks: Record<string, CuratedListing[]>;
  total_live_listings: number;
}

const REASON_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  rare_find:              { label: "Rare Find",              icon: <Gem     className="w-3 h-3" />, color: "text-violet-600 bg-violet-50 border-violet-200 dark:bg-violet-900/20 dark:text-violet-300" },
  great_value:            { label: "Great Value",            icon: <Tag     className="w-3 h-3" />, color: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300" },
  exceptional_quality:    { label: "Exceptional Quality",    icon: <Star    className="w-3 h-3" />, color: "text-antique-accent bg-antique-accent-s border-antique-accent-lt" },
  historically_significant:{ label: "Historically Significant", icon: <BookOpen className="w-3 h-3" />, color: "text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300" },
  trending_category:      { label: "Trending",               icon: <TrendingUp className="w-3 h-3" />, color: "text-sky-600 bg-sky-50 border-sky-200 dark:bg-sky-900/20 dark:text-sky-300" },
  unique_provenance:      { label: "Unique Provenance",      icon: <Gem     className="w-3 h-3" />, color: "text-rose-600 bg-rose-50 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300" },
};

function getPrice(l: CuratedListing): string | null {
  const p = l.current_price ?? l.buy_now_price ?? l.estimate_low;
  return p != null ? formatPrice(p) : null;
}

function CuratedCard({ listing }: { listing: CuratedListing }) {
  const [imgErr, setImgErr] = useState(false);
  const reason = REASON_META[listing.featured_reason] ?? REASON_META.exceptional_quality;
  const price  = getPrice(listing);

  return (
    <Link
      href={`/listing/${listing.id}`}
      className="group flex flex-col bg-antique-surface border border-antique-border rounded-xl overflow-hidden hover:border-antique-accent hover:shadow-lg transition-all duration-200"
    >
      {/* Image */}
      <div className="relative aspect-[4/3] bg-antique-muted overflow-hidden">
        {listing.primary_image_url && !imgErr ? (
          <Image
            src={listing.primary_image_url}
            alt={listing.title}
            fill unoptimized
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            onError={() => setImgErr(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl text-antique-text-mute">🏺</div>
        )}

        {/* Reason badge */}
        <div className={cn(
          "absolute top-2 left-2 flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border",
          reason.color
        )}>
          {reason.icon}
          {reason.label}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1 gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-antique-accent mb-0.5">
            {listing.category || listing.platform.display_name}
          </p>
          <h3 className="font-display font-bold text-antique-text text-sm leading-snug line-clamp-2">
            {listing.title}
          </h3>
        </div>

        {/* Curatorial note */}
        <p className="text-xs text-antique-text-sec leading-relaxed line-clamp-3 italic flex-1">
          &ldquo;{listing.curatorial_note}&rdquo;
        </p>

        {/* Footer: price + location */}
        <div className="flex items-center justify-between pt-1 border-t border-antique-border">
          {price ? (
            <span className="text-sm font-bold text-antique-accent">{price}</span>
          ) : (
            <span className="text-xs text-antique-text-mute italic">No price listed</span>
          )}
          {(listing.city || listing.state) && (
            <span className="text-xs text-antique-text-mute">
              {[listing.city, listing.state].filter(Boolean).join(", ")}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export function CuratedPicks() {
  const [data, setData]     = useState<CuratedData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/recommendations")
      .then((r) => r.json())
      .then((d: CuratedData) => {
        if (d.featured?.length > 0) setData(d);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data || data.featured.length === 0) return null;

  const age = data.generated_at
    ? Math.round((Date.now() - new Date(data.generated_at).getTime()) / 60_000)
    : null;

  return (
    <section className="mb-14">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-5 h-5 text-antique-accent" />
          <h2 className="font-display text-xl font-bold text-antique-text">
            Curator&rsquo;s Picks
          </h2>
          <span className="text-sm text-antique-text-mute font-body hidden sm:inline">
            — AI-selected standouts from {data.total_live_listings.toLocaleString()} live listings
          </span>
        </div>

        <div className="flex items-center gap-3">
          {age !== null && (
            <span className="text-xs text-antique-text-mute hidden sm:inline">
              Updated {age < 60 ? `${age}m ago` : `${Math.round(age / 60)}h ago`}
            </span>
          )}
          <Link
            href="/search"
            className="text-antique-accent text-sm hover:text-antique-accent-h font-medium transition-colors"
          >
            Browse all →
          </Link>
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {data.featured.slice(0, 8).map((listing) => (
          <CuratedCard key={listing.id} listing={listing} />
        ))}
      </div>

      {/* Category picks strip (if any categories populated) */}
      {Object.keys(data.category_picks).length > 0 && (
        <div className="mt-8">
          <div className="ornament-divider mb-6 text-xs text-antique-text-mute tracking-widest uppercase">
            Top Picks by Category
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {Object.entries(data.category_picks)
              .slice(0, 6)
              .map(([cat, items]) => items[0] && (
                <Link
                  key={cat}
                  href={`/search?category=${encodeURIComponent(cat)}`}
                  className="group flex flex-col items-center gap-2 p-3 antique-card hover:border-antique-accent transition-all text-center"
                >
                  <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-antique-muted flex-shrink-0">
                    {items[0].primary_image_url ? (
                      <Image
                        src={items[0].primary_image_url}
                        alt={cat}
                        fill unoptimized
                        className="object-cover group-hover:scale-105 transition-transform"
                        sizes="64px"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xl text-antique-text-mute">🏺</div>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-antique-text capitalize leading-tight">{cat}</p>
                  <p className="text-[10px] text-antique-text-mute">{items.length} pick{items.length !== 1 ? "s" : ""}</p>
                </Link>
              ))}
          </div>
        </div>
      )}
    </section>
  );
}
