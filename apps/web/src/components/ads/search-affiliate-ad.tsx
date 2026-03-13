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

const CATEGORY_ICONS: Record<string, string> = {
  watches: "🕰️",
  jewelry: "💍",
  silver: "🍽️",
  art: "🖼️",
  furniture: "🪑",
  ceramics: "🏺",
  coins: "🪙",
  collectibles: "📦",
};

/**
 * Compact inline affiliate pill-cards shown on the search page when a query
 * or filters are active. Stays slim so it doesn't overwhelm the results.
 */
export function SearchAffiliateAd({ filters }: SearchAffiliateAdProps) {
  const tag = process.env.NEXT_PUBLIC_AMAZON_ASSOCIATES_TAG;
  if (!tag) return null;

  const links = buildSearchKeywords(filters);
  if (links.length === 0) return null;

  const icon = CATEGORY_ICONS[filters.category ?? ""] ?? "🛍️";

  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-antique-text-mute text-[11px] uppercase tracking-widest font-medium">
          Sponsored
        </span>
        <span className="text-[11px] text-antique-text-mute">· via Amazon</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {links.map((link, i) => {
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
              className="group inline-flex items-center gap-2 bg-antique-surface border border-antique-border rounded-xl px-4 py-2.5 text-sm hover:border-antique-accent hover:shadow-sm transition-all"
            >
              {i === 0 && <span className="text-base leading-none">{icon}</span>}
              <span className="font-medium text-antique-text group-hover:text-antique-accent transition-colors">
                {link.label}
              </span>
              <span className="text-antique-text-mute group-hover:text-antique-accent text-xs transition-colors">
                ↗
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
