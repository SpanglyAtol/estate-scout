import type { Listing, SearchFilters } from "@/types";

export interface AffiliateLink {
  label: string;
  keywords: string;
}

/** Static estate-sale prep links — shown when viewing an estate_sale listing. */
export const ESTATE_PREP_LINKS: AffiliateLink[] = [
  { label: "Packing & moving supplies",  keywords: "moving boxes packing supplies tape" },
  { label: "Storage & organization",     keywords: "storage bins closet organizers containers" },
  { label: "Antique cleaning & care",    keywords: "antique cleaning restoration care kit" },
];

const HIGH_VALUE = 200;
const MID_VALUE = 50;

function humanize(slug: string): string {
  return slug.replace(/_/g, " ");
}

/**
 * Price-tiered lifestyle / care suggestion.
 * High-value → luxury lifestyle (Diptyque, Le Labo, prestige accessories).
 * Mid-value  → care & display (cleaning kits, display stands).
 * Low-value  → practical supplies.
 */
function lifestyleLink(
  category: string | null,
  isHighValue: boolean,
  isMidValue: boolean
): AffiliateLink {
  if (isHighValue) {
    const map: Record<string, AffiliateLink> = {
      watches:   { label: "Watch winder box",        keywords: "luxury watch winder box" },
      jewelry:   { label: "Diptyque candle",          keywords: "diptyque candle" },
      silver:    { label: "Silverware chest",         keywords: "silverware storage chest cedar" },
      art:       { label: "Art exhibition catalog",   keywords: "art museum exhibition catalog book" },
      furniture: { label: "Diptyque diffuser",        keywords: "diptyque home diffuser fragrance" },
      ceramics:  { label: "Le Labo candle",           keywords: "le labo candle luxury" },
      coins:     { label: "Coin display case",        keywords: "luxury coin display case" },
    };
    return map[category ?? ""] ?? { label: "Diptyque candle", keywords: "diptyque candle luxury" };
  }
  if (isMidValue) {
    const map: Record<string, AffiliateLink> = {
      watches:   { label: "Watch display stand",      keywords: "watch display stand holder" },
      jewelry:   { label: "Jewelry cleaner kit",      keywords: "jewelry ultrasonic cleaner kit" },
      silver:    { label: "Silver polish cloth",      keywords: "silver polishing cloth kit" },
      art:       { label: "UV-protective frame",      keywords: "UV protective picture frame" },
      furniture: { label: "Furniture polish",         keywords: "antique furniture polish wax" },
      ceramics:  { label: "Display pedestal",         keywords: "acrylic display pedestal" },
      coins:     { label: "Coin holder pages",        keywords: "coin holder album pages" },
    };
    return map[category ?? ""] ?? { label: "Display case", keywords: "antique display case collector" };
  }
  // Low-value: practical
  const cat = humanize(category ?? "antique");
  return { label: `${cat} storage & supplies`, keywords: `${cat} storage packing supplies` };
}

/**
 * Build 3 contextual Amazon affiliate keyword sets from the active search filters.
 *
 * Priority: maker > brand > q > sub_category > period > category > country_of_origin.
 * The third link is always price-tiered (luxury lifestyle vs care vs supplies).
 */
export function buildSearchKeywords(filters: SearchFilters): AffiliateLink[] {
  const parts: string[] = [];

  if (filters.maker)                          parts.push(humanize(filters.maker));
  if (filters.brand && filters.brand !== filters.maker) parts.push(humanize(filters.brand));
  if (filters.q)                              parts.push(filters.q.trim());
  if (filters.sub_category)                   parts.push(humanize(filters.sub_category));
  if (filters.period)                         parts.push(humanize(filters.period));
  if (parts.length === 0 && filters.category) parts.push(humanize(filters.category));
  if (filters.country_of_origin)              parts.push(humanize(filters.country_of_origin));

  const base = Array.from(new Set(parts)).join(" ").trim();
  if (!base) return [];

  const price      = filters.max_price ?? filters.min_price ?? 0;
  const isHighValue = price >= HIGH_VALUE;
  const isMidValue  = price >= MID_VALUE && price < HIGH_VALUE;

  return [
    { label: `Shop: ${base}`,         keywords: base },
    { label: `Books on: ${base}`,     keywords: `${base} book guide reference` },
    lifestyleLink(filters.category ?? null, isHighValue, isMidValue),
  ];
}

/**
 * Build 3 contextual Amazon affiliate keyword sets from a fully-enriched listing.
 *
 * Extracts: category-specific attributes (model, piece_type, pattern_name, medium, style),
 * maker, brand, period, country_of_origin.  Third link is price-tiered.
 */
export function buildListingKeywords(listing: Listing): AffiliateLink[] {
  const category = listing.category ?? null;
  const attrs    = (listing.attributes ?? {}) as Record<string, unknown>;
  const parts: string[] = [];

  // Category-specific attribute — highest specificity signal
  if (category === "watches"   && attrs.model)        parts.push(String(attrs.model));
  if (category === "jewelry"   && attrs.piece_type)   parts.push(humanize(String(attrs.piece_type)));
  if (category === "silver"    && attrs.pattern_name) parts.push(String(attrs.pattern_name));
  if (category === "art"       && attrs.medium)       parts.push(humanize(String(attrs.medium)));
  if (category === "furniture" && attrs.style)        parts.push(humanize(String(attrs.style)));
  if (category === "furniture" && attrs.material)     parts.push(humanize(String(attrs.material)));
  if (category === "coins"     && attrs.denomination) parts.push(String(attrs.denomination));

  if (listing.maker)                                       parts.push(humanize(listing.maker));
  if (listing.brand && listing.brand !== listing.maker)    parts.push(humanize(listing.brand));
  if (category)                                            parts.push(humanize(category));
  if (listing.sub_category)                                parts.push(humanize(listing.sub_category));
  if (listing.period)                                      parts.push(humanize(listing.period));
  if (listing.country_of_origin && listing.country_of_origin !== "united_states")
                                                           parts.push(humanize(listing.country_of_origin));

  const base = Array.from(new Set(parts)).join(" ").trim() || listing.title.slice(0, 40);

  const price      = listing.estimate_high ?? listing.current_price ?? listing.estimate_low ?? 0;
  const isHighValue = price >= HIGH_VALUE;
  const isMidValue  = price >= MID_VALUE && price < HIGH_VALUE;

  // Category-specific primary accessory link
  const primaryMap: Record<string, AffiliateLink> = {
    watches:   { label: "Watch winder & storage",  keywords: `${base} watch winder storage case` },
    jewelry:   { label: "Jewelry cleaning kit",    keywords: `${base} jewelry cleaning care kit` },
    silver:    { label: "Silver polish & storage", keywords: `${base} silver polish tarnish storage` },
    art:       { label: "Museum-grade framing",    keywords: `${base} UV museum frame archival` },
    furniture: { label: "Care & restoration",      keywords: `${base} restoration polish care` },
    ceramics:  { label: "Display & storage",       keywords: `${base} display stand padded storage` },
    coins:     { label: "Coin storage & grading",  keywords: `${base} coin storage album slab` },
  };
  const primary = primaryMap[category ?? ""] ?? { label: `Shop: ${base}`, keywords: base };

  const makerLabel = listing.maker ? humanize(listing.maker) : (category ?? "antique");

  return [
    primary,
    { label: `${makerLabel} reference books`,    keywords: `${base} book reference collector guide` },
    lifestyleLink(category, isHighValue, isMidValue),
  ];
}
