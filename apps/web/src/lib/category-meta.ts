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
  subcategories: SubcategoryMeta[];
  /** Enriched attribute filters specific to this category */
  attributeFilters?: AttributeFilter[];
};

export type SubcategoryMeta = {
  slug: string;   // Must match enricher.py sub_category output
  label: string;
};

export type AttributeFilter = {
  key: string;          // Matches attributes.{key} in the listing
  label: string;
  type: "select" | "checkbox";
  options: { value: string; label: string }[];
};

// ── Shared period/era taxonomy ─────────────────────────────────────────────────
export const PERIODS: { slug: string; label: string }[] = [
  { slug: "ancient",            label: "Ancient (pre-500 AD)" },
  { slug: "medieval",           label: "Medieval (500–1400)" },
  { slug: "renaissance",        label: "Renaissance (1400–1600)" },
  { slug: "baroque",            label: "Baroque (1600–1750)" },
  { slug: "georgian",           label: "Georgian (1714–1830)" },
  { slug: "regency",            label: "Regency (1811–1830)" },
  { slug: "victorian",          label: "Victorian (1837–1901)" },
  { slug: "edwardian",          label: "Edwardian (1901–1910)" },
  { slug: "art_nouveau",        label: "Art Nouveau (1890–1910)" },
  { slug: "arts_and_crafts",    label: "Arts & Crafts (1880–1920)" },
  { slug: "art_deco",           label: "Art Deco (1920–1940)" },
  { slug: "mid_century_modern", label: "Mid-Century Modern (1945–1970)" },
  { slug: "modernist",          label: "Modernist (1960–1990)" },
  { slug: "contemporary",       label: "Contemporary (1990–present)" },
];

// ── Countries of origin ────────────────────────────────────────────────────────
export const COUNTRIES: { slug: string; label: string }[] = [
  { slug: "united_states", label: "American" },
  { slug: "england",       label: "English / British" },
  { slug: "france",        label: "French" },
  { slug: "germany",       label: "German" },
  { slug: "italy",         label: "Italian" },
  { slug: "japan",         label: "Japanese" },
  { slug: "china",         label: "Chinese" },
  { slug: "denmark",       label: "Danish / Scandinavian" },
  { slug: "austria",       label: "Austrian" },
  { slug: "ireland",       label: "Irish" },
  { slug: "netherlands",   label: "Dutch / Flemish" },
  { slug: "russia",        label: "Russian / Imperial Russian" },
];

// ── Conditions ─────────────────────────────────────────────────────────────────
export const CONDITIONS: { slug: string; label: string }[] = [
  { slug: "excellent",    label: "Excellent" },
  { slug: "very_good",    label: "Very Good" },
  { slug: "good",         label: "Good" },
  { slug: "fair",         label: "Fair" },
  { slug: "parts_repair", label: "Parts / Restoration" },
];

