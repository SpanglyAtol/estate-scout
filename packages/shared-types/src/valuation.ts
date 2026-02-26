export interface CompSale {
  listing_id: number;
  title: string;
  final_price: number;
  sale_date: string | null;
  platform_display_name: string;
  /** Click-through URL to original listing */
  external_url: string;
  primary_image_url: string | null;
  condition: string | null;
  /** 0-1 cosine similarity score, higher = more similar */
  similarity_score?: number;
}

export interface PriceRange {
  low: number | null;
  mid: number | null;
  high: number | null;
  /** Number of comparable sales found */
  count: number;
  currency: string;
}

export type ValuationDataSource = "ai" | "comps_only" | "no_data";

export interface ValuationResult {
  query: string;
  price_range: PriceRange;
  comparable_sales: CompSale[];
  /** Human-readable valuation narrative */
  narrative: string;
  /** "ai" = LLM synthesis, "comps_only" = template, "no_data" = nothing found */
  data_source: ValuationDataSource;
  /** True if result was served from cache */
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
