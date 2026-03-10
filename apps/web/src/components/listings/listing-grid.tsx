"use client";

import { useEffect, useState } from "react";
import type { Listing } from "@/types";
import type { SponsoredListing } from "@/app/api/v1/sponsored/route";
import { ListingCard } from "./listing-card";
import { ListingRow } from "./listing-row";
import { SponsoredCard } from "./sponsored-card";
import { ListingAdBanner } from "@/components/ads/ad-unit";

interface ListingGridProps {
  listings: Listing[];
  emptyMessage?: string;
  /** When true, inserts AdSense banners and sponsored cards (free-tier behavior). */
  showAds?: boolean;
  /** "gallery" = image grid (default), "list" = compact rows */
  viewMode?: "gallery" | "list";
}

// Insert a sponsored card at grid positions 0, 4, 14 (0-indexed after insertion)
const SPONSORED_POSITIONS = [0, 4, 14];
// Insert an AdSense banner after every Nth organic listing
const AD_INTERVAL = 10;
// AdSense slot — pulled from env or falls back to placeholder
const AD_SLOT = process.env.NEXT_PUBLIC_ADSENSE_SLOT_LISTINGS ?? "1234567890";

export function ListingGrid({
  listings,
  emptyMessage = "No listings found. Try adjusting your search.",
  showAds = true,
  viewMode = "gallery",
}: ListingGridProps) {
  const [sponsored, setSponsored] = useState<SponsoredListing[]>([]);

  // Load sponsored listings client-side so they don't block SSR
  useEffect(() => {
    if (!showAds) return;
    fetch("/api/v1/sponsored")
      .then((r) => r.ok ? r.json() : [])
      .then((data: SponsoredListing[]) => setSponsored(data.slice(0, 3)))
      .catch(() => {});
  }, [showAds]);

  if (listings.length === 0) {
    return (
      <div className="text-center py-20 text-antique-text-mute">
        <div className="text-5xl mb-4">🔍</div>
        <p className="text-lg font-medium text-antique-text-sec">{emptyMessage}</p>
        <p className="text-sm mt-2">
          We&apos;re scraping new listings constantly — check back soon.
        </p>
      </div>
    );
  }

  // Build interleaved item array: sponsored cards + organic cards + ad banners
  const items: React.ReactNode[] = [];
  let sponsorIdx = 0;
  let adCount = 0;

  // For list view: no sponsor injection (compact rows don't suit sponsored cards)
  if (viewMode === "list") {
    listings.forEach((listing) => {
      items.push(<ListingRow key={listing.id} listing={listing} />);
    });
    return <div className="flex flex-col gap-2">{items}</div>;
  }

  // Gallery view: inject sponsored cards at designated positions
  listings.forEach((listing, index) => {
    // Inject sponsored card before this organic card if we're at a target position
    if (showAds && sponsored.length > 0) {
      const gridPos = items.length; // current grid slot
      if (SPONSORED_POSITIONS.includes(gridPos) && sponsorIdx < sponsored.length) {
        const sp = sponsored[sponsorIdx++];
        items.push(
          <SponsoredCard key={`sp-${sp.id}`} listing={sp} position={gridPos} />
        );
      }
    }

    items.push(<ListingCard key={listing.id} listing={listing} />);

    // Insert AdSense banner after every AD_INTERVAL organic items
    adCount++;
    if (showAds && adCount % AD_INTERVAL === 0 && index !== listings.length - 1) {
      items.push(<ListingAdBanner key={`ad-${index}`} slot={AD_SLOT} />);
    }
  });

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {items}
    </div>
  );
}
