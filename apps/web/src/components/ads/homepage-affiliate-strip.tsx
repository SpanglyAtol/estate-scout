"use client";

import { trackAffiliateClick } from "@/lib/analytics";

/**
 * Static Amazon affiliate strip for the homepage and other non-search surfaces.
 * Shows popular antique collecting supplies regardless of active filters.
 * Only renders when NEXT_PUBLIC_AMAZON_ASSOCIATES_TAG is configured.
 */

const STATIC_LINKS = [
  { label: "Antique price guides",         keywords: "antique price guide reference collector book" },
  { label: "Silver polish & anti-tarnish", keywords: "sterling silver polish anti tarnish cloth" },
  { label: "Museum-grade display cases",   keywords: "acrylic display case museum quality collectibles" },
  { label: "White cotton gloves",          keywords: "white cotton gloves museum archival handling" },
];

function buildAmazonUrl(keywords: string, tag: string): string {
  return `https://www.amazon.com/s?${new URLSearchParams({ k: keywords, tag, linkCode: "ure" })}`;
}

export function HomepageAffiliateStrip() {
  const tag = process.env.NEXT_PUBLIC_AMAZON_ASSOCIATES_TAG;
  if (!tag) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-4 py-2.5 bg-antique-surface border border-antique-border rounded-xl text-sm mb-10">
      <span className="text-antique-text-mute text-[11px] uppercase tracking-widest shrink-0 font-medium">
        Collector Supplies
      </span>
      {STATIC_LINKS.map((link) => {
        const url = buildAmazonUrl(link.keywords, tag);
        return (
          <a
            key={link.keywords}
            href={url}
            target="_blank"
            rel="noopener noreferrer sponsored"
            onClick={() =>
              trackAffiliateClick({ category: null, keywords: link.keywords, url })
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

/**
 * Category-specific affiliate strip for category browse pages.
 * Passes the category slug as a context signal to generate relevant links.
 */

const CATEGORY_STATIC: Record<string, { label: string; keywords: string }[]> = {
  watches: [
    { label: "Watch winder box",       keywords: "luxury watch winder 6 slot box" },
    { label: "Watch cleaning cloth",   keywords: "microfiber watch cleaning polishing cloth" },
    { label: "Horology reference",     keywords: "horology watches history reference book" },
  ],
  jewelry: [
    { label: "Ultrasonic cleaner",     keywords: "ultrasonic jewelry cleaner machine" },
    { label: "Jeweler's loupe 10x",    keywords: "jeweler loupe magnifier 10x triplet" },
    { label: "Jewelry display stand",  keywords: "jewelry display stand organizer velvet" },
  ],
  silver: [
    { label: "Silver polish cloth",    keywords: "silver polishing cloth anti tarnish" },
    { label: "Anti-tarnish strips",    keywords: "anti tarnish strips silverware storage" },
    { label: "Silver storage chest",   keywords: "silverware chest storage cedar anti tarnish" },
  ],
  art: [
    { label: "UV-protective frames",   keywords: "UV museum quality picture frame archival" },
    { label: "White gloves",           keywords: "white cotton gloves art handling archival" },
    { label: "Archival storage boxes", keywords: "archival acid free art storage box" },
  ],
  furniture: [
    { label: "Furniture polish",       keywords: "antique furniture beeswax polish" },
    { label: "Touch-up markers",       keywords: "furniture touch up markers scratch repair" },
    { label: "Moving blankets",        keywords: "moving blankets furniture pads protection" },
  ],
  ceramics: [
    { label: "Display plate rack",     keywords: "plate display rack stand wall china" },
    { label: "Foam packing wrap",      keywords: "foam wrap packing fragile ceramics" },
    { label: "Ceramics reference",     keywords: "ceramics pottery marks identification book" },
  ],
  coins: [
    { label: "Coin album pages",       keywords: "coin album pages holders binder" },
    { label: "Magnifier loupe",        keywords: "coin magnifier loupe 10x illuminated" },
    { label: "Coin price guide",       keywords: "coin collecting price guide book" },
  ],
  collectibles: [
    { label: "Acrylic display cases",  keywords: "acrylic display case collectibles UV" },
    { label: "Acid-free storage",      keywords: "acid free archival storage boxes collectibles" },
    { label: "Price guide book",       keywords: "antique collectibles price guide reference" },
  ],
};

const DEFAULT_CATEGORY_LINKS = STATIC_LINKS;

export function CategoryAffiliateStrip({ slug }: { slug: string }) {
  const tag = process.env.NEXT_PUBLIC_AMAZON_ASSOCIATES_TAG;
  if (!tag) return null;

  const links = CATEGORY_STATIC[slug] ?? DEFAULT_CATEGORY_LINKS;

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-4 py-2.5 bg-antique-surface border border-antique-border rounded-xl text-sm mb-6">
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
              trackAffiliateClick({ category: slug, keywords: link.keywords, url })
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
