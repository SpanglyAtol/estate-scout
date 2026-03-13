"use client";

import { useEffect, useRef } from "react";

interface AdUnitProps {
  slot: string;
  format?: "auto" | "fluid" | "rectangle";
  className?: string;
}

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

const PLACEHOLDER_SLOT = "1234567890";
const isDev = process.env.NODE_ENV === "development";

/**
 * Google AdSense display unit.
 * Requires NEXT_PUBLIC_GOOGLE_ADSENSE_ID + a real NEXT_PUBLIC_ADSENSE_SLOT_* to be set.
 * In development (or when slot is placeholder), renders a clearly-labelled placeholder box
 * so you can see exactly where ads will appear before AdSense approval.
 */
export function AdUnit({ slot, format = "auto", className = "" }: AdUnitProps) {
  const publisherId = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_ID;
  const initialized = useRef(false);

  const isPlaceholderSlot = !slot || slot === PLACEHOLDER_SLOT;

  useEffect(() => {
    if (!publisherId || isPlaceholderSlot || initialized.current) return;
    initialized.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // AdSense not loaded yet — harmless
    }
  }, [publisherId, isPlaceholderSlot]);

  // Show a visible placeholder in dev OR when slot ID is not yet configured
  if (!publisherId || isPlaceholderSlot) {
    if (!isDev && publisherId && isPlaceholderSlot) {
      // Production without a real slot: show nothing rather than an error
      return null;
    }
    return (
      <div
        className={`ad-placeholder flex items-center justify-center border-2 border-dashed border-antique-border rounded-lg bg-antique-muted/40 ${className}`}
        style={{ minHeight: 90 }}
      >
        <p className="text-xs text-antique-text-mute text-center px-4 leading-relaxed">
          <span className="font-semibold block">Ad Unit</span>
          {isPlaceholderSlot
            ? "Set NEXT_PUBLIC_ADSENSE_SLOT_LISTINGS in .env.local"
            : "Set NEXT_PUBLIC_GOOGLE_ADSENSE_ID in .env.local"}
        </p>
      </div>
    );
  }

  return (
    <div className={`ad-unit overflow-hidden ${className}`}>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={publisherId}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}

/**
 * Horizontal banner ad placed between listing rows.
 * Renders a subtle "Sponsored" label above the ad.
 */
export function ListingAdBanner({ slot }: { slot: string }) {
  return (
    <div className="col-span-full py-2">
      <p className="text-xs text-antique-text-mute text-center mb-1 uppercase tracking-wide">
        Advertisement
      </p>
      <AdUnit slot={slot} format="fluid" className="min-h-[90px]" />
    </div>
  );
}

/**
 * Sidebar / tall ad unit — for use alongside listing detail or search sidebar.
 */
export function SidebarAdUnit({ slot }: { slot: string }) {
  return (
    <div className="w-full">
      <p className="text-[10px] text-antique-text-mute uppercase tracking-widest mb-1.5 text-center">
        Advertisement
      </p>
      <AdUnit slot={slot} format="rectangle" className="min-h-[250px]" />
    </div>
  );
}

/**
 * Top-of-page leaderboard banner.
 */
export function LeaderboardAdUnit({ slot }: { slot: string }) {
  return (
    <div className="w-full border-b border-antique-border bg-antique-surface/60 py-2 px-4">
      <p className="text-[10px] text-antique-text-mute uppercase tracking-widest mb-1 text-center">
        Advertisement
      </p>
      <AdUnit slot={slot} format="auto" className="min-h-[90px] max-w-3xl mx-auto" />
    </div>
  );
}
