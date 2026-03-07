/**
 * Query Parser — Layer 3 of the enrichment pipeline
 * ────────────────────────────────────────────────────
 * TypeScript counterpart to enricher.py's detection dictionaries.
 * Parses a user's free-text price-check query into structured signals:
 *
 *   - detected category (watches / ceramics / silver / etc.)
 *   - detected maker slug + display label (e.g. "rolex" / "Rolex")
 *   - detected period / style
 *   - which key attributes are MISSING for the detected category
 *   - clarifying prompts to surface in the UI when confidence is low
 *   - an "ambiguity score" that drives the confidence badge
 *
 * Nothing here makes network calls or reads files — pure deterministic
 * string matching, same approach as enricher.py.
 */

// ── Stop words ────────────────────────────────────────────────────────────────
const STOP_WORDS = new Set([
  "the", "and", "for", "with", "this", "that", "from", "circa", "piece",
  "item", "very", "good", "fine", "rare", "nice", "old", "new", "set",
  "pair", "lot", "one", "two", "has", "not", "are", "was", "its", "all",
  "any", "our", "can", "but", "have", "been", "some", "made", "will",
  "signed", "original", "antique", "vintage", "estate", "auction", "sale",
  "condition", "excellent", "mint", "used", "marks", "marked", "base",
  "height", "inches", "diameter", "width", "length", "weight", "grams",
  "circa", "century", "period",
]);

// ── Category detection keywords ───────────────────────────────────────────────
// Ordered: first match wins. Watches before jewelry; coins/cards before collectibles.
const CATEGORY_SIGNALS: [string, string[]][] = [
  ["watches", [
    " watch", "wristwatch", "pocket watch", "chronograph", "timepiece",
    "automatic watch", "mechanical watch", "quartz watch",
    "submariner", "daytona", "speedmaster", "datejust", "day-date",
    "seamaster", "tank watch", "santos watch", "royal oak", "nautilus watch",
    "patek philippe", "vacheron constantin", "audemars piguet",
    "jaeger-lecoultre", "breitling navitimer", "tag heuer",
  ]],
  ["jewelry", [
    "jewelry", "jewellery", " ring ", " rings ", "necklace", "bracelet",
    "earring", "pendant", "diamond", "sapphire", "ruby", "emerald", "pearl",
    "brooch", "cufflink", "gemstone", "opal", "amethyst", "turquoise",
    "engagement ring", "wedding band",
  ]],
  ["art", [
    "painting", "watercolor", "watercolour", "lithograph", "etching",
    "sculpture", " print", "artwork", "portrait", "canvas", "oil on",
    "gouache", "pastel", "acrylic painting", "framed art", "signed print",
  ]],
  ["ceramics", [
    "ceramic", "pottery", "vase", "porcelain", "stoneware", "earthenware",
    "majolica", "wedgwood", "meissen", "imari", "figurine", "platter",
    "teapot", "transferware", "flow blue", "ironstone", "bone china",
    "limoges", "noritake", "royal doulton", "royal worcester",
    "tea set", "dinner set", "dessert set", "service for",
  ]],
  ["glass", [
    " glass", "crystal", "stemware", "decanter", "art glass",
    "blown glass", "carnival glass", "depression glass", "steuben", "lalique",
  ]],
  ["silver", [
    "sterling silver", "sterling", "silverware", "flatware", "epns",
    "silver plate", "silverplate", "coin silver", "silver tea",
    "silver tray", "silver bowl", "gorham silver", "reed & barton",
  ]],
  ["coins", [
    " coin ", " coins ", "numismatic", "morgan dollar", "liberty dollar",
    "double eagle", "gold eagle", "silver dollar", "pcgs", "ngc graded",
    "uncirculated", "bullion",
  ]],
  ["trading_cards", [
    "trading card", "baseball card", "football card", "basketball card",
    "sports card", "pokemon card", "psa graded", "rookie card",
  ]],
  ["furniture", [
    "furniture", "armchair", "sofa", "settee", "dining table", "coffee table",
    "chest of drawers", "dresser", "cabinet", "bookcase", "wardrobe",
    "secretary desk", "highboy", "sideboard",
  ]],
];

