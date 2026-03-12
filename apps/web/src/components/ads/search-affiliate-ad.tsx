"use client";

import { buildSearchKeywords } from "@/lib/ad-keywords";
import { trackAffiliateClick } from "@/lib/analytics";
import type { SearchFilters } from "@/types";

interface SearchAffiliateAdProps {
  filters: SearchFilters;
}

function buildAmazonUrl(keywords: string, tag: string): string {
  return `https://www.amazon.com/s?${new URLSearchParams({ k: keywords, tag, linkCode: "ure" })}`;
}

/**
 * Slim inline affiliate strip shown on the search page when a query or filters are active.
 * Keywords are assembled from the full filter state — query, maker, period, category, price tier, etc.
 */
export function SearchAffiliateAd({ filters }: SearchAffiliateAdProps) {
  const tag = process.env.NEXT_PUBLIC_AMAZON_ASSOCIATES_TAG;
  if (!tag) return null;

  const links = buildSearchKeywords(filters);
  if (links.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mb-5 px-4 py-2.5 bg-antique-surface border border-antique-border rounded-xl text-sm">
      <span className="text-antique-text-mute text-[11px] uppercase tracking-widest shrink-0 font-medium">
        Sponsored
      </span>
      {links.map((link) => {
        const url = buildAmazonUrl(link.keywords, tag);
        return (
          <a
            key={link.keywords}
            href={url}
            target="_blank"
            rel="noopener noreferrer sponsored"
            onClick={() =>
              trackAffiliateClick({
                category: filters.category ?? null,
                keywords: link.keywords,
                url,
              })
            }
            className="text-antique-accent hover:text-antique-accent-h hover:underline transition-colors font-medium"
          >
            {link.label}
          </a>
        );
      })}
      <span className="ml-auto text-antique-text-mute text-[11px] shrink-0">via Amazon ↗</span>
    </div>
  );
}
