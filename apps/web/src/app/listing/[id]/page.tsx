import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, MapPin, Clock, Truck, Tag, AlertTriangle, Calendar } from "lucide-react";
import { getListing } from "@/lib/api-client";
import { formatPrice, timeUntil, formatDate, getAuctionStatus } from "@/lib/format";
import { AmazonAssociates } from "@/components/ads/amazon-associates";
import { ListingImages } from "@/components/listings/listing-images";
import { ItemsGrid } from "@/components/listings/items-grid";

// Always fetch fresh scraped data on each visit
export const dynamic = "force-dynamic";

interface PageProps {
  params: { id: string };
}

export default async function ListingPage({ params }: PageProps) {
  const id = Number(params.id);
  if (isNaN(id)) notFound();

  let listing;
  try {
    listing = await getListing(id);
  } catch {
    notFound();
  }

  const status = getAuctionStatus(listing);
  const countdown = timeUntil(listing.sale_ends_at);
  const platform = listing.platform.display_name;

  // CTA configuration based on status
  const ctaConfig = {
    upcoming: {
      label: `Preview on ${platform} →`,
      className:
        "flex items-center justify-center gap-2 w-full border-2 border-gray-300 text-gray-700 bg-white py-4 rounded-xl font-bold text-lg hover:border-gray-400 transition-colors",
    },
    live: {
      label: `Bid on ${platform}`,
      className:
        "flex items-center justify-center gap-2 w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 transition-colors",
    },
    ending_soon: {
      label: `Bid Now — Ending Soon!`,
      className:
        "flex items-center justify-center gap-2 w-full bg-red-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-red-700 transition-colors animate-pulse",
    },
    ended: {
      label: `View Results on ${platform} →`,
      className:
        "flex items-center justify-center gap-2 w-full border-2 border-gray-300 text-gray-500 bg-gray-50 py-4 rounded-xl font-bold text-lg hover:border-gray-400 transition-colors",
    },
    completed: {
      label: `View Results on ${platform} →`,
      className:
        "flex items-center justify-center gap-2 w-full border-2 border-gray-300 text-gray-500 bg-gray-50 py-4 rounded-xl font-bold text-lg hover:border-gray-400 transition-colors",
    },
    unknown: {
      label: `View on ${platform} →`,
      className:
        "flex items-center justify-center gap-2 w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 transition-colors",
    },
  };

  const cta = ctaConfig[status] ?? ctaConfig.unknown;

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Images — client component handles onError fallback + thumbnail strip */}
        <ListingImages
          primaryImageUrl={listing.primary_image_url}
          imageUrls={listing.image_urls}
          title={listing.title}
        />

        {/* Details */}
        <div className="space-y-4">
          {/* Platform badge */}
          <span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full">
            {platform}
          </span>

          <h1 className="text-2xl font-bold text-gray-900">{listing.title}</h1>

          {/* Price */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-blue-600">
                {formatPrice(listing.current_price)}
              </span>
              <span className="text-gray-500 text-sm">current bid</span>
            </div>
            {listing.buyers_premium_pct && (
              <p className="text-sm text-gray-600">
                + {listing.buyers_premium_pct}% buyer&apos;s premium ={" "}
                <strong>{formatPrice(listing.total_cost_estimate)} total</strong>
              </p>
            )}
          </div>

          {/* Status banner */}
          {(status === "ended" || status === "completed") && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm font-medium">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              This auction has ended
            </div>
          )}
          {status === "upcoming" && listing.sale_starts_at && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl px-4 py-3 text-sm font-medium">
              <Calendar className="w-4 h-4 flex-shrink-0" />
              Auction starts {formatDate(listing.sale_starts_at)}
            </div>
          )}

          {/* CTA — always goes to source platform */}
          <a
            href={listing.external_url}
            target="_blank"
            rel="noopener noreferrer"
            className={cta.className}
          >
            {cta.label}
            <ExternalLink className="w-5 h-5" />
          </a>

          {/* Meta */}
          <div className="space-y-2 text-sm">
            {listing.city && (
              <div className="flex items-center gap-2 text-gray-600">
                <MapPin className="w-4 h-4 text-gray-400" />
                {listing.city}, {listing.state}
              </div>
            )}
            {countdown && status !== "ended" && status !== "completed" && (
              <div className="flex items-center gap-2 text-gray-600">
                <Clock className="w-4 h-4 text-gray-400" />
                {status === "upcoming" ? "Starts" : countdown + " remaining"}
                {listing.sale_ends_at && status !== "upcoming" &&
                  ` · Ends ${formatDate(listing.sale_ends_at)}`}
              </div>
            )}
            {listing.pickup_only && (
              <div className="flex items-center gap-2 text-amber-700">
                <Truck className="w-4 h-4" />
                Pickup only — no shipping
              </div>
            )}
            {listing.category && (
              <div className="flex items-center gap-2 text-gray-600">
                <Tag className="w-4 h-4 text-gray-400" />
                {listing.category}
              </div>
            )}
          </div>

          {/* Description */}
          {listing.description && (
            <div className="prose prose-sm max-w-none text-gray-700">
              <h3 className="font-semibold text-gray-900 not-prose">Description</h3>
              <p className="mt-1 whitespace-pre-wrap">{listing.description.slice(0, 500)}</p>
              {listing.description.length > 500 && (
                <a
                  href={listing.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 not-prose text-sm"
                >
                  Read full description on {platform} →
                </a>
              )}
            </div>
          )}

          {/* Amazon Associates — contextual supply links */}
          <AmazonAssociates category={listing.category} />
        </div>
      </div>

      {/* Items / lots grid — visible when scraper populated items */}
      {listing.items && listing.items.length > 0 && (
        <ItemsGrid
          items={listing.items}
          auctionUrl={listing.external_url}
          platform={platform}
        />
      )}

      {/* Price check CTA */}
      <div className="mt-10 bg-blue-50 border border-blue-200 rounded-2xl p-6 text-center">
        <h2 className="font-bold text-lg text-gray-900 mb-2">Is this a good deal?</h2>
        <p className="text-gray-600 text-sm mb-4">
          Use our AI price check to see what similar items sold for.
        </p>
        <Link
          href={`/valuation?q=${encodeURIComponent(listing.title)}`}
          className="inline-block bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
        >
          Check Price
        </Link>
      </div>
    </div>
  );
}