// ── Category definitions ───────────────────────────────────────────────────────

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
    subcategories: [
      { slug: "rings",      label: "Rings" },
      { slug: "necklaces",  label: "Necklaces & Pendants" },
      { slug: "bracelets",  label: "Bracelets & Bangles" },
      { slug: "brooches",   label: "Brooches & Pins" },
      { slug: "earrings",   label: "Earrings" },
      { slug: "cufflinks",  label: "Cufflinks & Tie Pins" },
      { slug: "sets",       label: "Parure / Sets" },
      { slug: "charms",     label: "Charms & Lockets" },
    ],
    attributeFilters: [
      {
        key: "metal",
        label: "Metal",
        type: "select",
        options: [
          { value: "gold_18k",     label: "18k Gold" },
          { value: "gold_14k",     label: "14k Gold" },
          { value: "gold_9k",      label: "9k Gold" },
          { value: "platinum",     label: "Platinum" },
          { value: "sterling",     label: "Sterling Silver" },
          { value: "silver_plate", label: "Silver Plate" },
          { value: "costume",      label: "Costume / Fashion" },
        ],
      },
      {
        key: "primary_stone",
        label: "Primary Stone",
        type: "select",
        options: [
          { value: "diamond",   label: "Diamond" },
          { value: "ruby",      label: "Ruby" },
          { value: "emerald",   label: "Emerald" },
          { value: "sapphire",  label: "Sapphire" },
          { value: "pearl",     label: "Pearl" },
          { value: "opal",      label: "Opal" },
          { value: "turquoise", label: "Turquoise" },
          { value: "amethyst",  label: "Amethyst" },
          { value: "garnet",    label: "Garnet" },
          { value: "none",      label: "No Stone" },
        ],
      },
      {
        key: "is_signed",
        label: "Signed / Marked",
        type: "checkbox",
        options: [{ value: "true", label: "Signed or maker-marked" }],
      },
    ],
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
    subcategories: [
      { slug: "oil_paintings",    label: "Oil Paintings" },
      { slug: "watercolors",      label: "Watercolors & Gouache" },
      { slug: "prints",           label: "Prints & Lithographs" },
      { slug: "drawings",         label: "Drawings & Pastels" },
      { slug: "sculpture",        label: "Sculpture & 3D Art" },
      { slug: "photography",      label: "Photography" },
      { slug: "mixed_media",      label: "Mixed Media" },
      { slug: "folk_art",         label: "Folk & Outsider Art" },
    ],
    attributeFilters: [
      {
        key: "medium",
        label: "Medium",
        type: "select",
        options: [
          { value: "oil",        label: "Oil on Canvas" },
          { value: "oil_board",  label: "Oil on Board" },
          { value: "watercolor", label: "Watercolor" },
          { value: "acrylic",    label: "Acrylic" },
          { value: "gouache",    label: "Gouache" },
          { value: "pastel",     label: "Pastel" },
          { value: "charcoal",   label: "Charcoal / Pencil" },
          { value: "etching",    label: "Etching / Engraving" },
          { value: "lithograph", label: "Lithograph" },
          { value: "bronze",     label: "Bronze / Cast" },
        ],
      },
      {
        key: "is_signed",
        label: "Artist Signature",
        type: "checkbox",
        options: [{ value: "true", label: "Artist signed" }],
      },
      {
        key: "is_framed",
        label: "Framed",
        type: "checkbox",
        options: [{ value: "true", label: "Includes frame" }],
      },
    ],
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
    subcategories: [
      { slug: "porcelain",    label: "Fine Porcelain" },
      { slug: "art_pottery",  label: "Art Pottery" },
      { slug: "stoneware",    label: "Stoneware & Earthenware" },
      { slug: "figurines",    label: "Figurines & Statuettes" },
      { slug: "dinnerware",   label: "Dinnerware & China Sets" },
      { slug: "vases",        label: "Vases & Decorative Pieces" },
      { slug: "folk_pottery", label: "Folk & Country Pottery" },
      { slug: "tiles",        label: "Tiles & Plaques" },
    ],
    attributeFilters: [
      {
        key: "is_marked",
        label: "Maker's Mark",
        type: "checkbox",
        options: [{ value: "true", label: "Bears maker's mark" }],
      },
    ],
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
    subcategories: [
      { slug: "flatware",     label: "Flatware & Cutlery" },
      { slug: "hollowware",   label: "Hollowware (Bowls, Pitchers)" },
      { slug: "tea_sets",     label: "Tea & Coffee Services" },
      { slug: "candlesticks", label: "Candlesticks & Candelabra" },
      { slug: "trays",        label: "Trays & Salvers" },
      { slug: "presentation", label: "Presentation & Trophy Pieces" },
      { slug: "decorative",   label: "Decorative & Novelty Silver" },
    ],
    attributeFilters: [
      {
        key: "purity",
        label: "Purity",
        type: "select",
        options: [
          { value: "sterling",     label: "Sterling (.925)" },
          { value: "coin_silver",  label: "Coin Silver (.900)" },
          { value: "britannia",    label: "Britannia (.958)" },
          { value: "silver_plate", label: "Silver Plate (EPNS)" },
          { value: "sheffield",    label: "Old Sheffield Plate" },
        ],
      },
    ],
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
    subcategories: [
      { slug: "chairs",      label: "Chairs & Seating" },
      { slug: "tables",      label: "Tables & Desks" },
      { slug: "case_pieces", label: "Case Pieces (Chests, Armoires)" },
      { slug: "sofas",       label: "Sofas & Settees" },
      { slug: "beds",        label: "Beds & Bedroom Sets" },
      { slug: "cabinets",    label: "Cabinets & Sideboards" },
      { slug: "bookcases",   label: "Bookcases & Shelving" },
      { slug: "lighting",    label: "Lighting & Lamps" },
    ],
    attributeFilters: [
      {
        key: "material",
        label: "Primary Wood",
        type: "select",
        options: [
          { value: "mahogany", label: "Mahogany" },
          { value: "walnut",   label: "Walnut" },
          { value: "oak",      label: "Oak" },
          { value: "cherry",   label: "Cherry" },
          { value: "maple",    label: "Maple" },
          { value: "rosewood", label: "Rosewood" },
          { value: "pine",     label: "Pine / Country" },
          { value: "wicker",   label: "Wicker / Rattan" },
        ],
      },
      {
        key: "style",
        label: "Style / Form",
        type: "select",
        options: [
          { value: "chippendale", label: "Chippendale" },
          { value: "federal",     label: "Federal / Hepplewhite" },
          { value: "empire",      label: "Empire" },
          { value: "victorian",   label: "Victorian" },
          { value: "mission",     label: "Mission / Arts & Crafts" },
          { value: "mid_century", label: "Mid-Century Modern" },
          { value: "regency",     label: "Regency" },
          { value: "louis_xv",    label: "Louis XV / French" },
        ],
      },
      {
        key: "is_pair",
        label: "Offered as Pair",
        type: "checkbox",
        options: [{ value: "true", label: "Pair / Set available" }],
      },
    ],
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
    subcategories: [
      { slug: "cut_glass",        label: "Cut Glass & Crystal" },
      { slug: "art_glass",        label: "Art Glass (Lalique, Steuben)" },
      { slug: "depression_glass", label: "Depression & Carnival Glass" },
      { slug: "blown_glass",      label: "Blown & Studio Glass" },
      { slug: "pressed_glass",    label: "Pressed & Pattern Glass" },
      { slug: "art_nouveau_glass",label: "Art Nouveau Glass (Tiffany, Gallé)" },
      { slug: "barware",          label: "Barware & Stemware Sets" },
    ],
    attributeFilters: [],
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
    subcategories: [
      { slug: "advertising",   label: "Advertising & Tins" },
      { slug: "sports",        label: "Sports Memorabilia" },
      { slug: "political",     label: "Political & Historical" },
      { slug: "militaria",     label: "Militaria & Medals" },
      { slug: "holiday",       label: "Holiday & Seasonal" },
      { slug: "americana",     label: "Americana & Folk" },
      { slug: "sci_fi_pop",    label: "Sci-Fi & Pop Culture" },
      { slug: "trains_models", label: "Trains & Model Vehicles" },
    ],
    attributeFilters: [],
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
    subcategories: [
      { slug: "wristwatches",       label: "Wristwatches" },
      { slug: "pocket_watches",     label: "Pocket Watches" },
      { slug: "mantel_clocks",      label: "Mantel & Shelf Clocks" },
      { slug: "wall_clocks",        label: "Wall & Bracket Clocks" },
      { slug: "grandfather_clocks", label: "Tall-Case / Grandfather" },
      { slug: "travel_clocks",      label: "Travel & Carriage Clocks" },
    ],
    attributeFilters: [
      {
        key: "movement",
        label: "Movement",
        type: "select",
        options: [
          { value: "manual",    label: "Manual Wind" },
          { value: "automatic", label: "Automatic / Self-Winding" },
          { value: "quartz",    label: "Quartz / Battery" },
          { value: "pocket",    label: "Pocket Watch Movement" },
        ],
      },
      {
        key: "case_material",
        label: "Case Material",
        type: "select",
        options: [
          { value: "yellow_gold", label: "Yellow Gold" },
          { value: "white_gold",  label: "White Gold" },
          { value: "rose_gold",   label: "Rose Gold" },
          { value: "stainless",   label: "Stainless Steel" },
          { value: "silver",      label: "Silver" },
          { value: "gold_filled", label: "Gold Filled" },
          { value: "base_metal",  label: "Base Metal / Chrome" },
        ],
      },
      {
        key: "has_box",
        label: "Includes Box",
        type: "checkbox",
        options: [{ value: "true", label: "Original box included" }],
      },
      {
        key: "has_papers",
        label: "Includes Papers",
        type: "checkbox",
        options: [{ value: "true", label: "Papers / warranty card included" }],
      },
    ],
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
    subcategories: [
      { slug: "first_editions", label: "First Editions & Rare Books" },
      { slug: "illustrated",    label: "Illustrated & Children's Books" },
      { slug: "maps",           label: "Antique Maps & Atlases" },
      { slug: "manuscripts",    label: "Manuscripts & Documents" },
      { slug: "postcards",      label: "Postcards & Trade Cards" },
      { slug: "photographs",    label: "Antique Photographs" },
      { slug: "magazines",      label: "Vintage Magazines & Periodicals" },
    ],
    attributeFilters: [],
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
    subcategories: [
      { slug: "us_coins",   label: "US Coins" },
      { slug: "world_coins",label: "World / Foreign Coins" },
      { slug: "currency",   label: "Paper Currency & Banknotes" },
      { slug: "medals",     label: "Medals & Awards" },
      { slug: "tokens",     label: "Tokens & Exonumia" },
      { slug: "gold_coins", label: "Gold Coins" },
    ],
    attributeFilters: [
      {
        key: "grade",
        label: "Grade",
        type: "select",
        options: [
          { value: "ms65_plus", label: "MS-65+ (Gem Uncirculated)" },
          { value: "ms60_64",   label: "MS-60–64 (Uncirculated)" },
          { value: "au",        label: "AU (About Uncirculated)" },
          { value: "ef_xf",     label: "EF / XF (Extremely Fine)" },
          { value: "vf",        label: "VF (Very Fine)" },
          { value: "f",         label: "F (Fine)" },
          { value: "vg_g",      label: "VG / G (Good)" },
        ],
      },
      {
        key: "grading_service",
        label: "Graded By",
        type: "select",
        options: [
          { value: "pcgs", label: "PCGS" },
          { value: "ngc",  label: "NGC" },
          { value: "anacs",label: "ANACS" },
          { value: "raw",  label: "Raw / Ungraded" },
        ],
      },
    ],
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
    subcategories: [
      { slug: "dresses",     label: "Dresses & Gowns" },
      { slug: "suits",       label: "Suits & Tailoring" },
      { slug: "furs",        label: "Furs & Outerwear" },
      { slug: "accessories", label: "Accessories (Bags, Hats)" },
      { slug: "evening_wear",label: "Beaded & Evening Wear" },
      { slug: "sportswear",  label: "Vintage Sportswear" },
    ],
    attributeFilters: [],
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
    subcategories: [
      { slug: "hand_planes",    label: "Hand Planes" },
      { slug: "measuring",      label: "Measuring & Layout Tools" },
      { slug: "edge_tools",     label: "Chisels & Edge Tools" },
      { slug: "saws",           label: "Saws & Sawing Tools" },
      { slug: "braces_bits",    label: "Braces & Bits" },
      { slug: "levels",         label: "Levels & Plumb Bobs" },
      { slug: "patented_tools", label: "Patented & Unusual Tools" },
    ],
    attributeFilters: [],
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
    subcategories: [
      { slug: "radios",      label: "Radios (Tube & Transistor)" },
      { slug: "cameras",     label: "Cameras & Photography" },
      { slug: "hi_fi_audio", label: "Hi-Fi & Turntables" },
      { slug: "televisions", label: "Vintage Televisions" },
      { slug: "scientific",  label: "Scientific Instruments" },
      { slug: "telephones",  label: "Telephones & Telegraph" },
    ],
    attributeFilters: [],
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
    subcategories: [
      { slug: "cast_iron",     label: "Cast Iron Banks & Vehicles" },
      { slug: "tin_toys",      label: "Tin Lithograph Toys" },
      { slug: "pressed_steel", label: "Pressed Steel & Die-Cast" },
      { slug: "dolls",         label: "Dolls & Paper Dolls" },
      { slug: "board_games",   label: "Board Games & Card Games" },
      { slug: "trains",        label: "Trains & Train Sets" },
      { slug: "holiday_ornaments", label: "Holiday Ornaments & Decorations" },
    ],
    attributeFilters: [],
  },
];

