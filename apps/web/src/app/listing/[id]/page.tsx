import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, Clock, Truck, Tag, AlertTriangle, Calendar } from "lucide-react";
import { getListing } from "@/lib/api-client";
import { formatPrice, timeUntil, formatDate, getAuctionStatus } from "@/lib/format";
import { AmazonAssociates } from "@/components/ads/amazon-associates";
import { SphericalViewer } from "@/components/viewer/spherical-viewer";
import { ItemsGrid } from "@/components/listings/items-grid";
import { TrackedCta } from "@/components/listings/tracked-cta";

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

  const lt = listing.listing_type ?? "auction";
  const status = getAuctionStatus(listing);
  const countdown = timeUntil(listing.sale_ends_at);
  const platform = listing.platform.display_name;

  // CTA configuration based on listing type + status
  let cta: { label: string; className: string };

  if (lt === "estate_sale") {
    cta = {
      label: `Browse Estate Sale on ${platform} →`,
      className:
        "flex items-center justify-center gap-2 w-full border-2 border-emerald-500 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-700 py-4 rounded-xl font-bold text-lg hover:bg-emerald-100 dark:hover:bg-emerald-950/50 transition-colors",
    };
  } else if (lt === "buy_now") {
    cta = {
      label: `Buy Now on ${platform} →`,
      className:
        "flex items-center justify-center gap-2 w-full bg-emerald-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-emerald-700 transition-colors",
    };
  } else {
    const ctaConfig = {
      upcoming: {
        label: `Preview on ${platform} →`,
        className:
          "flex items-center justify-center gap-2 w-full border-2 border-antique-border text-antique-text bg-antique-surface py-4 rounded-xl font-bold text-lg hover:border-antique-border-s transition-colors",
      },
      live: {
        label: `Bid on ${platform}`,
        className:
          "flex items-center justify-center gap-2 w-full bg-antique-accent text-white py-4 rounded-xl font-bold text-lg hover:bg-antique-accent-h transition-colors",
      },
      ending_soon: {
        label: `Bid Now — Ending Soon!`,
        className:
          "flex items-center justify-center gap-2 w-full bg-red-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-red-700 transition-colors animate-pulse",
      },
      ended: {
        label: `View Results on ${platform} →`,
        className:
          "flex items-center justify-center gap-2 w-full border-2 border-antique-border text-antique-text-mute bg-antique-muted py-4 rounded-xl font-bold text-lg hover:border-antique-border-s transition-colors",
      },
      completed: {
        label: `View Results on ${platform} →`,
        className:
          "flex items-center justify-center gap-2 w-full border-2 border-antique-border text-antique-text-mute bg-antique-muted py-4 rounded-xl font-bold text-lg hover:border-antique-border-s transition-colors",
      },
      unknown: {
        label: `View on ${platform} →`,
        className:
          "flex items-center justify-center gap-2 w-full bg-antique-accent text-white py-4 rounded-xl font-bold text-lg hover:bg-antique-accent-h transition-colors",
      },
    };
    cta = ctaConfig[status] ?? ctaConfig.unknown;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* 3D Rotational Viewer + Lens Panel */}
        <SphericalViewer
          primaryImageUrl={listing.primary_image_url}
          imageUrls={listing.image_urls}
          title={listing.title}
        />

        {/* Details */}
        <div className="space-y-4">
          {/* Platform badge */}
          <span className="inline-block bg-antique-accent-s text-antique-accent text-xs font-semibold px-3 py-1 rounded-full border border-antique-accent-lt">
            {platform}
          </span>

          <h1 className="text-2xl font-bold text-antique-text font-display">{listing.title}</h1>

          {/* Price / info box — type-aware */}
          {lt === "estate_sale" ? (
            <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-xl p-4 space-y-1 border border-emerald-200 dark:border-emerald-800">
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-400">In-Person Estate Sale</p>
              {listing.sale_starts_at && (
                <p className="text-sm text-emerald-700 dark:text-emerald-500">
                  {formatDate(listing.sale_starts_at)}
                  {listing.sale_ends_at && ` – ${formatDate(listing.sale_ends_at)}`}
                </p>
              )}
              <p className="text-xs text-emerald-600 dark:text-emerald-500">Pricing is set at the sale — browse items in person</p>
            </div>
          ) : lt === "buy_now" && listing.buy_now_price != null ? (
            <div className="bg-antique-muted rounded-xl p-4 space-y-1 border border-antique-border">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                  {formatPrice(listing.buy_now_price)}
                </span>
                <span className="text-antique-text-mute text-sm">fixed price</span>
              </div>
            </div>
          ) : (
            <div className="bg-antique-muted rounded-xl p-4 space-y-1 border border-antique-border">
              {listing.current_price != null ? (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-antique-accent">
                      {formatPrice(listing.current_price)}
                    </span>
                    <span className="text-antique-text-mute text-sm">current bid</span>
                  </div>
                  {listing.buyers_premium_pct && (
                    <p className="text-sm text-antique-text-sec">
                      + {listing.buyers_premium_pct}% buyer&apos;s premium ={" "}
                      <strong>{formatPrice(listing.total_cost_estimate)} total</strong>
                    </p>
                  )}
                </>
              ) : listing.estimate_low != null ? (
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                    Est. {formatPrice(listing.estimate_low)}
                    {listing.estimate_high != null
                      ? `–${formatPrice(listing.estimate_high)}`
                      : "+"}
                  </span>
                  <span className="text-antique-text-mute text-sm">lot estimate · no bids yet</span>
                </div>
              ) : (
                <span className="text-antique-text-mute italic">No price info available</span>
              )}
            </div>
          )}

          {/* Status banners — auctions only */}
          {lt === "auction" && (status === "ended" || status === "completed") && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm font-medium">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              This auction has ended
            </div>
          )}
          {lt === "auction" && status === "upcoming" && listing.sale_starts_at && (
            <div className="flex items-center gap-2 bg-antique-accent-s border border-antique-accent-lt text-antique-accent rounded-xl px-4 py-3 text-sm font-medium">
              <Calendar className="w-4 h-4 flex-shrink-0" />
              Auction starts {formatDate(listing.sale_starts_at)}
            </div>
          )}

          {/* Pickup-only banner */}
          {listing.pickup_only && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm font-medium">
              <Truck className="w-4 h-4 flex-shrink-0" />
              Pickup only — item cannot be shipped
            </div>
          )}

          {/* CTA — always goes to source platform, click tracked for ad revenue */}
          <TrackedCta
            href={listing.external_url}
            label={cta.label}
            className={cta.className}
            listingId={listing.id}
            platform={listing.platform.name}
            category={listing.category}
            listingType={lt}
          />

          {/* Meta */}
          <div className="space-y-2 text-sm">
            {listing.city && (
              <div className="flex items-center gap-2 text-antique-text-sec">
                <MapPin className="w-4 h-4 text-antique-text-mute" />
                {listing.city}, {listing.state}
              </div>
            )}
            {lt === "auction" && countdown && status !== "ended" && status !== "completed" && (
              <div className="flex items-center gap-2 text-antique-text-sec">
                <Clock className="w-4 h-4 text-antique-text-mute" />
                {status === "upcoming" ? "Starts" : countdown + " remaining"}
                {listing.sale_ends_at && status !== "upcoming" &&
                  ` · Ends ${formatDate(listing.sale_ends_at)}`}
              </div>
            )}
            {listing.category && (
              <div className="flex items-center gap-2 text-antique-text-sec">
                <Tag className="w-4 h-4 text-antique-text-mute" />
                {listing.category}
              </div>
            )}
          </div>

          {/* Description */}
          {listing.description && (
            <div className="prose prose-sm max-w-none text-antique-text-sec">
              <h3 className="font-semibold text-antique-text not-prose">Description</h3>
              <p className="mt-1 whitespace-pre-wrap">{listing.description.slice(0, 500)}</p>
              {listing.description.length > 500 && (
                <a
                  href={listing.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-antique-accent not-prose text-sm hover:text-antique-accent-h"
                >
                  Read full description on {platform} →
                </a>
              )}
            </div>
          )}

          {/* Enriched attributes panel */}
          {(() => {
            const rows: { label: string; value: string }[] = [];
            if (listing.sub_category) rows.push({ label: "Type", value: listing.sub_category.replace(/_/g, " ") });
            if (listing.maker) rows.push({ label: "Maker", value: listing.maker.replace(/_/g, " ") });
            if (listing.brand && listing.brand !== listing.maker) rows.push({ label: "Brand", value: listing.brand.replace(/_/g, " ") });
            if (listing.period) rows.push({ label: "Period", value: listing.period.replace(/_/g, " ") });
            if (listing.country_of_origin) rows.push({ label: "Origin", value: listing.country_of_origin.replace(/_/g, " ") });
            if (listing.attributes) {
              const attrLabels: Record<string, string> = {
                movement: "Movement", case_material: "Case", case_size_mm: "Case size",
                complications: "Complications", has_box: "Box", has_papers: "Papers",
                is_vintage: "Vintage", year_approx: "Approx. year",
                metal: "Metal", primary_stone: "Stone", carat_weight: "Carat weight",
                is_signed: "Signed", piece_count: "Pieces", purity: "Purity",
                weight_oz: "Weight (oz)", pattern_name: "Pattern",
                medium: "Medium", is_framed: "Framed", edition_number: "Edition",
                style: "Style", material: "Material", denomination: "Denomination",
                grade: "Grade", grading_service: "Grader",
              };
              for (const [k, label] of Object.entries(attrLabels)) {
                const v = (listing.attributes as Record<string, unknown>)[k];
                if (v !== undefined && v !== null && v !== false) {
                  if (typeof v === "boolean") rows.push({ label, value: "Yes" });
                  else if (Array.isArray(v)) rows.push({ label, value: v.join(", ") });
                  else rows.push({ label, value: String(v) });
                }
              }
            }
            if (rows.length === 0) return null;
            return (
              <div className="border border-antique-border rounded-xl overflow-hidden">
                <div className="bg-antique-muted px-4 py-2.5 text-xs font-semibold text-antique-text-sec uppercase tracking-wide">
                  Item Details
                </div>
                <dl className="divide-y divide-antique-border">
                  {rows.map(({ label, value }) => (
                    <div key={label} className="flex justify-between items-baseline px-4 py-2.5 text-sm">
                      <dt className="text-antique-text-mute">{label}</dt>
                      <dd className="text-antique-text font-medium capitalize text-right max-w-[60%]">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            );
          })()}

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
      <div className="mt-10 bg-antique-accent-s border border-antique-accent-lt rounded-2xl p-6 text-center">
        <h2 className="font-bold text-lg text-antique-text mb-2">Is this a good deal?</h2>
        <p className="text-antique-text-sec text-sm mb-4">
          Use our AI price check to see what similar items sold for.
        </p>
        <Link
          href={`/valuation?q=${encodeURIComponent(listing.title)}`}
          className="inline-block bg-antique-accent text-white px-6 py-3 rounded-xl font-semibold hover:bg-antique-accent-h transition-colors"
        >
          Check Price
        </Link>
      </div>
    </div>
  );
}
