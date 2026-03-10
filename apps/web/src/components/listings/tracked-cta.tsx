"use client";

import { ExternalLink } from "lucide-react";
import { trackClickOut, trackListingView } from "@/lib/analytics";
import { useEffect } from "react";

interface TrackedCtaProps {
  href: string;
  label: string;
  className: string;
  listingId: number;
  platform: string;
  category: string | null;
  listingType: string;
}

export function TrackedCta({
  href,
  label,
  className,
  listingId,
  platform,
  category,
  listingType,
}: TrackedCtaProps) {
  // Track listing page view once on mount
  useEffect(() => {
    trackListingView({ listing_id: listingId, platform, category, listing_type: listingType });
  }, [listingId, platform, category, listingType]);

  function handleClick() {
    trackClickOut({ listing_id: listingId, platform, category, listing_type: listingType, url: href });
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={handleClick}
    >
      {label}
      <ExternalLink className="w-5 h-5" />
    </a>
  );
}