// ── Maker detection: slug → [keywords] ───────────────────────────────────────
// Listed in priority order within each category (specific before generic).

const WATCH_MAKERS: [string, string, string[]][] = [
  // [slug, displayLabel, keywords]
  ["patek_philippe",      "Patek Philippe",      ["patek philippe"]],
  ["audemars_piguet",     "Audemars Piguet",     ["audemars piguet"]],
  ["vacheron_constantin", "Vacheron Constantin", ["vacheron constantin"]],
  ["jaeger_lecoultre",    "Jaeger-LeCoultre",    ["jaeger-lecoultre", "jaeger lecoultre", "jlc"]],
  ["a_lange_sohne",       "A. Lange & Söhne",    ["a. lange", "lange sohne"]],
  ["richard_mille",       "Richard Mille",       ["richard mille"]],
  ["rolex",               "Rolex",               ["rolex"]],
  ["cartier",             "Cartier",             ["cartier"]],
  ["omega",               "Omega",               ["omega watch", "omega speedmaster", "omega seamaster",
                                                   "omega constellation", "omega de ville"]],
  ["iwc",                 "IWC",                 ["iwc", "international watch company"]],
  ["breitling",           "Breitling",           ["breitling", "navitimer", "chronomat"]],
  ["tag_heuer",           "TAG Heuer",           ["tag heuer", "tag-heuer", "heuer"]],
  ["tudor",               "Tudor",               ["tudor watch", "tudor black bay", "tudor submariner"]],
  ["panerai",             "Panerai",             ["panerai", "luminor panerai", "radiomir"]],
  ["hublot",              "Hublot",              ["hublot"]],
  ["grand_seiko",         "Grand Seiko",         ["grand seiko"]],
  ["seiko",               "Seiko",               ["seiko"]],
  ["citizen",             "Citizen",             ["citizen watch"]],
  ["bulova",              "Bulova",              ["bulova", "accutron"]],
  ["hamilton",            "Hamilton",            ["hamilton watch"]],
  ["elgin",               "Elgin",               ["elgin watch", "elgin national"]],
  ["waltham",             "Waltham",             ["waltham watch"]],
  ["longines",            "Longines",            ["longines"]],
  ["tissot",              "Tissot",              ["tissot"]],
  ["movado",              "Movado",              ["movado"]],
];

const CERAMIC_MAKERS: [string, string, string[]][] = [
  ["meissen",           "Meissen",           ["meissen"]],
  ["rosenthal",         "Rosenthal",         ["rosenthal"]],
  ["kpm",               "KPM",               ["kpm"]],
  ["wedgwood",          "Wedgwood",          ["wedgwood"]],
  ["royal_doulton",     "Royal Doulton",     ["royal doulton"]],
  ["royal_crown_derby", "Royal Crown Derby", ["royal crown derby"]],
  ["spode",             "Spode",             ["spode"]],
  ["minton",            "Minton",            ["minton"]],
  ["royal_worcester",   "Royal Worcester",   ["royal worcester"]],
  ["shelley",           "Shelley",           ["shelley china"]],
  ["aynsley",           "Aynsley",           ["aynsley"]],
  ["haviland",          "Haviland",          ["haviland"]],
  ["bernardaud",        "Bernardaud",        ["bernardaud"]],
  ["herend",            "Herend",            ["herend"]],
  ["royal_copenhagen",  "Royal Copenhagen",  ["royal copenhagen"]],
  ["lenox",             "Lenox",             ["lenox"]],
  ["rookwood",          "Rookwood",          ["rookwood"]],
  ["weller",            "Weller",            ["weller pottery"]],
  ["roseville",         "Roseville",         ["roseville pottery"]],
  ["noritake",          "Noritake",          ["noritake"]],
  ["occupied_japan",    "Occupied Japan",    ["occupied japan"]],
  ["richard_ginori",    "Richard Ginori",    ["richard ginori", "ginori"]],
  ["limoges_generic",   "Limoges",           ["limoges"]],
];

