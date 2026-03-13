"use client";

import { trackAffiliateClick } from "@/lib/analytics";

/**
 * Amazon affiliate product card grids for the homepage and category browse pages.
 * Only renders when NEXT_PUBLIC_AMAZON_ASSOCIATES_TAG is configured.
 */

interface AffiliateProduct {
  label: string;
  description: string;
  icon: string;
  keywords: string;
}

const STATIC_LINKS: AffiliateProduct[] = [
  {
    label: "Antique Price Guides",
    description: "Reference books for collectors",
    icon: "📚",
    keywords: "antique price guide reference collector book",
  },
  {
    label: "Silver Polish & Care",
    description: "Polish & anti-tarnish cloths",
    icon: "🍽️",
    keywords: "sterling silver polish anti tarnish cloth",
  },
  {
    label: "Museum Display Cases",
    description: "Acrylic & glass showcase cases",
    icon: "🏛️",
    keywords: "acrylic display case museum quality collectibles",
  },
  {
    label: "White Cotton Gloves",
    description: "Archival handling & care",
    icon: "🧤",
    keywords: "white cotton gloves museum archival handling",
  },
];

function buildAmazonUrl(keywords: string, tag: string): string {
  return `https://www.amazon.com/s?${new URLSearchParams({ k: keywords, tag, linkCode: "ure" })}`;
}

function ProductCard({
  product,
  tag,
  category,
}: {
  product: AffiliateProduct;
  tag: string;
  category: string | null;
}) {
  const url = buildAmazonUrl(product.keywords, tag);
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer sponsored"
      onClick={() =>
        trackAffiliateClick({ category, keywords: product.keywords, url })
      }
      className="group flex flex-col bg-antique-surface border border-antique-border rounded-xl p-4 hover:border-antique-accent hover:shadow-md transition-all"
    >
      <span className="text-2xl mb-2">{product.icon}</span>
      <span className="font-semibold text-antique-text text-sm leading-snug mb-0.5">
        {product.label}
      </span>
      <span className="text-xs text-antique-text-mute mb-3 leading-relaxed">
        {product.description}
      </span>
      <span className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-antique-accent border border-antique-accent rounded-lg px-3 py-1.5 group-hover:bg-antique-accent group-hover:text-white transition-colors self-start">
        Shop Amazon ↗
      </span>
    </a>
  );
}

export function HomepageAffiliateStrip() {
  const tag = process.env.NEXT_PUBLIC_AMAZON_ASSOCIATES_TAG;
  if (!tag) return null;

  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-3">
        <span className="text-antique-text-mute text-[11px] uppercase tracking-widest font-medium">
          Collector Supplies
        </span>
        <span className="text-[11px] text-antique-text-mute">Sponsored · via Amazon</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {STATIC_LINKS.map((product) => (
          <ProductCard key={product.keywords} product={product} tag={tag} category={null} />
        ))}
      </div>
    </div>
  );
}

/**
 * Category-specific affiliate product grid for category browse pages.
 */

