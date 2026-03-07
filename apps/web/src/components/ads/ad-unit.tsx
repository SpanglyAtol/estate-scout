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

/**
 * Google AdSense display unit.
 * Only renders when NEXT_PUBLIC_GOOGLE_ADSENSE_ID is set.
 * Free-tier users see ads; Pro/Premium users should not see this component rendered.
 */
export function AdUnit({ slot, format = "auto", className = "" }: AdUnitProps) {
  const publisherId = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_ID;
  const initialized = useRef(false);

  useEffect(() => {
    if (!publisherId || initialized.current) return;
    initialized.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // AdSense not loaded yet — harmless
    }
  }, [publisherId]);

  if (!publisherId) return null;

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
  const publisherId = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_ID;
  if (!publisherId) return null;

  return (
    <div className="col-span-full py-2">
      <p className="text-xs text-antique-text-mute text-center mb-1 uppercase tracking-wide">
        Advertisement
      </p>
      <AdUnit slot={slot} format="fluid" className="min-h-[90px]" />
    </div>
  );
}