const SILVER_MAKERS: [string, string, string[]][] = [
  ["gorham",        "Gorham",          ["gorham silver", "gorham sterling"]],
  ["tiffany_silver","Tiffany & Co",    ["tiffany & co silver", "tiffany silver"]],
  ["wallace",       "Wallace",         ["wallace sterling"]],
  ["reed_barton",   "Reed & Barton",   ["reed & barton"]],
  ["international", "International Silver", ["international silver"]],
  ["towle",         "Towle",           ["towle silver"]],
  ["jensen",        "Georg Jensen",    ["georg jensen", "george jensen"]],
  ["mappin_webb",   "Mappin & Webb",   ["mappin & webb"]],
  ["christofle",    "Christofle",      ["christofle"]],
];

const JEWELRY_BRANDS: [string, string, string[]][] = [
  ["tiffany",     "Tiffany & Co",        ["tiffany & co", "tiffany and co"]],
  ["cartier",     "Cartier",             ["cartier jewelry", "cartier ring", "cartier necklace",
                                          "cartier bracelet", "cartier love"]],
  ["van_cleef",   "Van Cleef & Arpels",  ["van cleef & arpels", "van cleef arpels"]],
  ["bulgari",     "Bulgari",             ["bulgari", "bvlgari"]],
  ["harry_winston","Harry Winston",      ["harry winston"]],
  ["david_yurman","David Yurman",        ["david yurman"]],
  ["mikimoto",    "Mikimoto",            ["mikimoto"]],
  ["jensen_jwl",  "Georg Jensen",        ["georg jensen jewelry", "georg jensen silver jewelry"]],
];

const FURNITURE_MAKERS: [string, string, string[]][] = [
  ["stickley",         "Stickley",         ["stickley", "gustav stickley", "l. & j.g. stickley"]],
  ["heywood_wakefield","Heywood-Wakefield",["heywood-wakefield", "heywood wakefield"]],
  ["herman_miller",    "Herman Miller",    ["herman miller"]],
  ["knoll",            "Knoll",            ["knoll furniture", "knoll international"]],
];

// Silver purity signals — resolving the silver/silverplate ambiguity is critical
const SILVER_PURITY_SIGNALS: [string, string, string[]][] = [
  ["sterling",   "sterling silver",  ["sterling silver", "sterling", "925 silver", ".925"]],
  ["coin_silver","coin silver",       ["coin silver", ".900 silver"]],
  ["silverplate","silver plate",      ["silver plate", "silverplate", "epns", "ep copper",
                                       "electroplated", "silver filled"]],
];

// ── Period detection ───────────────────────────────────────────────────────────
const PERIOD_SIGNALS: [string, string, string[]][] = [
  ["victorian",         "Victorian",          ["victorian"]],
  ["edwardian",         "Edwardian",          ["edwardian"]],
  ["art_nouveau",       "Art Nouveau",        ["art nouveau", "jugendstil"]],
  ["art_deco",          "Art Deco",           ["art deco", "art-deco"]],
  ["mid_century_modern","Mid-Century Modern", ["mid century modern", "mid-century modern", "mcm",
                                               "midcentury"]],
  ["arts_and_crafts",   "Arts & Crafts",      ["arts & crafts", "arts and crafts", "craftsman"]],
  ["georgian",          "Georgian",           ["georgian period", "george iii"]],
  ["regency",           "Regency",            ["regency period"]],
  ["empire",            "Empire",             ["empire style", "empire period"]],
];

// ── Category-specific clarification prompts ───────────────────────────────────
// What attributes matter most for accurate pricing in each category.

