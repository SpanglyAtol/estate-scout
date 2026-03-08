/**
 * Canonical category metadata for the Estate Scout category browser.
 *
 * The `slug` values must match what the backend enricher.py produces
 * (all lowercase) so that `?category=slug` filters work correctly.
 */

export type CategoryMeta = {
  slug: string;
  label: string;
  shortLabel: string;      // Used in pills / badges
  description: string;
  longDescription: string; // Shown on the category landing page
  icon: string;            // Emoji
  cardBg: string;          // Tailwind classes for the card background tint
  accentText: string;      // Tailwind class for the accent colour on the card
};

export const CATEGORIES: CategoryMeta[] = [
  {
    slug: "jewelry",
    label: "Jewelry",
    shortLabel: "Jewelry",
    description: "Estate rings, necklaces, brooches and fine jewelry",
    longDescription:
      "Browse signed pieces, vintage engagement rings, strand necklaces, brooches, cufflinks and complete sets from estate sales and regional auction houses across the country.",
    icon: "💎",
    cardBg: "bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800/40",
    accentText: "text-purple-700 dark:text-purple-300",
  },
  {
    slug: "art",
    label: "Art & Paintings",
    shortLabel: "Art",
    description: "Oil paintings, watercolours, prints and sculptures",
    longDescription:
      "Signed oils, academic watercolours, lithographs, drawings and small-scale sculpture from regional auction galleries and estate dispersals.",
    icon: "🖼️",
    cardBg: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/40",
    accentText: "text-red-700 dark:text-red-300",
  },
  {
    slug: "ceramics",
    label: "Ceramics & Porcelain",
    shortLabel: "Ceramics",
    description: "Fine china, pottery, stoneware and porcelain figurines",
    longDescription:
      "Meissen, Wedgwood, Royal Doulton, American art pottery, folk stoneware and studio ceramics from estate contents and specialist auctions.",
    icon: "🏺",
    cardBg: "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800/40",
    accentText: "text-orange-700 dark:text-orange-300",
  },
  {
    slug: "silver",
    label: "Silver & Metalware",
    shortLabel: "Silver",
    description: "Sterling flatware, hollowware, trays and decorative pieces",
    longDescription:
      "Sterling and silverplate flatware services, hollowware, candlesticks, trays and presentation pieces. Often the most undervalued items in an estate.",
    icon: "🥄",
    cardBg: "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/40",
    accentText: "text-slate-600 dark:text-slate-300",
  },
  {
    slug: "furniture",
    label: "Furniture",
    shortLabel: "Furniture",
    description: "Period and antique furniture — case pieces, chairs and tables",
    longDescription:
      "American Chippendale, Federal, Victorian, Mission and mid-century modern furniture from estate sales, auctions and downsizing households.",
    icon: "🪑",
    cardBg: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/40",
    accentText: "text-amber-700 dark:text-amber-300",
  },
  {
    slug: "glass",
    label: "Glass & Crystal",
    shortLabel: "Glass",
    description: "Cut crystal, art glass, Depression glass and pressed glass",
    longDescription:
      "Waterford, Baccarat, Lalique, Steuben, Tiffany Studios, American Depression glass and pressed glass from estate collections and specialist dealers.",
    icon: "🫙",
    cardBg: "bg-cyan-50 dark:bg-cyan-950/30 border-cyan-200 dark:border-cyan-800/40",
    accentText: "text-cyan-700 dark:text-cyan-300",
  },
  {
    slug: "collectibles",
    label: "Collectibles",
    shortLabel: "Collectibles",
    description: "Vintage toys, advertising, memorabilia and pop culture",
    longDescription:
      "Advertising tins, vintage toys, political memorabilia, sports collectibles, holiday decorations and Americana from estate and auction sources.",
    icon: "📦",
    cardBg: "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800/40",
    accentText: "text-yellow-700 dark:text-yellow-300",
  },
  {
    slug: "watches",
    label: "Watches & Clocks",
    shortLabel: "Watches",
    description: "Vintage wristwatches, pocket watches and mantel clocks",
    longDescription:
      "Vintage Rolex, Omega, Hamilton and pocket watches alongside mantel clocks, wall clocks and bracket clocks from estate dispersals.",
    icon: "⌚",
    cardBg: "bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700/40",
    accentText: "text-zinc-600 dark:text-zinc-300",
  },
  {
    slug: "books",
    label: "Books & Ephemera",
    shortLabel: "Books",
    description: "Rare books, maps, prints, postcards and paper ephemera",
    longDescription:
      "First editions, illustrated books, antique maps, Victorian trade cards, postcards and paper ephemera from bibliophile estates.",
    icon: "📚",
    cardBg: "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800/40",
    accentText: "text-green-700 dark:text-green-300",
  },
  {
    slug: "coins",
    label: "Coins & Currency",
    shortLabel: "Coins",
    description: "US and world coins, currency, medals and tokens",
    longDescription:
      "Morgan and Peace dollars, early American copper, world coins, obsolete US currency, military medals and elongated coins from collector estates.",
    icon: "🪙",
    cardBg: "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800/40",
    accentText: "text-yellow-600 dark:text-yellow-300",
  },
  {
    slug: "clothing",
    label: "Vintage Clothing",
    shortLabel: "Clothing",
    description: "Designer vintage, furs, accessories and period costume",
    longDescription:
      "Couture and designer vintage, fur coats, beaded evening wear, accessories and period costume from estate wardrobe sales.",
    icon: "👗",
    cardBg: "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/40",
    accentText: "text-rose-700 dark:text-rose-300",
  },
  {
    slug: "tools",
    label: "Tools & Workshop",
    shortLabel: "Tools",
    description: "Hand tools, planes, measuring instruments and shop equipment",
    longDescription:
      "Vintage Stanley planes, marking gauges, antique measuring instruments, patented hand tools and workshop contents from craftsman estates.",
    icon: "🔧",
    cardBg: "bg-stone-50 dark:bg-stone-800/40 border-stone-200 dark:border-stone-700/40",
    accentText: "text-stone-600 dark:text-stone-300",
  },
  {
    slug: "electronics",
    label: "Vintage Electronics",
    shortLabel: "Electronics",
    description: "Vintage radios, cameras, audio equipment and scientific instruments",
    longDescription:
      "Vintage tube radios, cameras, hi-fi turntables, oscilloscopes and scientific instruments from technology collector estates.",
    icon: "📻",
    cardBg: "bg-neutral-50 dark:bg-neutral-800/40 border-neutral-200 dark:border-neutral-700/40",
    accentText: "text-neutral-600 dark:text-neutral-300",
  },
  {
    slug: "toys",
    label: "Toys & Games",
    shortLabel: "Toys",
    description: "Cast iron, tin toys, board games and childhood antiques",
    longDescription:
      "Cast iron banks and vehicles, pressed steel, tin lithograph toys, antique dolls, board games and holiday ornaments from family estates.",
    icon: "🧸",
    cardBg: "bg-teal-50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-800/40",
    accentText: "text-teal-700 dark:text-teal-300",
  },
];

/** Fast lookup: slug → metadata */
export const CATEGORY_MAP: Record<string, CategoryMeta> = Object.fromEntries(
  CATEGORIES.map((c) => [c.slug, c])
);

/** Ordered slugs for the sidebar filter (must stay in sync with CATEGORIES) */
export const CATEGORY_SLUGS = CATEGORIES.map((c) => c.slug);
