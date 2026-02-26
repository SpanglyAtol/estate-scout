"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { MapPin, Clock, Truck } from "lucide-react";
import type { Listing } from "@/types";
import { formatPrice, timeUntil, formatDistance } from "@/lib/format";
import { cn } from "@/lib/cn";

interface ListingCardProps {
  listing: Listing;
  className?: string;
}

const PLATFORM_COLORS: Record<string, string> = {
  liveauctioneers: "bg-orange-100 text-orange-800",
  estatesales_net: "bg-green-100 text-green-800",
  hibid: "bg-purple-100 text-purple-800",
  maxsold: "bg-blue-100 text-blue-800",
  bidspotter: "bg-teal-100 text-teal-800",
};

export function ListingCard({ listing, className }: ListingCardProps) {
  const [mounted, setMounted] = useState(false);
  const [imgError, setImgError] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Only compute time-based values after mounting to avoid SSR/client mismatch
  const countdown = mounted ? timeUntil(listing.sale_ends_at) : null;
  const isEndingSoon =
    mounted &&
    listing.sale_ends_at &&
    new Date(listing.sale_ends_at).getTime() - Date.now() < 24 * 3_600_000;

  const platformColor =
    PLATFORM_COLORS[listing.platform.name] ?? "bg-gray-100 text-gray-800";

  return (
    <Link
      href={`/listing/${listing.id}`}
      className={cn(
        "group bg-white rounded-xl overflow-hidden border border-gray-200",
        "hover:shadow-lg hover:border-blue-300 transition-all duration-200",
        listing.is_sponsored && "ring-1 ring-amber-400",
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
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-4xl">
            🏺
          </div>
        )}

        {/* Sponsored badge */}
        {listing.is_sponsored && (
          <div className="absolute top-2 left-2 bg-amber-400 text-amber-900 text-xs font-semibold px-2 py-0.5 rounded">
            Sponsored
          </div>
        )}

        {/* Ending soon badge */}
        {isEndingSoon && countdown && (
          <div className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded">
            {countdown}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-1.5">
        <p className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug">
          {listing.title}
        </p>

        {/* Price row */}
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold text-blue-600">
            {formatPrice(listing.current_price)}
          </span>
          {listing.buyers_premium_pct && (
            <span className="text-xs text-gray-500">
              +{listing.buyers_premium_pct}% BP
            </span>
          )}
        </div>

        {/* Total cost hint */}
        {listing.total_cost_estimate && listing.buyers_premium_pct && (
          <p className="text-xs text-gray-500">
            Total ~{formatPrice(listing.total_cost_estimate)}
          </p>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", platformColor)}>
            {listing.platform.display_name}
          </span>

          {listing.city && (
            <span className="text-xs text-gray-500 flex items-center gap-0.5">
              <MapPin className="w-3 h-3" />
              {listing.city}, {listing.state}
            </span>
          )}

          {listing.distance_miles !== undefined && (
            <span className="text-xs text-gray-500">
              {formatDistance(listing.distance_miles)}
            </span>
          )}
        </div>

        {/* Fulfillment */}
        {listing.pickup_only && (
          <span className="text-xs text-amber-700 flex items-center gap-0.5">
            <Truck className="w-3 h-3" /> Pickup only
          </span>
        )}

        {/* Countdown (not ending soon) */}
        {countdown && !isEndingSoon && (
          <span className="text-xs text-gray-400 flex items-center gap-0.5">
            <Clock className="w-3 h-3" /> {countdown} left
          </span>
        )}
      </div>
    </Link>
  );
}
