"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { MapPin, Clock, Truck, Hammer, Tag, ShoppingBag } from "lucide-react";
import type { Listing } from "@/types";
import { formatPrice, timeUntil, formatDistance, getAuctionStatus } from "@/lib/format";
import { categoryToSlug } from "@/lib/category-meta";
import { cn } from "@/lib/cn";

interface ListingCardProps {
  listing: Listing;
  className?: string;
}

const PLATFORM_COLORS: Record<string, string> = {
  liveauctioneers: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  estatesales_net:  "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  hibid:            "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  maxsold:          "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
  bidspotter:       "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
};

// ── Price display: type-aware ─────────────────────────────────────────────────

function CardPrice({ listing }: { listing: Listing }) {
  const lt = listing.listing_type ?? "auction";

  // Estate sale — show date range instead of a price
  if (lt === "estate_sale") {
    const start = listing.sale_starts_at ? new Date(listing.sale_starts_at) : null;
    const end   = listing.sale_ends_at   ? new Date(listing.sale_ends_at)   : null;
    const fmt = (d: Date) =>
      d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const range =
      start && end
        ? start.toDateString() === end.toDateString()
          ? fmt(start)
          : `${fmt(start)} – ${fmt(end)}`
        : start
        ? fmt(start)
        : "Dates TBD";
    return (
      <div className="flex items-baseline gap-1.5">
        <span className="text-base font-bold text-antique-accent">{range}</span>
        <span className="text-xs text-antique-text-mute">in-person</span>
      </div>
    );
  }

  // Buy-now — fixed price
  if (lt === "buy_now" && listing.buy_now_price != null) {
    return (
      <div className="flex items-baseline gap-1.5">
        <span className="text-lg font-bold text-antique-accent">
          {formatPrice(listing.buy_now_price)}
        </span>
        <span className="text-xs text-antique-text-mute">fixed price</span>
      </div>
    );
  }

  // Active bid
  if (listing.current_price != null) {
    return (
      <div className="flex items-center justify-between">
        <span className="text-lg font-bold text-antique-accent">
          {formatPrice(listing.current_price)}
        </span>
        {listing.buyers_premium_pct && (
          <span className="text-xs text-antique-text-mute">+{listing.buyers_premium_pct}% BP</span>
        )}
      </div>
    );
  }

  // Upcoming auction with estimate (no bids yet)
  if (listing.estimate_low != null) {
    const lo = formatPrice(listing.estimate_low);
    const hi = listing.estimate_high != null ? formatPrice(listing.estimate_high) : null;
    return (
      <div className="flex items-baseline gap-1.5">
        <span className="text-base font-bold text-antique-text-sec">
          Est. {lo}{hi ? `–${hi}` : "+"}
        </span>
        <span className="text-xs text-antique-text-mute">lot estimate</span>
      </div>
    );
  }

  // No price info
  return <span className="text-sm text-antique-text-mute italic">No price listed</span>;
}

// ── Main card ─────────────────────────────────────────────────────────────────

