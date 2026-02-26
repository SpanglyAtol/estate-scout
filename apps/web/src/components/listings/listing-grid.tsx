import type { Listing } from "@/types";
import { ListingCard } from "./listing-card";
import { ListingAdBanner } from "@/components/ads/ad-unit";

interface ListingGridProps {
  listings: Listing[];
  emptyMessage?: string;
  /** When true, inserts ad banners every AD_INTERVAL items (free-tier behavior). */
  showAds?: boolean;
}

const AD_INTERVAL = 10; // insert ad after every 10th listing
const AD_SLOT = "1234567890"; // replace with real AdSense slot ID

export function ListingGrid({
  listings,
  emptyMessage = "No listings found. Try adjusting your search.",
  showAds = true,
}: ListingGridProps) {
  if (listings.length === 0) {
    return (
      <div className="text-center py-20 text-gray-500">
        <div className="text-5xl mb-4">🔍</div>
        <p className="text-lg font-medium">{emptyMessage}</p>
        <p className="text-sm mt-2">
          We&apos;re scraping new listings constantly — check back soon.
        </p>
      </div>
    );
  }

  // Build rows interleaved with ad banners
  const items: React.ReactNode[] = [];
  listings.forEach((listing, index) => {
    items.push(<ListingCard key={listing.id} listing={listing} />);
    // Insert ad banner after every AD_INTERVAL items (but not after the last item)
    if (showAds && (index + 1) % AD_INTERVAL === 0 && index !== listings.length - 1) {
      items.push(<ListingAdBanner key={`ad-${index}`} slot={AD_SLOT} />);
    }
  });

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {items}
    </div>
  );
}
