import type { SearchFilters } from "./listing";

export type UserTier = "free" | "pro" | "premium";

export interface User {
  id: string; // UUID
  email: string;
  display_name: string | null;
  tier: UserTier;
  valuation_queries_this_month: number;
  created_at: string;
}

export interface SavedSearch {
  id: number;
  name: string;
  query_text: string | null;
  filters: SearchFilters;
  last_run_at: string | null;
  result_count: number | null;
  notify_email: boolean;
  created_at: string;
}

export interface Alert {
  id: number;
  name: string;
  query_text: string | null;
  filters: SearchFilters;
  max_price: number | null;
  notify_email: boolean;
  notify_push: boolean;
  is_active: boolean;
  last_triggered_at: string | null;
  trigger_count: number;
  created_at: string;
}

export const TIER_LIMITS: Record<UserTier, { valuations: number; savedSearches: number }> = {
  free: { valuations: 5, savedSearches: 5 },
  pro: { valuations: 50, savedSearches: 100 },
  premium: { valuations: Infinity, savedSearches: Infinity },
};

export const TIER_PRICES: Record<Exclude<UserTier, "free">, number> = {
  pro: 19,
  premium: 79,
};
