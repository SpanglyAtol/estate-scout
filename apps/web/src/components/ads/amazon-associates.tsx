"use client";

/**
 * Amazon Associates contextual product suggestions.
 * Shown on listing detail pages to surface relevant supplies/accessories.
 * Only renders when NEXT_PUBLIC_AMAZON_ASSOCIATES_TAG is configured.
 */

import { trackAffiliateClick } from "@/lib/analytics";

interface AmazonLink {
  label: string;
  description: string;
  icon: string;
  keywords: string;
}

const CATEGORY_LINKS: Record<string, AmazonLink[]> = {
  ceramics: [
    { label: "Ceramic Cleaning Kit", description: "Safe care for antique pottery", icon: "🏺", keywords: "antique ceramic cleaning kit" },
    { label: "Display Plate Rack", description: "Wall-mount china shelf", icon: "🪞", keywords: "ceramic display shelf plate rack" },
    { label: "Foam Packing Wrap", description: "Protect fragile pieces", icon: "📦", keywords: "fragile item packing foam wrap" },
  ],
  furniture: [
    { label: "Furniture Touch-Up Kit", description: "Scratch & scuff repair", icon: "🪑", keywords: "furniture scratch repair kit" },
    { label: "Antique Polish & Wax", description: "Beeswax care for wood", icon: "✨", keywords: "antique furniture polish wax" },
    { label: "Moving Blankets", description: "Padding for transport", icon: "🛋️", keywords: "moving blankets furniture protection" },
  ],
  jewelry: [
    { label: "Jewelry Cleaning Kit", description: "Ultrasonic cleaner set", icon: "💍", keywords: "jewelry ultrasonic cleaner kit" },
    { label: "Jewelry Display Stand", description: "Velvet organizer tray", icon: "🏷️", keywords: "jewelry display stand organizer" },
    { label: "Jeweler's Loupe 10×", description: "Triplet magnifier for grading", icon: "🔍", keywords: "jeweler loupe magnifier 10x" },
  ],
  art: [
    { label: "UV-Protective Frames", description: "Museum-quality archival framing", icon: "🖼️", keywords: "UV protective picture frame" },
    { label: "Archival Storage Boxes", description: "Acid-free art storage", icon: "📦", keywords: "archival art storage box" },
    { label: "White Cotton Gloves", description: "Safe artwork handling", icon: "🧤", keywords: "white cotton gloves artwork handling" },
  ],
  silver: [
    { label: "Silver Polish Cloth", description: "Anti-tarnish polishing cloth", icon: "🍽️", keywords: "silver polish cleaning cloth" },
    { label: "Anti-Tarnish Strips", description: "Silverware storage strips", icon: "🛡️", keywords: "anti tarnish silver storage strips" },
    { label: "Silver Storage Bags", description: "Flatware anti-tarnish bags", icon: "🗃️", keywords: "silver flatware anti tarnish bags" },
  ],
  glass: [
    { label: "Glass Cleaner Spray", description: "Streak-free antique safe", icon: "🫧", keywords: "streak free glass cleaner antique" },
    { label: "Padded Display Cases", description: "Protected glass showcase", icon: "🏛️", keywords: "glass display case collectibles" },
    { label: "Foam Packing Wrap", description: "Protect fragile glass", icon: "📦", keywords: "foam wrap packing fragile glass" },
  ],
  collectibles: [
    { label: "Acrylic Display Cases", description: "UV-resistant showcase", icon: "🏛️", keywords: "acrylic display case collectibles" },
    { label: "Acid-Free Storage Boxes", description: "Archival boxes & sleeves", icon: "📦", keywords: "acid free archival storage boxes" },
    { label: "Price Guide Books", description: "Antique & collectible values", icon: "📚", keywords: "antique collectibles price guide book" },
  ],
};

const DEFAULT_LINKS: AmazonLink[] = [
  { label: "Antique Cleaning Supplies", description: "Safe restoration care kit", icon: "✨", keywords: "antique cleaning restoration supplies" },
  { label: "Collector Display Cases", description: "Acrylic & glass showcases", icon: "🏛️", keywords: "antique display case collector" },
  { label: "Archival Storage", description: "Acid-free boxes & sleeves", icon: "📦", keywords: "archival acid free storage collectibles" },
];

function buildAmazonUrl(keywords: string, tag: string): string {
  const params = new URLSearchParams({ k: keywords, tag, linkCode: "ure" });
  return `https://www.amazon.com/s?${params.toString()}`;
}

interface AmazonAssociatesProps {
  category: string | null;
}

export function AmazonAssociates({ category }: AmazonAssociatesProps) {
  const tag = process.env.NEXT_PUBLIC_AMAZON_ASSOCIATES_TAG;
  if (!tag) return null;

  const links: AmazonLink[] =
    category ? CATEGORY_LINKS[category.toLowerCase()] ?? DEFAULT_LINKS : DEFAULT_LINKS;

  return (
    <div className="border border-antique-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between bg-antique-muted px-4 py-3 border-b border-antique-border">
        <div className="flex items-center gap-2">
          <span className="text-lg leading-none">🛍️</span>
          <h3 className="text-xs font-semibold text-antique-text-sec uppercase tracking-wide">
            Clean &amp; Display Your Find
          </h3>
        </div>
        <span className="text-[11px] text-antique-text-mute">Sponsored · via Amazon</span>
      </div>
      <ul className="divide-y divide-antique-border bg-antique-surface">
        {links.map((link) => {
          const url = buildAmazonUrl(link.keywords, tag);
          return (
            <li key={link.keywords}>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="flex items-center gap-3 px-4 py-3.5 text-sm hover:bg-antique-accent-s transition-colors group"
                onClick={() =>
                  trackAffiliateClick({ category, keywords: link.keywords, url })
                }
              >
                <span className="text-base leading-none shrink-0">{link.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-antique-text group-hover:text-antique-accent transition-colors truncate">
                    {link.label}
                  </p>
                  <p className="text-xs text-antique-text-mute mt-0.5">{link.description}</p>
                </div>
                <span className="text-antique-text-mute group-hover:text-antique-accent text-xs transition-colors shrink-0">
                  Shop ↗
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