const CATEGORY_STATIC: Record<string, AffiliateProduct[]> = {
  watches: [
    {
      label: "Watch Winder Box",
      description: "6-slot automatic winder",
      icon: "🕰️",
      keywords: "luxury watch winder 6 slot box",
    },
    {
      label: "Watch Cleaning Cloth",
      description: "Microfiber polishing cloth",
      icon: "✨",
      keywords: "microfiber watch cleaning polishing cloth",
    },
    {
      label: "Horology Reference",
      description: "Watch history & identification",
      icon: "📖",
      keywords: "horology watches history reference book",
    },
  ],
  jewelry: [
    {
      label: "Ultrasonic Cleaner",
      description: "Professional jewelry cleaner",
      icon: "💍",
      keywords: "ultrasonic jewelry cleaner machine",
    },
    {
      label: "Jeweler's Loupe 10×",
      description: "Triplet magnifier for grading",
      icon: "🔍",
      keywords: "jeweler loupe magnifier 10x triplet",
    },
    {
      label: "Jewelry Display Stand",
      description: "Velvet organizer & display",
      icon: "🏷️",
      keywords: "jewelry display stand organizer velvet",
    },
  ],
  silver: [
    {
      label: "Silver Polish Cloth",
      description: "Anti-tarnish polishing cloth",
      icon: "🍽️",
      keywords: "silver polishing cloth anti tarnish",
    },
    {
      label: "Anti-Tarnish Strips",
      description: "Silverware storage protection",
      icon: "🛡️",
      keywords: "anti tarnish strips silverware storage",
    },
    {
      label: "Silver Storage Chest",
      description: "Cedar-lined chest with strips",
      icon: "🗃️",
      keywords: "silverware chest storage cedar anti tarnish",
    },
  ],
  art: [
    {
      label: "UV-Protective Frames",
      description: "Museum-quality archival framing",
      icon: "🖼️",
      keywords: "UV museum quality picture frame archival",
    },
    {
      label: "White Cotton Gloves",
      description: "Archival art handling gloves",
      icon: "🧤",
      keywords: "white cotton gloves art handling archival",
    },
    {
      label: "Archival Storage Boxes",
      description: "Acid-free art storage",
      icon: "📦",
      keywords: "archival acid free art storage box",
    },
  ],
  furniture: [
    {
      label: "Beeswax Polish",
      description: "Antique furniture care wax",
      icon: "🪑",
      keywords: "antique furniture beeswax polish",
    },
    {
      label: "Touch-Up Markers",
      description: "Scratch & scuff repair set",
      icon: "🖊️",
      keywords: "furniture touch up markers scratch repair",
    },
    {
      label: "Moving Blankets",
      description: "Furniture pads & protection",
      icon: "🛋️",
      keywords: "moving blankets furniture pads protection",
    },
  ],
  ceramics: [
    {
      label: "Display Plate Rack",
      description: "Wall-mount china display stand",
      icon: "🏺",
      keywords: "plate display rack stand wall china",
    },
    {
      label: "Foam Packing Wrap",
      description: "Fragile ceramics protection",
      icon: "📦",
      keywords: "foam wrap packing fragile ceramics",
    },
    {
      label: "Ceramics Reference",
      description: "Marks & identification guide",
      icon: "📚",
      keywords: "ceramics pottery marks identification book",
    },
  ],
  coins: [
    {
      label: "Coin Album Pages",
      description: "Binder pages & holders",
      icon: "🪙",
      keywords: "coin album pages holders binder",
    },
    {
      label: "Illuminated Loupe",
      description: "10× magnifier with LED",
      icon: "🔍",
      keywords: "coin magnifier loupe 10x illuminated",
    },
    {
      label: "Coin Price Guide",
      description: "Current grading & values",
      icon: "📖",
      keywords: "coin collecting price guide book",
    },
  ],
  collectibles: [
    {
      label: "Acrylic Display Cases",
      description: "UV-resistant showcase",
      icon: "🏛️",
      keywords: "acrylic display case collectibles UV",
    },
    {
      label: "Acid-Free Storage",
      description: "Archival boxes & sleeves",
      icon: "📦",
      keywords: "acid free archival storage boxes collectibles",
    },
    {
      label: "Price Guide Book",
      description: "Antique & collectible values",
      icon: "📚",
      keywords: "antique collectibles price guide reference",
    },
  ],
};

export function CategoryAffiliateStrip({ slug }: { slug: string }) {
  const tag = process.env.NEXT_PUBLIC_AMAZON_ASSOCIATES_TAG;
  if (!tag) return null;

  const products = CATEGORY_STATIC[slug] ?? STATIC_LINKS.slice(0, 3);

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <span className="text-antique-text-mute text-[11px] uppercase tracking-widest font-medium">
          Sponsored
        </span>
        <span className="text-[11px] text-antique-text-mute">via Amazon</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {products.map((product) => (
          <ProductCard key={product.keywords} product={product} tag={tag} category={slug} />
        ))}
      </div>
    </div>
  );
}