const CATEGORY_CLARIFICATIONS: Record<string, string[]> = {
  watches: [
    "Add the brand (e.g. Rolex, Omega, Seiko, Hamilton)",
    "Include the model name (e.g. Submariner, Speedmaster, Datejust)",
    "Mention condition and whether original box & papers are included",
    "Note the case material (stainless steel, gold, two-tone)",
  ],
  jewelry: [
    "Specify the metal type and purity (e.g. 18k gold, 925 sterling silver, platinum)",
    "Describe the main stone — type, color, and approximate size (e.g. 1ct diamond, blue sapphire)",
    "Mention the piece type (ring, necklace, bracelet, earrings)",
    "Note the maker or hallmarks if visible",
  ],
  ceramics: [
    "Add the manufacturer name (e.g. Wedgwood, Haviland, Royal Doulton, Meissen)",
    "Specify the piece type and count (e.g. 12-piece dinner service, single vase, figurine)",
    "Include the pattern name if you know it",
    "Mention country of origin if marked (e.g. Made in England, Limoges France)",
  ],
  silver: [
    "Clarify whether it's sterling silver or silver plate — this is the biggest price factor",
    "Add the maker's mark if visible (e.g. Gorham, Tiffany, Reed & Barton, Georg Jensen)",
    "Specify the piece type and count (e.g. 8-piece flatware service, tea service, single candlestick)",
    "Mention weight in troy ounces if known",
  ],
  art: [
    "Name the artist — this has the most impact on value",
    "Specify the medium (e.g. oil on canvas, watercolor, lithograph)",
    "Note whether it's signed and where",
    "Include dimensions and framing details",
  ],
  furniture: [
    "Identify the style period (e.g. Victorian, Art Deco, Mid-Century Modern)",
    "Note the primary material (e.g. mahogany, walnut, oak)",
    "Name the maker if any marks are present",
    "Describe any restoration or modifications",
  ],
  coins: [
    "Include the denomination and year (e.g. 1921 Morgan Dollar)",
    "Note the grading service and grade if certified (e.g. PCGS MS-64)",
    "Specify the mint mark (e.g. Philadelphia, Denver, San Francisco)",
  ],
  glass: [
    "Identify the maker if marked (e.g. Steuben, Lalique, Waterford, Tiffany Studios)",
    "Specify the type (e.g. art glass, carnival glass, pressed glass, crystal)",
    "Note any signatures or pontil marks",
  ],
};

// ── High-ambiguity category/attribute combinations ────────────────────────────
// These combinations produce extremely wide price spreads without more specifics.
const HIGH_AMBIGUITY_SIGNALS: { category: string; missingAttribute: string }[] = [
  { category: "ceramics",  missingAttribute: "maker" },
  { category: "jewelry",   missingAttribute: "metal" },
  { category: "silver",    missingAttribute: "purity" },
  { category: "art",       missingAttribute: "artist" },
  { category: "watches",   missingAttribute: "brand" },
];

// ── Main parse function ───────────────────────────────────────────────────────

export interface ParsedQuery {
  /** Raw keywords after stop-word filtering */
  keywords: string[];
  /** Detected category slug or null */
  category: string | null;
  /** Detected maker slug (e.g. "rolex", "haviland") or null */
  makerSlug: string | null;
  /** Display label for the detected maker (e.g. "Rolex", "Haviland") */
  makerLabel: string | null;
  /** Detected silver purity slug ("sterling" | "silverplate" | "coin_silver") */
  silverPurity: string | null;
  /** Detected period slug (e.g. "art_deco") */
  period: string | null;
  /** True if a specific maker was identified — enables hard maker filtering */
  isMakerSpecific: boolean;
  /** True if this is a category+query combination known to have very wide variance */
  isHighAmbiguity: boolean;
  /** Human-readable prompts for what to add to narrow the search */
  clarifyingPrompts: string[];
  /** Short phrase describing what was detected, for UI display */
  detectionSummary: string | null;
}