export function ListingCard({ listing, className }: ListingCardProps) {
  const [mounted, setMounted] = useState(false);
  const [imgError, setImgError] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const lt = listing.listing_type ?? "auction";

  // Compute status after mounting to avoid SSR/client mismatch on time-based values
  const status    = mounted ? getAuctionStatus(listing) : (listing.auction_status ?? "unknown");
  const countdown = mounted ? timeUntil(listing.sale_ends_at) : null;

  const isEnded      = status === "ended" || status === "completed";
  const isEndingSoon = status === "ending_soon";
  const isUpcoming   = status === "upcoming";

  const platformColor =
    PLATFORM_COLORS[listing.platform.name] ?? "bg-antique-subtle text-antique-text-sec";

  const href = `/listing/${listing.id}?src=${encodeURIComponent(listing.external_url)}`;

  return (
    <Link
      href={href}
      className={cn(
        "group bg-antique-surface rounded-xl overflow-hidden border border-antique-border",
        "hover:shadow-lg hover:border-antique-accent transition-all duration-200",
        listing.is_sponsored && "ring-1 ring-amber-400",
        isEnded && lt === "auction" && "opacity-60",
        className
      )}
    >
      {/* Image */}
      <div className="relative aspect-square bg-antique-muted overflow-hidden">
        {listing.primary_image_url && !imgError ? (
          <Image
            src={listing.primary_image_url}
            alt={listing.title}
            fill
            unoptimized
            className={cn(
              "object-cover group-hover:scale-105 transition-transform duration-300",
              isEnded && lt === "auction" && "grayscale"
            )}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-antique-muted px-3 text-center">
            <span className="text-3xl opacity-40">
              {lt === "estate_sale" ? "🏡" : lt === "buy_now" ? "🛍️" : "🏺"}
            </span>
            <span className="text-[11px] font-semibold text-antique-text-mute uppercase tracking-wider leading-tight">
              {listing.platform.display_name}
            </span>
            {listing.category && (
              <span className="text-[10px] text-antique-text-mute capitalize leading-tight">
                {listing.category}
              </span>
            )}
          </div>
        )}

        {/* Photo count badge for estate sales */}
        {lt === "estate_sale" && listing.image_urls.length > 1 && (
          <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
            {listing.image_urls.length} photos
          </div>
        )}

        {/* Sponsored */}
        {listing.is_sponsored && (
          <div className="absolute top-2 left-2 bg-amber-400 text-amber-900 text-xs font-semibold px-2 py-0.5 rounded">
            Sponsored
          </div>
        )}

        {/* Auction status badges */}
        {mounted && lt === "auction" && (
          <>
            {isEndingSoon && countdown && (
              <div className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded">
                {countdown}
              </div>
            )}
            {isUpcoming && (
              <div className="absolute top-2 right-2 bg-antique-accent text-white text-xs font-bold px-2 py-0.5 rounded">
                Upcoming
              </div>
            )}
            {(status === "ended" || status === "completed") && (
              <div className="absolute top-2 right-2 bg-antique-text-mute text-white text-xs font-bold px-2 py-0.5 rounded">
                {status === "completed" ? "Completed" : "Ended"}
              </div>
            )}
          </>
        )}

        {/* Buy-now badge */}
        {lt === "buy_now" && (
          <div className="absolute top-2 right-2 bg-antique-accent text-white text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1">
            <ShoppingBag className="w-3 h-3" /> Buy Now
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-1.5">
        <p className="text-sm font-medium text-antique-text line-clamp-2 leading-snug">
          {listing.title}
        </p>

        {/* Price row */}
        <CardPrice listing={listing} />

        {/* Total cost hint — auctions with bids only */}
        {lt === "auction" && listing.total_cost_estimate && listing.buyers_premium_pct && (
          <p className="text-xs text-antique-text-mute">
            Total ~{formatPrice(listing.total_cost_estimate)}
          </p>
        )}

        {/* Meta badges row */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Type badge */}
          {lt === "estate_sale" && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
              Estate Sale
            </span>
          )}
          {lt === "buy_now" && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
              Fixed Price
            </span>
          )}

          {/* Sub-category */}
          {listing.sub_category && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-antique-subtle text-antique-text-sec capitalize">
              {listing.sub_category.replace(/_/g, " ")}
            </span>
          )}

          {/* Platform */}
          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", platformColor)}>
            {listing.platform.display_name}
          </span>

          {/* Pickup-only badge */}
          {listing.pickup_only && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 flex items-center gap-0.5">
              <Truck className="w-3 h-3" /> Pickup
            </span>
          )}
        </div>

        {/* Location + distance */}
        {listing.city && (
          <span className="text-xs text-antique-text-mute flex items-center gap-0.5">
            <MapPin className="w-3 h-3" />
            {listing.city}, {listing.state}
            {listing.distance_miles !== undefined && (
              <span className="ml-1">· {formatDistance(listing.distance_miles)}</span>
            )}
          </span>
        )}

        {/* Lots badge */}
        {lt === "auction" && listing.items && listing.items.length > 0 && (
          <span className="text-xs text-antique-accent bg-antique-accent-s px-2 py-0.5 rounded-full flex items-center gap-1 font-medium w-fit">
            <Hammer className="w-3 h-3" />
            {listing.items.length} lots
          </span>
        )}

        {/* Category link — estate sales and all other types */}
        {listing.category && (() => {
          const catSlug = categoryToSlug(listing.category);
          const label = lt === "estate_sale" ? `${listing.category} & more` : listing.category;
          return catSlug ? (
            <Link
              href={`/categories/${catSlug}`}
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-antique-text-mute hover:text-antique-accent flex items-center gap-0.5 capitalize transition-colors w-fit"
            >
              <Tag className="w-3 h-3" /> {label}
            </Link>
          ) : (
            <span className="text-xs text-antique-text-mute flex items-center gap-0.5 capitalize">
              <Tag className="w-3 h-3" /> {label}
            </span>
          );
        })()}

        {/* Auction countdown (live, not ending soon) */}
        {lt === "auction" && countdown && !isEndingSoon && !isUpcoming && !isEnded && (
          <span className="text-xs text-antique-text-mute flex items-center gap-0.5">
            <Clock className="w-3 h-3" /> {countdown} left
          </span>
        )}

        {/* Upcoming auction start */}
        {lt === "auction" && isUpcoming && listing.sale_starts_at && (
          <span className="text-xs text-antique-accent flex items-center gap-0.5">
            <Clock className="w-3 h-3" />
            Starts {new Date(listing.sale_starts_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
        )}
      </div>
    </Link>
  );
}
