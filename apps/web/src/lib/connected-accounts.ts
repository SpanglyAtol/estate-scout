/**
 * Connected Accounts — localStorage-based storage for user's external platform accounts.
 *
 * When a user connects their BidSpotter/HiBid/etc. account, we store:
 *  - their username on that platform (for display + deep-link back to their profile)
 *  - notification preferences (alert when new listings appear from that platform)
 *
 * Data lives client-side only until a real backend is wired up.
 * The `last_synced_at` timestamp tracks when we last cross-referenced our scraped
 * data against their connected platforms.
 */

const STORAGE_KEY = "estate_scout_connected_accounts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ConnectedAccount {
  id: string;
  platform_id: number;
  platform_name: string;
  platform_display_name: string;
  username: string;
  notify_new_lots: boolean;
  notify_ending_soon: boolean;
  created_at: string;
  last_synced_at: string | null;
  /** Cached count of our scraped listings from this platform at last sync. */
  cached_listing_count: number | null;
}

export interface PlatformConfig {
  id: number;
  name: string;
  display_name: string;
  emoji: string;
  color_class: string;
  url: string;
  /** URL to the user's account / watchlist page on the external site */
  account_url: string;
  /** Descriptive label for what connecting does */
  connect_hint: string;
}

// ── Platform registry ─────────────────────────────────────────────────────────

export const PLATFORM_CONFIGS: PlatformConfig[] = [
  {
    id: 1,
    name: "liveauctioneers",
    display_name: "LiveAuctioneers",
    emoji: "🏛",
    color_class: "bg-red-600",
    url: "https://www.liveauctioneers.com",
    account_url: "https://www.liveauctioneers.com/account/items/",
    connect_hint: "Track your watched lots and bid history",
  },
  {
    id: 2,
    name: "estatesales_net",
    display_name: "EstateSales.NET",
    emoji: "🏠",
    color_class: "bg-green-600",
    url: "https://www.estatesales.net",
    account_url: "https://www.estatesales.net/member/",
    connect_hint: "Follow estate sales and get day-of-sale reminders",
  },
  {
    id: 3,
    name: "hibid",
    display_name: "HiBid",
    emoji: "🔨",
    color_class: "bg-orange-500",
    url: "https://hibid.com",
    account_url: "https://hibid.com/account/",
    connect_hint: "Monitor auctions you're registered to bid in",
  },
  {
    id: 4,
    name: "maxsold",
    display_name: "MaxSold",
    emoji: "📦",
    color_class: "bg-purple-600",
    url: "https://maxsold.com",
    account_url: "https://maxsold.com/my-account/",
    connect_hint: "Track MaxSold online estate sales near you",
  },
  {
    id: 5,
    name: "bidspotter",
    display_name: "BidSpotter",
    emoji: "🎯",
    color_class: "bg-blue-600",
    url: "https://www.bidspotter.com",
    account_url: "https://www.bidspotter.com/en-us/my-bidspotter/",
    connect_hint: "Follow auction catalogues and bid live",
  },
];

// ── CRUD ──────────────────────────────────────────────────────────────────────

export function getConnectedAccounts(): ConnectedAccount[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function getConnectedAccount(platformId: number): ConnectedAccount | null {
  return getConnectedAccounts().find((a) => a.platform_id === platformId) ?? null;
}

export function connectAccount(
  platformId: number,
  username: string,
  opts: { notify_new_lots?: boolean; notify_ending_soon?: boolean } = {}
): ConnectedAccount {
  const platform = PLATFORM_CONFIGS.find((p) => p.id === platformId);
  if (!platform) throw new Error(`Unknown platform id: ${platformId}`);

  const existing = getConnectedAccounts().filter((a) => a.platform_id !== platformId);
  const account: ConnectedAccount = {
    id: `acc_${platformId}_${Date.now()}`,
    platform_id: platformId,
    platform_name: platform.name,
    platform_display_name: platform.display_name,
    username,
    notify_new_lots:     opts.notify_new_lots     ?? true,
    notify_ending_soon:  opts.notify_ending_soon   ?? true,
    created_at:          new Date().toISOString(),
    last_synced_at:      null,
    cached_listing_count: null,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing, account]));
  return account;
}

export function disconnectAccount(platformId: number): void {
  const updated = getConnectedAccounts().filter((a) => a.platform_id !== platformId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function updateAccount(
  platformId: number,
  updates: Partial<Pick<ConnectedAccount,
    "notify_new_lots" | "notify_ending_soon" | "last_synced_at" | "cached_listing_count"
  >>
): void {
  const accounts = getConnectedAccounts().map((a) =>
    a.platform_id === platformId ? { ...a, ...updates } : a
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
}
