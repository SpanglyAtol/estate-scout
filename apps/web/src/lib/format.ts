/** Format a price in USD. Returns "No bids" if null. */
export function formatPrice(price: number | null, currency = "USD"): string {
  if (price === null) return "No bids";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(price);
}

/** Returns a human-readable countdown string like "2h 30m" or "3 days" */
export function timeUntil(isoString: string | null): string | null {
  if (!isoString) return null;
  const diff = new Date(isoString).getTime() - Date.now();
  if (diff <= 0) return "Ended";
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  if (hours >= 48) return `${Math.floor(hours / 24)} days`;
  if (hours >= 1) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/** Format miles distance */
export function formatDistance(miles: number | undefined): string {
  if (miles === undefined) return "";
  if (miles < 1) return "< 1 mile away";
  return `${Math.round(miles)} mi away`;
}

/** Format a date as "Jan 15, 2026" */
export function formatDate(isoString: string | null): string {
  if (!isoString) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(isoString));
}

/** Calculate total cost including buyer's premium */
export function totalWithPremium(
  price: number | null,
  premiumPct: number | null
): number | null {
  if (price === null) return null;
  const pct = premiumPct ?? 0;
  return price * (1 + pct / 100);
}
