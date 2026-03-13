import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MapPin, Clock, Truck, Tag, AlertTriangle, Calendar, ChevronRight, ExternalLink } from "lucide-react";
import { getSupabaseListing, isSupabaseConfigured } from "@/lib/supabase-search";
import { getListings } from "@/lib/scraped-data";
import type { Listing } from "@/types";
import { formatPrice, timeUntil, formatDate, getAuctionStatus } from "@/lib/format";
import { categoryToSlug } from "@/lib/category-meta";
import { ContextualAffiliatePanel } from "@/components/ads/contextual-affiliate-panel";
import { AdUnit } from "@/components/ads/ad-unit";
import { PriceCheckerWidget } from "@/components/price-checker/price-checker-widget";
import { SphericalViewer } from "@/components/viewer/spherical-viewer";
import { ItemsGrid } from "@/components/listings/items-grid";
import { TrackedCta } from "@/components/listings/tracked-cta";
import { SaveButton } from "@/components/listings/save-button";
import { RelatedListings } from "@/components/listings/related-listings";
import { MarketContextStrip } from "@/components/market/market-context-strip";

/** Format estate sale dates with weekday names: "Fri, Mar 14 – Sun, Mar 16" */
function formatSaleEvent(startsAt: string | null, endsAt: string | null): string {
  if (!startsAt) return "";
  const opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" };
  const start = new Intl.DateTimeFormat("en-US", opts).format(new Date(startsAt));
  if (!endsAt) return start;
  // If same day, just return one date
  const s = new Date(startsAt);
  const e = new Date(endsAt);
  if (s.toDateString() === e.toDateString()) return start;
  const end = new Intl.DateTimeFormat("en-US", opts).format(e);
  return `${start} – ${end}`;
}

// Always fetch fresh scraped data on each visit
export const dynamic = "force-dynamic";

/**
 * Server-side listing fetch — calls data sources directly, no HTTP self-loop.
 * Priority: FastAPI backend → Supabase → local JSON bundle.
 */
async function fetchListingServer(id: number): Promise<Listing | null> {
  // 1. FastAPI backend (when configured)
  const backendUrl = process.env.BACKEND_API_URL;
  if (backendUrl) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(`${backendUrl}/api/v1/listings/${id}`, {
        signal: controller.signal,
        next: { revalidate: 0 },
      });
      clearTimeout(timer);
      if (res.ok) return res.json() as Promise<Listing>;
      if (res.status === 404) return null; // definitively not found
    } catch {
      // backend down — fall through
    }
  }

  // 2. Direct Supabase (no HTTP self-call)
  if (isSupabaseConfigured()) {
    const listing = await getSupabaseListing(id);
    if (listing) return listing;
  }

  // 3. Local JSON bundle
  const all = getListings();
  return (all.find((l) => l.id === id) as Listing | undefined) ?? null;
}

