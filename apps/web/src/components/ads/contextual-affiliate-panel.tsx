"use client";

import { buildListingKeywords, ESTATE_PREP_LINKS } from "@/lib/ad-keywords";
import { trackAffiliateClick } from "@/lib/analytics";
import type { Listing } from "@/types";

interface ContextualAffiliatePanelProps {
  listing: Listing;
}

function buildAmazonUrl(keywords: string, tag: string): string {
  return `https://www.amazon.com/s?${new URLSearchParams({ k: keywords, tag, linkCode: "ure" })}`;
}

const CURATE_CATEGORIES = new Set(["watches", "jewelry", "silver", "art", "ceramics"]);

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

  // Estate sales get practical prep links, not collector care
  const links = isEstateSale ? ESTATE_PREP_LINKS : buildListingKeywords(listing);
  if (links.length === 0) return null;

  const title = isEstateSale
    ? "Estate Sale Essentials"
    : CURATE_CATEGORIES.has(listing.category ?? "")
      ? "Curate Your Find"
      : "Care & Display";

  return (
    <div className="border border-antique-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between bg-antique-muted px-4 py-2.5">
        <span className="text-xs font-semibold text-antique-text-sec uppercase tracking-wide">
          {title}
        </span>
        <span className="text-[11px] text-antique-text-mute">via Amazon</span>
      </div>
      <ul className="divide-y divide-antique-border">
        {links.map((link) => {
          const url = buildAmazonUrl(link.keywords, tag);
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
                className="flex items-center justify-between px-4 py-3 text-sm text-antique-text hover:bg-antique-accent-s hover:text-antique-accent transition-colors group"
              >
                <span>{link.label}</span>
                <span className="text-antique-text-mute group-hover:text-antique-accent text-xs">
                  ↗
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
