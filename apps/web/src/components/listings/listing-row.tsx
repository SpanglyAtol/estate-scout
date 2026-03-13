"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { MapPin, Clock, Hammer, ShoppingBag, Truck } from "lucide-react";
import type { Listing } from "@/types";
import { formatPrice, timeUntil, formatDistance, getAuctionStatus } from "@/lib/format";
import { cn } from "@/lib/cn";

const PLATFORM_COLORS: Record<string, string> = {
  liveauctioneers: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  estatesales_net:  "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  hibid:            "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  maxsold:          "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
  bidspotter:       "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
};

function RowPrice({ listing }: { listing: Listing }) {
  const lt = listing.listing_type ?? "auction";

  if (lt === "estate_sale") {
    const start = listing.sale_starts_at ? new Date(listing.sale_starts_at) : null;
    const end   = listing.sale_ends_at   ? new Date(listing.sale_ends_at)   : null;
    const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const range =
      start && end
        ? start.toDateString() === end.toDateString()
          ? fmt(start)
          : `${fmt(start)}–${fmt(end)}`
        : start ? fmt(start) : "TBD";
    return <span className="text-sm font-bold text-antique-accent whitespace-nowrap">{range}</span>;
  }
  if (lt === "buy_now" && listing.buy_now_price != null) {
    return <span className="text-sm font-bold text-antique-accent whitespace-nowrap">{formatPrice(listing.buy_now_price)}</span>;
  }
  if (listing.current_price != null) {
    return <span className="text-sm font-bold text-antique-accent whitespace-nowrap">{formatPrice(listing.current_price)}</span>;
  }
  if (listing.estimate_low != null) {
    return (
      <span className="text-sm font-semibold text-antique-text-sec whitespace-nowrap">
        Est. {formatPrice(listing.estimate_low)}+
      </span>
    );
  }
  return <span className="text-xs text-antique-text-mute italic">No price</span>;
}

export function ListingRow({ listing }: { listing: Listing }) {
  const [mounted, setMounted] = useState(false);
  const [imgError, setImgError] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const lt       = listing.listing_type ?? "auction";
  const status   = mounted ? getAuctionStatus(listing) : (listing.auction_status ?? "unknown");
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
        "group flex items-center gap-3 bg-antique-surface border border-antique-border rounded-xl p-3",
        "hover:border-antique-accent hover:shadow-sm transition-all duration-200",
        listing.is_sponsored && "ring-1 ring-amber-400",
        isEnded && lt === "auction" && "opacity-60",
      )}
    >
      {/* Thumbnail */}
      <div className="relative w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-antique-muted">
        {listing.primary_image_url && !imgError ? (
          <Image
            src={listing.primary_image_url}
            alt={listing.title}
            fill
            unoptimized
            className={cn("object-cover", isEnded && lt === "auction" && "grayscale")}
            sizes="64px"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xl text-antique-text-mute">
            {lt === "estate_sale" ? "🏡" : lt === "buy_now" ? "🛍️" : "🏺"}
          </div>
        )}
        {listing.is_sponsored && (
          <div className="absolute inset-0 bg-amber-400/10" />
        )}
      </div>

      {/* Main info — grows to fill */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-antique-text line-clamp-1 leading-snug">
          {listing.is_sponsored && (
            <span className="inline-block bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 text-[10px] font-semibold px-1.5 py-0.5 rounded mr-1.5 align-middle">
              Sponsored
            </span>
          )}
          {listing.title}
        </p>

        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-medium", platformColor)}>
            {listing.platform.display_name}
          </span>

          {listing.city && (
            <span className="text-xs text-antique-text-mute flex items-center gap-0.5">
              <MapPin className="w-3 h-3" />
              {listing.city}, {listing.state}
              {listing.distance_miles !== undefined && (
                <span className="ml-0.5">· {formatDistance(listing.distance_miles)}</span>
              )}
            </span>
          )}

          {lt === "auction" && listing.items && listing.items.length > 0 && (
            <span className="text-xs text-antique-text-mute flex items-center gap-0.5">
              <Hammer className="w-3 h-3" /> {listing.items.length} lots
            </span>
          )}

          {listing.pickup_only && (
            <span className="text-xs text-antique-text-mute flex items-center gap-0.5">
              <Truck className="w-3 h-3" /> Pickup only
            </span>
          )}

          {lt === "buy_now" && (
            <span className="text-xs text-antique-text-mute flex items-center gap-0.5">
              <ShoppingBag className="w-3 h-3" /> Fixed price
            </span>
          )}
        </div>
      </div>

      {/* Price + status — right-aligned */}
      <div className="flex-shrink-0 text-right space-y-0.5 min-w-[80px]">
        <RowPrice listing={listing} />

        {mounted && (
          <>
            {isEndingSoon && countdown && (
              <div className="text-xs text-red-600 font-semibold">{countdown}</div>
            )}
            {isUpcoming && (
              <div className="text-xs text-antique-accent font-medium">Upcoming</div>
            )}
            {isEnded && (
              <div className="text-xs text-antique-text-mute">Ended</div>
            )}
            {!isEndingSoon && !isUpcoming && !isEnded && countdown && (
              <div className="text-xs text-antique-text-mute flex items-center gap-0.5 justify-end">
                <Clock className="w-3 h-3" /> {countdown}
              </div>
            )}
          </>
        )}
      </div>
    </Link>
  );
}
