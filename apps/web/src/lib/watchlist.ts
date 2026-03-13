/**
 * Client-side watchlist (saved listings).
 * Persists to localStorage so it works for anonymous users without a backend.
 * Stored under the key `estate-scout-watchlist` as a JSON array of WatchItem.
 */

export interface WatchItem {
  id: number;
  title: string;
  primary_image_url: string | null;
  current_price: number | null;
  external_url: string;
  platform_name: string;
  category: string | null;
  sale_ends_at: string | null;
  saved_at: string; // ISO 8601
}

const STORAGE_KEY = "estate-scout-watchlist";

function load(): WatchItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function persist(items: WatchItem[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function getWatchlist(): WatchItem[] {
  return load();
}

export function isWatched(id: number): boolean {
  return load().some((i) => i.id === id);
}

export function addToWatchlist(item: Omit<WatchItem, "saved_at">): void {
  const items = load().filter((i) => i.id !== item.id); // dedupe
  persist([{ ...item, saved_at: new Date().toISOString() }, ...items]);
}

export function removeFromWatchlist(id: number): void {
  persist(load().filter((i) => i.id !== id));
}

export function toggleWatchlist(item: Omit<WatchItem, "saved_at">): boolean {
  if (isWatched(item.id)) {
    removeFromWatchlist(item.id);
    return false;
  }
  addToWatchlist(item);
  return true;
}