interface PageProps {
  params: { id: string };
  searchParams?: { src?: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const id = Number(params.id);
  if (isNaN(id)) return {};

  try {
    const listing = await fetchListingServer(id);
    if (!listing) return {};
    const platform = listing.platform?.display_name ?? "Auction Platform";
    const price =
      listing.current_price ?? listing.buy_now_price ?? listing.estimate_low;
    const priceStr = price != null ? ` — ${formatPrice(price)}` : "";
    const description =
      listing.description?.slice(0, 160) ??
      `${listing.category ?? "Antique"} listed on ${platform}. View details, AI price estimate, and bid or buy.`;

    return {
      title: `${listing.title}${priceStr} | Estate Scout`,
      description,
      openGraph: {
        title: listing.title,
        description,
        images: listing.primary_image_url ? [listing.primary_image_url] : [],
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title: listing.title,
        description,
        images: listing.primary_image_url ? [listing.primary_image_url] : [],
      },
    };
  } catch {
    return {};
  }
}

export default async function ListingPage({ params, searchParams }: PageProps) {
  const id = Number(params.id);
  if (isNaN(id)) notFound();

  // Direct server-side fetch — no HTTP self-call, no Vercel timeout cascade.
  const listing = await fetchListingServer(id);
  if (!listing) {
    // If the card passed the original platform URL, send the user there directly
    // rather than showing a dead-end 404.
    const fallback = searchParams?.src;
    if (fallback && fallback.startsWith("http")) redirect(fallback);
    notFound();
  }

  const lt = listing.listing_type ?? "auction";
  const status = getAuctionStatus(listing);
  const countdown = timeUntil(listing.sale_ends_at);
  const platform = listing.platform?.display_name ?? "Auction Platform";
  const catSlug = categoryToSlug(listing.category ?? "");

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
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1 text-sm text-antique-text-mute flex-wrap">
        <Link href="/" className="hover:text-antique-accent transition-colors">Home</Link>
        <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
        {catSlug && listing.category ? (
          <>
            <Link href={`/categories/${catSlug}`} className="hover:text-antique-accent transition-colors">
              {listing.category}
            </Link>
            <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
          </>
        ) : (
          <>
            <Link href="/search" className="hover:text-antique-accent transition-colors">Search</Link>
            <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
          </>
        )}
        <span className="text-antique-text-sec truncate max-w-[200px] sm:max-w-xs">{listing.title}</span>
      </nav>

      {/* Estate Sale Event Banner — full-width header above the detail grid */}
      {lt === "estate_sale" && (
        <div className="mb-8 bg-emerald-50 dark:bg-emerald-950/25 rounded-2xl border border-emerald-200 dark:border-emerald-800 p-6">
          <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-500 uppercase tracking-widest mb-2">
            Estate Sale Event
          </p>
          <div className="flex flex-wrap gap-x-8 gap-y-3 items-center">
            {listing.sale_starts_at && (
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-600 dark:text-emerald-500 flex-shrink-0" />
                <span className="text-lg font-bold text-emerald-800 dark:text-emerald-300">
                  {formatSaleEvent(listing.sale_starts_at, listing.sale_ends_at)}
                </span>
              </div>
            )}
            {listing.city && (
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-emerald-600 dark:text-emerald-500 flex-shrink-0" />
                <span className="text-base font-medium text-emerald-700 dark:text-emerald-400">
                  {listing.city}{listing.state ? `, ${listing.state}` : ""}
                </span>
              </div>
            )}
            {listing.items && listing.items.length > 0 && (
              <span className="ml-auto bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 text-sm font-semibold px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-700">
                {listing.items.length.toLocaleString()} items
              </span>
            )}
          </div>
          {/* Directions link */}
          {listing.city && (
            <a
              href={`https://www.google.com/maps/search/${encodeURIComponent(`estate sale ${listing.city}${listing.state ? " " + listing.state : ""}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-500 hover:text-emerald-800 dark:hover:text-emerald-300 hover:underline"
            >
              <MapPin className="w-4 h-4" /> Get directions
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      )}

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
            <p className="text-sm text-antique-text-mute italic">
              Pricing is set at the sale — browse items in person or online.
            </p>
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

          {/* CTA + Save row */}
          <div className="flex gap-3">
            <TrackedCta
              href={listing.external_url}
              label={cta.label}
              className={cta.className + " flex-1"}
              listingId={listing.id}
              platform={listing.platform.name}
              category={listing.category}
              listingType={lt}
            />
            <SaveButton
              item={{
                id: listing.id,
                title: listing.title,
                primary_image_url: listing.primary_image_url ?? null,
                current_price: listing.current_price ?? listing.buy_now_price ?? null,
                external_url: listing.external_url,
                platform_name: listing.platform?.display_name ?? "",
                category: listing.category ?? null,
                sale_ends_at: listing.sale_ends_at ?? null,
              }}
            />
          </div>

          {/* Meta */}
          <div className="space-y-2 text-sm">
            {/* Location shown in event banner for estate sales; keep for auctions */}
            {lt !== "estate_sale" && listing.city && (
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
            {listing.category && (() => {
              return (
                <div className="flex items-center gap-2 text-antique-text-sec">
                  <Tag className="w-4 h-4 text-antique-text-mute" />
                  {catSlug ? (
                    <Link
                      href={`/categories/${catSlug}`}
                      className="hover:text-antique-accent hover:underline transition-colors"
                    >
                      {listing.category}
                    </Link>
                  ) : (
                    listing.category
                  )}
                </div>
              );
            })()}
          </div>

          {/* Description — full text for estate sales, 500-char preview for items */}
          {listing.description && (
            <div className="prose prose-sm max-w-none text-antique-text-sec">
              <h3 className="font-semibold text-antique-text not-prose">
                {lt === "estate_sale" ? "About this Sale" : "Description"}
              </h3>
              {lt === "estate_sale" ? (
                <p className="mt-1 whitespace-pre-wrap">{listing.description}</p>
              ) : (
                <>
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
                </>
              )}
            </div>
          )}

          {/* Enriched attributes panel — not shown for estate sale events */}
          {lt !== "estate_sale" && (() => {
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

          {/* Contextual affiliate panel — keywords built from all enriched listing fields */}
          <ContextualAffiliatePanel listing={listing} />
        </div>
      </div>

      {/* Items / lots grid — visible when scraper populated items */}
      {listing.items && listing.items.length > 0 && (
        <ItemsGrid
          items={listing.items}
          auctionUrl={listing.external_url}
          platform={platform}
          isEstateSale={lt === "estate_sale"}
        />
      )}

      {/* Estate sales: "no items listed" fallback + direct platform link */}
      {lt === "estate_sale" && (!listing.items || listing.items.length === 0) && (
        <div className="mt-8 rounded-2xl border border-dashed border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/10 p-8 text-center">
          <p className="text-antique-text-sec text-sm mb-4">
            Individual items for this estate sale are not listed here yet.<br />
            Browse the full sale on the platform for photos and pricing.
          </p>
          <a
            href={listing.external_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm"
          >
            Browse items on {platform}
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      )}

      {/* Market context and AI price checker — only for individual auction items */}
      {lt !== "estate_sale" && (
        <>
          <div className="mt-8">
            <MarketContextStrip listing={listing} />
          </div>
          <div className="mt-6">
            <PriceCheckerWidget listing={listing} />
          </div>
        </>
      )}

      {/* AdSense — between AI tools and related listings, naturally between content blocks */}
      <AdUnit
        slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_LISTING_DETAIL ?? ""}
        format="auto"
        className="my-8"
      />

      {/* Related / similar listings */}
      <RelatedListings listing={listing} />
    </div>
  );
}
