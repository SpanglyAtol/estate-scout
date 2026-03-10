/**
 * Analytics & Ad Revenue Tracker — Client-Side
 * ---------------------------------------------
 * Sends events to:
 *   1. GA4 (via gtag) when NEXT_PUBLIC_GA4_ID is set
 *   2. Our own /api/v1/track endpoint for ad revenue attribution
 *
 * All functions are safe to call in SSR contexts — they no-op on the server.
 */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

function isClient(): boolean {
  return typeof window !== "undefined";
}

// ── GA4 helper ────────────────────────────────────────────────────────────────

export function gtagEvent(eventName: string, params: Record<string, unknown> = {}) {
  if (!isClient()) return;
  if (typeof window.gtag === "function") {
    window.gtag("event", eventName, params);
  }
}

// ── Unified event tracker ─────────────────────────────────────────────────────

export function trackEvent(
  type: string,
  params: Record<string, unknown> = {}
) {
  if (!isClient()) return;

  // 1. GA4 client-side event
  gtagEvent(type, params);

  // 2. Server-side log + GA4 Measurement Protocol (fire-and-forget beacon)
  const body = JSON.stringify({ type, ...params });
  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/v1/track", new Blob([body], { type: "application/json" }));
  } else {
    fetch("/api/v1/track", {
      method: "POST",
      body,
      headers: { "Content-Type": "application/json" },
      keepalive: true,
    }).catch(() => {});
  }
}

// ── Specific event helpers ────────────────────────────────────────────────────

/** Called when a user clicks the CTA to go to an external auction platform */
export function trackClickOut(params: {
  listing_id: number;
  platform: string;
  category: string | null;
  listing_type: string;
  url: string;
}) {
  trackEvent("click_out", params);
}

/** Called when a user clicks an Amazon Associates affiliate link */
export function trackAffiliateClick(params: {
  category: string | null;
  keywords: string;
  url: string;
}) {
  trackEvent("affiliate_click", params);
}

/** Called when a listing detail page is viewed */
export function trackListingView(params: {
  listing_id: number;
  platform: string;
  category: string | null;
  listing_type: string;
}) {
  trackEvent("listing_view", params);
}