export function parseQuery(rawText: string): ParsedQuery {
  const text = rawText.toLowerCase();

  // Keywords (stop-word filtered, length > 2)
  const keywords = text
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  // Detect category
  let category: string | null = null;
  for (const [cat, signals] of CATEGORY_SIGNALS) {
    if (signals.some((s) => text.includes(s))) {
      category = cat;
      break;
    }
  }

  // Detect maker — check all maker lists based on or regardless of category
  let makerSlug: string | null = null;
  let makerLabel: string | null = null;

  const allMakerLists = [
    WATCH_MAKERS,
    CERAMIC_MAKERS,
    SILVER_MAKERS,
    JEWELRY_BRANDS,
    FURNITURE_MAKERS,
  ];

  outerLoop:
  for (const list of allMakerLists) {
    for (const [slug, label, kws] of list) {
      if (kws.some((kw) => text.includes(kw))) {
        makerSlug = slug;
        makerLabel = label;
        break outerLoop;
      }
    }
  }

  // Detect silver purity (critical disambiguation)
  let silverPurity: string | null = null;
  for (const [slug, , kws] of SILVER_PURITY_SIGNALS) {
    if (kws.some((kw) => text.includes(kw))) {
      silverPurity = slug;
      break;
    }
  }

  // Detect period
  let period: string | null = null;
  for (const [slug, , kws] of PERIOD_SIGNALS) {
    if (kws.some((kw) => text.includes(kw))) {
      period = slug;
      break;
    }
  }

  // Is maker specific?
  const isMakerSpecific = makerSlug !== null;

  // High ambiguity check
  let isHighAmbiguity = false;
  if (category) {
    for (const { category: ambigCat, missingAttribute } of HIGH_AMBIGUITY_SIGNALS) {
      if (category === ambigCat) {
        const missing =
          (missingAttribute === "maker"   && !makerSlug) ||
          (missingAttribute === "brand"   && !makerSlug) ||
          (missingAttribute === "purity"  && category === "silver" && !silverPurity) ||
          (missingAttribute === "metal"   && category === "jewelry" && !silverPurity && !makerSlug) ||
          (missingAttribute === "artist"  && category === "art" && !makerSlug);
        if (missing) {
          isHighAmbiguity = true;
          break;
        }
      }
    }
  }

  // Clarifying prompts — surface the most relevant ones first
  const prompts: string[] = [];
  if (category && CATEGORY_CLARIFICATIONS[category]) {
    const allPrompts = CATEGORY_CLARIFICATIONS[category];
    // If maker already known, skip the "add the brand/maker" prompt
    const filtered = makerSlug
      ? allPrompts.filter(
          (p) =>
            !p.toLowerCase().includes("manufacturer") &&
            !p.toLowerCase().includes("maker") &&
            !p.toLowerCase().includes("brand") &&
            !p.toLowerCase().includes("artist")
        )
      : allPrompts;
    // For silver, if purity is known skip the purity prompt
    const final =
      category === "silver" && silverPurity
        ? filtered.filter((p) => !p.toLowerCase().includes("sterling") && !p.toLowerCase().includes("silver plate"))
        : filtered;
    prompts.push(...final.slice(0, 3));
  }

  // Detection summary for UI
  let detectionSummary: string | null = null;
  if (makerLabel && category) {
    detectionSummary = `${makerLabel} · ${category}`;
  } else if (makerLabel) {
    detectionSummary = makerLabel;
  } else if (category) {
    detectionSummary = category.replace(/_/g, " ");
  }

  return {
    keywords,
    category,
    makerSlug,
    makerLabel,
    silverPurity,
    period,
    isMakerSpecific,
    isHighAmbiguity,
    clarifyingPrompts: prompts,
    detectionSummary,
  };
}

// ── Variance / confidence utilities ──────────────────────────────────────────

export interface PriceStats {
  mean: number;
  median: number;
  stddev: number;
  /** Coefficient of variation (stddev / mean). Higher = more spread. */
  cv: number;
  low: number;
  high: number;
  /** Trimmed range (10% each side) */
  trimmedLow: number;
  trimmedHigh: number;
  trimmedMid: number;
}

