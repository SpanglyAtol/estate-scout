/**
 * Estate Scout mobile API client.
 * All API calls go through here — no scattered `fetch` calls in screens.
 *
 * Set EXPO_PUBLIC_API_URL in your .env (or the root .env):
 *   EXPO_PUBLIC_API_URL=http://localhost:8000
 *   EXPO_PUBLIC_API_URL=http://192.168.1.X:8000   ← for physical device
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';
const TOKEN_KEY = 'estate_scout_token';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Platform {
  id: number;
  name: string;
  display_name: string;
  base_url: string;
  logo_url: string | null;
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
  buyers_premium_pct: number | null;
  total_cost_estimate: number | null;
  pickup_only: boolean;
  ships_nationally: boolean;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  sale_ends_at: string | null;
  sale_starts_at: string | null;
  primary_image_url: string | null;
  image_urls: string[];
  scraped_at: string;
  distance_miles?: number;
  is_sponsored?: boolean;
}

export interface ValuationResult {
  query: string;
  price_range: {
    low: number | null;
    mid: number | null;
    high: number | null;
    count: number;
    currency: string;
  };
  comparable_sales: Array<{
    listing_id: number;
    title: string;
    final_price: number;
    sale_date: string | null;
    platform_display_name: string;
    external_url: string;
    primary_image_url: string | null;
    similarity_score?: number;
  }>;
  narrative: string;
  data_source: 'ai' | 'comps_only' | 'no_data';
  cached: boolean;
}

export interface AuthToken {
  access_token: string;
  token_type: string;
}

export interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  tier: string;
  valuation_queries_this_month: number;
  created_at: string;
}

export interface SearchParams {
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
  page?: number;
  page_size?: number;
}

// ─── Token management ─────────────────────────────────────────────────────────

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

// ─── Core request helper ──────────────────────────────────────────────────────

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function buildQuery(params: Record<string, unknown>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      value.forEach((v) => qs.append(key, String(v)));
    } else {
      qs.set(key, String(value));
    }
  }
  return qs.toString() ? `?${qs.toString()}` : '';
}

// ─── Listings ─────────────────────────────────────────────────────────────────

export function getListings(
  page = 1,
  pageSize = 24,
): Promise<Listing[]> {
  return request<Listing[]>(
    `/api/v1/listings${buildQuery({ page, page_size: pageSize })}`,
  );
}

export function getListing(id: number): Promise<Listing> {
  return request<Listing>(`/api/v1/listings/${id}`);
}

// ─── Search ───────────────────────────────────────────────────────────────────

export function searchListings(params: SearchParams): Promise<Listing[]> {
  return request<Listing[]>(`/api/v1/search${buildQuery(params as Record<string, unknown>)}`);
}

// ─── Valuation ────────────────────────────────────────────────────────────────

export function getValuation(queryText: string): Promise<ValuationResult> {
  return request<ValuationResult>('/api/v1/valuation/query', {
    method: 'POST',
    body: JSON.stringify({ query_text: queryText }),
  });
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function register(
  email: string,
  password: string,
  displayName?: string,
): Promise<void> {
  const data = await request<AuthToken>('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, display_name: displayName }),
  });
  await setToken(data.access_token);
}

export async function login(email: string, password: string): Promise<void> {
  const data = await request<AuthToken>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  await setToken(data.access_token);
}

export async function logout(): Promise<void> {
  await clearToken();
}

export function getProfile(): Promise<UserProfile> {
  return request<UserProfile>('/api/v1/auth/me');
}

// ─── Saved searches ───────────────────────────────────────────────────────────

export interface SavedSearch {
  id: number;
  name: string;
  query_text: string | null;
  filters: Record<string, unknown>;
  notify_email: boolean;
  created_at: string;
}

export function getSavedSearches(): Promise<SavedSearch[]> {
  return request<SavedSearch[]>('/api/v1/saved-searches/');
}

export function createSavedSearch(data: {
  name: string;
  query_text?: string;
  filters?: Record<string, unknown>;
  notify_email?: boolean;
}): Promise<SavedSearch> {
  return request<SavedSearch>('/api/v1/saved-searches/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function deleteSavedSearch(id: number): Promise<void> {
  return request<void>(`/api/v1/saved-searches/${id}`, { method: 'DELETE' });
}

// ─── Alerts ───────────────────────────────────────────────────────────────────

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

export function getAlerts(): Promise<AlertItem[]> {
  return request<AlertItem[]>('/api/v1/alerts/');
}

export function createAlert(data: {
  name: string;
  query_text?: string;
  max_price?: number;
  notify_email?: boolean;
}): Promise<AlertItem> {
  return request<AlertItem>('/api/v1/alerts/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function toggleAlert(id: number): Promise<{ id: number; is_active: boolean }> {
  return request(`/api/v1/alerts/${id}/toggle`, { method: 'PATCH' });
}

export function deleteAlert(id: number): Promise<void> {
  return request<void>(`/api/v1/alerts/${id}`, { method: 'DELETE' });
}

// ─── Health ───────────────────────────────────────────────────────────────────

export function checkHealth(): Promise<{ status: string; environment: string }> {
  return request('/health/');
}
