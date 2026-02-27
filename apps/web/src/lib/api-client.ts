import type { Listing, SearchFilters, ValuationRequest, ValuationResult } from "../types";

// On Vercel, NEXT_PUBLIC_API_URL is set to the production URL.
// VERCEL_URL is auto-injected by Vercel on every build as a server-side fallback.
// Locally, .env.local sets NEXT_PUBLIC_API_URL=http://localhost:3000.
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("estate_scout_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    // Scraped data changes on every hydrate run — never serve stale route cache
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new ApiError(res.status, body.detail ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

function toQueryString(params: Record<string, unknown>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") {
      if (Array.isArray(v)) {
        v.forEach((item) => qs.append(k, String(item)));
      } else {
        qs.set(k, String(v));
      }
    }
  }
  return qs.toString();
}

// --- Stats ---

export interface StatsResult {
  total: number;
  live: number;
  upcoming: number;
  ended: number;
  ending_soon: number;
  platforms: number;
  categories: Record<string, number>;
  scraped_at: string | null;
}

export async function getStats(): Promise<StatsResult> {
  return request<StatsResult>("/api/v1/stats");
}

// --- Listings ---

export async function getListings(params: { page?: number; page_size?: number } = {}) {
  return request<Listing[]>(`/api/v1/listings?${toQueryString(params)}`);
}

export async function getListing(id: number) {
  return request<Listing>(`/api/v1/listings/${id}`);
}

// --- Search ---

export async function searchListings(filters: SearchFilters) {
  return request<Listing[]>(`/api/v1/search?${toQueryString(filters as Record<string, unknown>)}`);
}

// --- Valuation ---

export async function getValuation(payload: ValuationRequest) {
  return request<ValuationResult>("/api/v1/valuation/query", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// --- Health ---

export async function getHealth() {
  return request<{ status: string; environment?: string }>("/health/");
}

// --- Saved Searches ---

export interface SavedSearch {
  id: number;
  name: string;
  query_text: string | null;
  filters: Record<string, unknown>;
  notify_email: boolean;
  created_at: string;
}

export async function getSavedSearches() {
  return request<SavedSearch[]>("/api/v1/saved-searches/");
}

export async function createSavedSearch(data: {
  name: string;
  query_text?: string;
  filters?: Record<string, unknown>;
  notify_email?: boolean;
}) {
  return request<SavedSearch>("/api/v1/saved-searches/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteSavedSearch(id: number) {
  return request<void>(`/api/v1/saved-searches/${id}`, { method: "DELETE" });
}

// --- Alerts ---

export interface AlertItem {
  id: number;
  name: string;
  query_text: string | null;
  max_price: number | null;
  is_active: boolean;
  notify_email: boolean;
  trigger_count: number;
  created_at: string;
}

export async function getAlerts() {
  return request<AlertItem[]>("/api/v1/alerts/");
}

export async function createAlert(data: {
  name: string;
  query_text?: string;
  max_price?: number;
  notify_email?: boolean;
}) {
  return request<AlertItem>("/api/v1/alerts/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function toggleAlert(id: number) {
  return request<{ id: number; is_active: boolean }>(`/api/v1/alerts/${id}/toggle`, {
    method: "PATCH",
  });
}

export async function deleteAlert(id: number) {
  return request<void>(`/api/v1/alerts/${id}`, { method: "DELETE" });
}

// --- Billing ---

export async function createCheckoutSession(plan: string = "pro") {
  return request<{ checkout_url: string }>("/api/v1/billing/create-checkout-session", {
    method: "POST",
    body: JSON.stringify({ plan }),
  });
}

export async function createPortalSession() {
  return request<{ portal_url: string }>("/api/v1/billing/portal", {
    method: "POST",
  });
}

export { ApiError };