export function computePriceStats(prices: number[]): PriceStats | null {
  if (prices.length === 0) return null;
  const sorted = [...prices].sort((a, b) => a - b);
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  const variance = prices.reduce((a, b) => a + (b - mean) ** 2, 0) / prices.length;
  const stddev = Math.sqrt(variance);
  const cv = mean > 0 ? stddev / mean : 0;
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];

  const trimCount = prices.length >= 6 ? Math.max(1, Math.floor(prices.length * 0.1)) : 0;
  const trimmed = sorted.slice(trimCount, sorted.length - trimCount);

  return {
    mean,
    median,
    stddev,
    cv,
    low: sorted[0],
    high: sorted[sorted.length - 1],
    trimmedLow: trimmed[0] ?? sorted[0],
    trimmedHigh: trimmed[trimmed.length - 1] ?? sorted[sorted.length - 1],
    trimmedMid: trimmed[Math.floor(trimmed.length / 2)] ?? median,
  };
}

export type ConfidenceLevel = "high" | "medium" | "low" | "insufficient";

export interface ConfidenceResult {
  level: ConfidenceLevel;
  label: string;
  reason: string;
}

export function getConfidenceLevel(
  stats: PriceStats | null,
  parsed: ParsedQuery,
  compCount: number
): ConfidenceResult {
  if (compCount === 0 || !stats) {
    return {
      level: "insufficient",
      label: "No data",
      reason: "No comparable listings found for this query.",
    };
  }
  if (compCount < 2) {
    return {
      level: "insufficient",
      label: "Too few comps",
      reason: "Only one comparable found — not enough data for a reliable range.",
    };
  }

  const { cv } = stats;

  // High confidence: maker-specific query, low variance, enough comps
  if (parsed.isMakerSpecific && cv < 0.35 && compCount >= 3) {
    return {
      level: "high",
      label: "High confidence",
      reason: `${compCount} ${parsed.makerLabel ?? "maker-matched"} comparables with consistent pricing.`,
    };
  }

  // High confidence even without maker if variance is very low
  if (cv < 0.25 && compCount >= 4) {
    return {
      level: "high",
      label: "High confidence",
      reason: `${compCount} comparables with consistent pricing (low variance).`,
    };
  }

  // Medium: moderate variance or fewer comps
  if (cv < 0.55 && compCount >= 3) {
    return {
      level: "medium",
      label: "Moderate confidence",
      reason: cv < 0.4
        ? `${compCount} comparables found with moderate price variation.`
        : `Prices vary somewhat — condition and specifics likely matter.`,
    };
  }

  if (!parsed.isHighAmbiguity && compCount >= 2 && cv < 0.7) {
    return {
      level: "medium",
      label: "Moderate confidence",
      reason: `Limited comps (${compCount}) but reasonable consistency.`,
    };
  }

  // Low: high variance or known high-ambiguity category without maker
  return {
    level: "low",
    label: "High variance",
    reason: parsed.isHighAmbiguity
      ? `"${parsed.category}" covers many price tiers — the specific ${
          parsed.category === "silver" ? "purity and maker" :
          parsed.category === "ceramics" ? "manufacturer" :
          parsed.category === "jewelry" ? "metal and stone" :
          parsed.category === "art" ? "artist" :
          "maker"
        } drives value significantly.`
      : `Wide price spread (CV ${(cv * 100).toFixed(0)}%) across ${compCount} comparables.`,
  };
}

export interface SpreadBucket {
  label: string;
  count: number;
}

export function buildSpreadBuckets(prices: number[], bucketCount = 6): SpreadBucket[] {
  if (prices.length < 2) return [];
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (min === max) return [{ label: formatBucketPrice(min), count: prices.length }];

  const step = (max - min) / bucketCount;
  const buckets = Array.from({ length: bucketCount }, (_, i) => ({
    lo: min + i * step,
    count: 0,
  }));

  for (const p of prices) {
    const idx = Math.min(Math.floor((p - min) / step), bucketCount - 1);
    buckets[idx].count++;
  }

  return buckets.map(({ lo, count }) => ({
    label: formatBucketPrice(lo),
    count,
  }));
}

function formatBucketPrice(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${Math.round(n)}`;
}
