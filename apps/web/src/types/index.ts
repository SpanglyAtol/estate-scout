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

export interface Listing {
  id: number;
  platform: Platform;
  external_id: string;
  external_url: string;
  title: string;
  description: string | null;
  category: string | null;
  condition: string | null;
  current_price: number | null;
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
  sort?: "ending_soon" | "price_asc" | "price_desc" | "newest";
  page?: number;
  page_size?: number;
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

export interface ValuationResult {
  query: string;
  price_range: PriceRange;
  comparable_sales: CompSale[];
  narrative: string;
  data_source: "ai" | "comps_only" | "no_data";
  cached: boolean;
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
