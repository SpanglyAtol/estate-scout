// Re-export all shared types used by the web app.
// When the shared-types package is built and linked, swap these imports.
// For now, they're duplicated here so the web app works standalone.

export interface Platform {
  id: number;
  name: string;
  display_name: string;
  base_url: string;
  logo_url: string | null;
}

export interface AuctionItem {
  title: string;
  lot_number: string | null;
  description: string | null;
  current_price: number | null;
  estimate_low: number | null;
  estimate_high: number | null;
  primary_image_url: string | null;
  image_urls: string[];
  category: string | null;
  condition: string | null;
  external_url: string | null;
}

/**
 * Category-specific structured attributes extracted at ingest time by enricher.py.
 * Keys vary by category — always check for undefined before use.
 *
 * Watches: model, movement, case_material, case_size_mm, dial_color, complications[],
 *          bracelet, has_box, has_papers, is_vintage, year_approx
 * Jewelry: piece_type, metal, primary_stone, secondary_stones[], carat_weight, is_signed
 * Ceramics: sub_type, style, piece_count, pattern_name, is_marked
 * Silver: purity, sub_type, piece_count, pattern_name, weight_oz
 * Art:    medium, is_signed, is_framed, subject, width_in, height_in, edition_number
 * Furniture: style, material, piece_type, is_pair
 * Coins: grade, grading_service, denomination, metal, year
 */
export type ListingAttributes = Record<string, string | number | boolean | string[] | undefined>;

export interface Listing {
  id: number;
  platform: Platform;
  external_id: string;
  external_url: string;
  title: string;
  description: string | null;
  category: string | null;
  condition: string | null;
  listing_type?: 'auction' | 'estate_sale' | 'buy_now';
  item_type?: 'individual_item' | 'lot' | 'estate_sale' | 'auction_catalog';
  current_price: number | null;
  buy_now_price?: number | null;
  estimate_low?: number | null;
  estimate_high?: number | null;
  final_price: number | null;
  is_completed: boolean;
  auction_status?: 'upcoming' | 'live' | 'ended' | 'completed' | 'unknown';
  buyers_premium_pct: number | null;
  total_cost_estimate: number | null;
  pickup_only: boolean;
  ships_nationally: boolean;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  latitude: number | null;
  longitude: number | null;
  sale_ends_at: string | null;
  sale_starts_at: string | null;
  primary_image_url: string | null;
  image_urls: string[];
  scraped_at: string;
  distance_miles?: number;
  is_sponsored?: boolean;
  items?: AuctionItem[];
  // ── Enriched structured fields ──────────────────────────────────────────────
  /** Normalized maker/manufacturer slug, e.g. "rolex", "haviland", "gorham" */
  maker?: string | null;
  /** Normalized brand slug — same as maker for most items; differs for designer/licensed goods */
  brand?: string | null;
  /** Non-empty only for collaboration items, e.g. ["louis_vuitton", "supreme"] */
  collaboration_brands?: string[];
  /** Era/style period slug, e.g. "art_deco", "mid_century_modern", "victorian" */
  period?: string | null;
  /** Country of manufacture slug, e.g. "france", "england", "japan" */
  country_of_origin?: string | null;
  /** Category-specific structured data — see ListingAttributes JSDoc above */
  attributes?: ListingAttributes;
  /** Sub-category slug, e.g. "art_pottery", "oil_painting", "pocket_watches" */
  sub_category?: string | null;
}

export interface SearchFilters {
  q?: string;
  lat?: number;
  lon?: number;
  radius_miles?: number;
  min_price?: number;
  max_price?: number;
  pickup_only?: boolean;
  ending_hours?: number;
  category?: string;
  platform_ids?: number[];
  status?: string;
  listing_type?: 'auction' | 'estate_sale' | 'buy_now';
  item_type?: 'individual_item' | 'lot' | 'estate_sale' | 'auction_catalog';
  sort?: "ending_soon" | "price_asc" | "price_desc" | "newest";
  page?: number;
  page_size?: number;
  // ── Enriched field filters ──────────────────────────────────────────────────
  /** Filter by maker slug, e.g. "rolex", "wedgwood", "gorham" */
  maker?: string;
  /** Filter by brand slug */
  brand?: string;
  /** Filter by era/style period slug, e.g. "art_deco", "victorian" */
  period?: string;
  /** Filter by country of origin slug, e.g. "france", "england" */
  country_of_origin?: string;
  /** Filter to items that include this brand in a collaboration */
  collaboration?: string;
}

export interface CompSale {
  listing_id: number;
  title: string;
  final_price: number;
  sale_date: string | null;
  platform_display_name: string;
  external_url: string;
  primary_image_url: string | null;
  condition: string | null;
  similarity_score?: number;
}

export interface PriceRange {
  low: number | null;
  mid: number | null;
  high: number | null;
  count: number;
  currency: string;
}

export interface SpreadBucket {
  label: string;
  count: number;
}

export type ConfidenceLevel = "high" | "medium" | "low" | "insufficient";

export interface ValuationResult {
  query: string;
  price_range: PriceRange;
  comparable_sales: CompSale[];
  narrative: string;
  data_source: "ai" | "comps_only" | "no_data";
  cached: boolean;
  // ── Layer 3: variance-aware enrichment ─────────────────────────────────────
  /** Overall confidence in the price range estimate */
  confidence_level: ConfidenceLevel;
  /** Human-readable reason for the confidence level */
  confidence_reason: string;
  /** Price distribution buckets for the spread histogram */
  price_spread: SpreadBucket[];
  /** What the user can add to get a more accurate estimate */
  clarifying_prompts: string[];
  /** What the query parser detected (e.g. "Rolex · watches") */
  detection_summary: string | null;
  /** True when the query references a high-ambiguity category without enough specifics */
  is_high_ambiguity: boolean;
}

export interface ValuationRequest {
  query_text: string;
  image_url?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  result?: ValuationResult;
  timestamp: string;
}
