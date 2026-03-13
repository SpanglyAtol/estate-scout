"use client";

import { buildListingKeywords, ESTATE_PREP_LINKS, COMMODITY_CATEGORIES, buildCommodityLinks } from "@/lib/ad-keywords";
import { trackAffiliateClick } from "@/lib/analytics";
import type { Listing } from "@/types";

interface ContextualAffiliatePanelProps {
  listing: Listing;
}

function buildAmazonUrl(keywords: string, tag: string): string {
  return `https://www.amazon.com/s?${new URLSearchParams({ k: keywords, tag, linkCode: "ure" })}`;
}

const CURATE_CATEGORIES = new Set(["watches", "jewelry", "silver", "art", "ceramics"]);

const CATEGORY_ICONS: Record<string, string> = {
  watches: "🕰️",
  jewelry: "💍",
  silver: "🍽️",
  art: "🖼️",
  furniture: "🪑",
  ceramics: "🏺",
  coins: "🪙",
  collectibles: "📦",
  estate_sale: "🏡",
};

const ESTATE_PREP_ICONS = ["📦", "🗄️", "✨"];

/**
 * Contextual Amazon affiliate panel for listing detail pages.
 *
 * For estate_sale listings: shows estate-prep supplies (packing, storage, cleaning).
 * For auction/individual items: shows category-specific collector care / lifestyle links
 * assembled from enriched fields (maker, brand, period, attributes, price tier).
 */
export function ContextualAffiliatePanel({ listing }: ContextualAffiliatePanelProps) {
  const tag = process.env.NEXT_PUBLIC_AMAZON_ASSOCIATES_TAG;
  if (!tag) return null;

  const isEstateSale = listing.listing_type === "estate_sale";
  const isCommodity  = !isEstateSale && COMMODITY_CATEGORIES.has(listing.category ?? "");

  const links = isEstateSale
    ? ESTATE_PREP_LINKS
    : isCommodity
      ? buildCommodityLinks(listing)
      : buildListingKeywords(listing);
  if (links.length === 0) return null;

  const title = isEstateSale
    ? "Estate Sale Essentials"
    : isCommodity
      ? "Get It New on Amazon"
      : CURATE_CATEGORIES.has(listing.category ?? "")
        ? "Curate Your Find"
        : "Care & Display";

  const categoryIcon = isEstateSale
    ? "🏡"
    : isCommodity
      ? "📦"
      : CATEGORY_ICONS[listing.category ?? ""] ?? "🛍️";

  return (
    <div className="border border-antique-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between bg-antique-muted px-4 py-3 border-b border-antique-border">
        <div className="flex items-center gap-2">
          <span className="text-lg leading-none">{categoryIcon}</span>
          <span className="text-xs font-semibold text-antique-text-sec uppercase tracking-wide">
            {title}
          </span>
        </div>
        <span className="text-[11px] text-antique-text-mute">Sponsored · via Amazon</span>
      </div>

      {/* Product rows */}
      <ul className="divide-y divide-antique-border bg-antique-surface">
        {links.map((link, i) => {
          const url = buildAmazonUrl(link.keywords, tag);
          const rowIcon = isEstateSale
            ? ESTATE_PREP_ICONS[i] ?? "📦"
            : isCommodity
              ? "📦"
              : CATEGORY_ICONS[listing.category ?? ""] ?? "🛍️";
          return (
            <li key={link.keywords}>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer sponsored"
                onClick={() =>
                  trackAffiliateClick({
                    category: listing.category,
                    keywords: link.keywords,
                    url,
                  })
                }
                className="flex items-center gap-3 px-4 py-3.5 text-sm hover:bg-antique-accent-s transition-colors group"
              >
                <span className="text-base leading-none shrink-0">{rowIcon}</span>
                <span className="flex-1 font-medium text-antique-text group-hover:text-antique-accent transition-colors">
                  {link.label}
                </span>
                <span className="text-antique-text-mute group-hover:text-antique-accent text-xs transition-colors shrink-0">
                  {isCommodity ? "New ↗" : "Shop ↗"}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
