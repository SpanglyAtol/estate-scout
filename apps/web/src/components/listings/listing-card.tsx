"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { MapPin, Clock, Truck, Hammer, Tag, ShoppingBag } from "lucide-react";
import type { Listing } from "@/types";
import { formatPrice, timeUntil, formatDistance, getAuctionStatus } from "@/lib/format";
import { cn } from "@/lib/cn";

interface ListingCardProps {
  listing: Listing;
  className?: string;
}

const PLATFORM_COLORS: Record<string, string> = {
  liveauctioneers: "bg-orange-100 text-orange-800",
  estatesales_net:  "bg-green-100 text-green-800",
  hibid:            "bg-purple-100 text-purple-800",
  maxsold:          "bg-blue-100 text-blue-800",
  bidspotter:       "bg-teal-100 text-teal-800",
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
        <span className="text-base font-bold text-green-700">{range}</span>
        <span className="text-xs text-gray-400">in-person</span>
      </div>
    );
  }

  // Buy-now — fixed price
  if (lt === "buy_now" && listing.buy_now_price != null) {
    return (
      <div className="flex items-baseline gap-1.5">
        <span className="text-lg font-bold text-green-600">
          {formatPrice(listing.buy_now_price)}
        </span>
        <span className="text-xs text-gray-400">fixed price</span>
      </div>
    );
  }

  // Active bid
  if (listing.current_price != null) {
    return (
      <div className="flex items-center justify-between">
        <span className="text-lg font-bold text-blue-600">
          {formatPrice(listing.current_price)}
        </span>
        {listing.buyers_premium_pct && (
          <span className="text-xs text-gray-500">+{listing.buyers_premium_pct}% BP</span>
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
        <span className="text-base font-bold text-amber-600">
          Est. {lo}{hi ? `–${hi}` : "+"}
        </span>
        <span className="text-xs text-gray-400">lot estimate</span>
      </div>
    );
  }

  // No price info
  return <span className="text-sm text-gray-400 italic">No price listed</span>;
}

// ── Main card ─────────────────────────────────────────────────────────────────

export function ListingCard({ listing, className }: ListingCardProps) {
  const [mounted, setMounted] = useState(false);
  const [imgError, setImgError] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const lt = listing.listing_type ?? "auction";

  // Compute status after mounting to avoid SSR/client mismatch on time-based values
  const status   = mounted ? getAuctionStatus(listing) : (listing.auction_status ?? "unknown");
  const countdown = mounted ? timeUntil(listing.sale_ends_at) : null;

  const isEnded      = status === "ended" || status === "completed";
  const isEndingSoon = status === "ending_soon";
  const isUpcoming   = status === "upcoming";

  const platformColor =
    PLATFORM_COLORS[listing.platform.name] ?? "bg-gray-100 text-gray-800";

  return (
    <Link
      href={`/listing/${listing.id}`}
      className={cn(
        "group bg-white rounded-xl overflow-hidden border border-gray-200",
        "hover:shadow-lg hover:border-blue-300 transition-all duration-200",
        listing.is_sponsored && "ring-1 ring-amber-400",
        isEnded && lt === "auction" && "opacity-60",
        className
      )}
    >
      {/* Image */}
      <div className="relative aspect-square bg-gray-100 overflow-hidden">
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
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-4xl">
            {lt === "estate_sale" ? "🏡" : lt === "buy_now" ? "🛍️" : "🏺"}
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
              <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded">
                Upcoming
              </div>
            )}
            {status === "ended" && (
              <div className="absolute top-2 right-2 bg-gray-500 text-white text-xs font-bold px-2 py-0.5 rounded">
                Ended
              </div>
            )}
            {status === "completed" && (
              <div className="absolute top-2 right-2 bg-gray-500 text-white text-xs font-bold px-2 py-0.5 rounded">
                Completed
              </div>
            )}
          </>
        )}

        {/* Buy-now badge */}
        {lt === "buy_now" && (
          <div className="absolute top-2 right-2 bg-green-600 text-white text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1">
            <ShoppingBag className="w-3 h-3" /> Buy Now
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-1.5">
        <p className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug">
          {listing.title}
        </p>

        {/* Price row */}
        <CardPrice listing={listing} />

        {/* Total cost hint — auctions with bids only */}
        {lt === "auction" && listing.total_cost_estimate && listing.buyers_premium_pct && (
          <p className="text-xs text-gray-500">
            Total ~{formatPrice(listing.total_cost_estimate)}
          </p>
        )}

        {/* Meta badges row */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Type badge */}
          {lt === "estate_sale" && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-800">
              Estate Sale
            </span>
          )}
          {lt === "buy_now" && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700">
              Fixed Price
            </span>
          )}

          {/* Platform */}
          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", platformColor)}>
            {listing.platform.display_name}
          </span>

          {/* Pickup-only badge */}
          {listing.pickup_only && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-800 flex items-center gap-0.5">
              <Truck className="w-3 h-3" /> Pickup
            </span>
          )}
        </div>

        {/* Location + distance */}
        {listing.city && (
          <span className="text-xs text-gray-500 flex items-center gap-0.5">
            <MapPin className="w-3 h-3" />
            {listing.city}, {listing.state}
            {listing.distance_miles !== undefined && (
              <span className="ml-1 text-gray-400">
                · {formatDistance(listing.distance_miles)}
              </span>
            )}
          </span>
        )}

        {/* Lots badge */}
        {lt === "auction" && listing.items && listing.items.length > 0 && (
          <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full flex items-center gap-1 font-medium w-fit">
            <Hammer className="w-3 h-3" />
            {listing.items.length} lots
          </span>
        )}

        {/* Estate sale category hint */}
        {lt === "estate_sale" && listing.category && (
          <span className="text-xs text-gray-500 flex items-center gap-0.5 capitalize">
            <Tag className="w-3 h-3" /> {listing.category} & more
          </span>
        )}

        {/* Auction countdown (live, not ending soon) */}
        {lt === "auction" && countdown && !isEndingSoon && !isUpcoming && !isEnded && (
          <span className="text-xs text-gray-400 flex items-center gap-0.5">
            <Clock className="w-3 h-3" /> {countdown} left
          </span>
        )}

        {/* Upcoming auction start */}
        {lt === "auction" && isUpcoming && listing.sale_starts_at && (
          <span className="text-xs text-blue-600 flex items-center gap-0.5">
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