/** Fast lookup: slug → metadata */
export const CATEGORY_MAP: Record<string, CategoryMeta> = Object.fromEntries(
  CATEGORIES.map((c) => [c.slug, c])
);

/** Ordered slugs for the sidebar filter (must stay in sync with CATEGORIES) */
export const CATEGORY_SLUGS = CATEGORIES.map((c) => c.slug);

/**
 * Map a raw scraper category string (e.g. "Jewelry & Watches", "Fine Art",
 * "Ceramics & Porcelain") to a canonical slug.  Returns null when no match.
 */
const _SLUG_KEYWORDS: Array<{ slug: string; keywords: string[] }> = [
  { slug: "jewelry",      keywords: ["jewel", "gemstone", "necklace", "bracelet", "brooch", "pendant", "earring", "ring"] },
  { slug: "art",          keywords: ["painting", "fine art", "artwork", "watercolor", "watercolour", "lithograph", "etching", "sculpture", "drawing", "portrait", "oil on", "prints"] },
  { slug: "ceramics",     keywords: ["ceramic", "porcelain", "pottery", "stoneware", "earthenware", "china", "figurine", "wedgwood", "meissen", "delft", "majolica"] },
  { slug: "silver",       keywords: ["silver", "pewter", "bronze", "flatware", "hollowware", "metalware"] },
  { slug: "furniture",    keywords: ["furniture", "cabinet", "dresser", "chest of", "dining table", "armoire", "bookcase", "secretary desk", "highboy", "lowboy", "sideboard"] },
  { slug: "glass",        keywords: ["glass", "crystal", "glassware", "depression glass", "art glass", "lalique", "steuben", "waterford", "baccarat"] },
  { slug: "collectibles", keywords: ["collectible", "memorabilia", "advertising", "americana", "militaria", "political", "folk art"] },
  { slug: "watches",      keywords: ["watch", "clock", "timepiece", "pocket watch", "wristwatch", "horology"] },
  { slug: "books",        keywords: ["book", "manuscript", "map", "ephemera", "postcard", "first edition", "document", "bible"] },
  { slug: "coins",        keywords: ["coin", "currency", "medal", "token", "numismatic"] },
  { slug: "clothing",     keywords: ["clothing", "fashion", "textile", "vintage wear", "apparel", "costume"] },
  { slug: "tools",        keywords: ["tool", "workshop", "hand tool", "plane", "wrench", "chisel"] },
  { slug: "electronics",  keywords: ["radio", "camera", "electronics", "audio", "turntable", "hi-fi", "television", "scientific instrument"] },
  { slug: "toys",         keywords: ["toy", "game", "doll", "cast iron", "tin toy", "board game", "holiday ornament"] },
];

export function categoryToSlug(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (CATEGORY_MAP[lower]) return lower;  // exact slug match
  for (const { slug, keywords } of _SLUG_KEYWORDS) {
    if (keywords.some((kw) => lower.includes(kw))) return slug;
  }
  return null;
}
