export interface Platform {
  id: number;
  name: string;           // 'liveauctioneers', 'estatesales_net', etc.
  display_name: string;   // 'LiveAuctioneers', 'EstateSales.NET', etc.
  base_url: string;
  logo_url: string | null;
}

export type ListingCondition = "excellent" | "good" | "fair" | "poor";

export interface Listing {
  id: number;
  platform: Platform;
  external_id: string;
  /** Always redirect here - we never handle transactions directly */
  external_url: string;
  title: string;
  description: string | null;
  category: string | null;
  condition: ListingCondition | null;

  // Pricing
  current_price: number | null;
  final_price: number | null;
  is_completed: boolean;
  /** e.g. 25 means 25% buyer's premium on top of the hammer price */
  buyers_premium_pct: number | null;
  /** current_price * (1 + buyers_premium_pct/100) - shown as "your total cost" */
  total_cost_estimate: number | null;

  // Fulfillment
  pickup_only: boolean;
  ships_nationally: boolean;

  // Location
  city: string | null;
  state: string | null;
  zip_code: string | null;
  latitude: number | null;
  longitude: number | null;

  // Timing (ISO 8601 strings)
  sale_ends_at: string | null;
  sale_starts_at: string | null;

  // Media
  primary_image_url: string | null;
  image_urls: string[];

  scraped_at: string;

  // Computed by API
  distance_miles?: number;
  is_sponsored?: boolean;
}

export interface SearchFilters {
  q?: string;
  lat?: number;
  lon?: number;
  /** Default 50, max 500 */
  radius_miles?: number;
  min_price?: number;
  max_price?: number;
  pickup_only?: boolean;
  /** Items ending within N hours */
  ending_hours?: number;
  category?: string;
  platform_ids?: number[];
  page?: number;
  page_size?: number;
}

export const CATEGORIES = [
  "ceramics",
  "furniture",
  "jewelry",
  "art",
  "silver",
  "glass",
  "books",
  "clothing",
  "tools",
  "electronics",
  "collectibles",
  "other",
] as const;

export type Category = (typeof CATEGORIES)[number];
