"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { MapPin, ExternalLink } from "lucide-react";
import type { SponsoredListing } from "@/app/api/v1/sponsored/route";
import { trackEvent } from "@/lib/analytics";

interface SponsoredCardProps {
  listing: SponsoredListing;
  position: number; // grid position, used for impression tracking
}

export function SponsoredCard({ listing, position }: SponsoredCardProps) {
  const [imgError, setImgError] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const impressionFired = useRef(false);

  // Fire impression event once when the card enters the viewport
  useEffect(() => {
    if (!cardRef.current || impressionFired.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !impressionFired.current) {
          impressionFired.current = true;
          trackEvent("sponsored_impression", {
            sponsor_id: listing.id,
            sponsor_name: listing.sponsor_name,
            category: listing.category,
            grid_position: position,
          });
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [listing.id, listing.sponsor_name, listing.category, position]);

  function handleClick() {
    trackEvent("sponsored_click", {
      sponsor_id: listing.id,
      sponsor_name: listing.sponsor_name,
      sponsor_url: listing.sponsor_url,
      category: listing.category,
      grid_position: position,
    });
    // Also ping the server-side tracker
    fetch(`/api/v1/track?type=sponsored_click&id=${encodeURIComponent(listing.id)}&pos=${position}`, {
      method: "POST",
      keepalive: true,
    }).catch(() => {});
  }

  return (
    <div ref={cardRef} className="relative">
      <a
        href={listing.sponsor_url}
        target="_blank"
        rel="noopener noreferrer sponsored"
        onClick={handleClick}
        className="group block bg-antique-surface rounded-xl overflow-hidden border-2 border-amber-400 hover:shadow-lg hover:border-amber-500 transition-all duration-200"
      >
        {/* Image */}
        <div className="relative aspect-square bg-antique-muted overflow-hidden">
          {listing.primary_image_url && !imgError ? (
            <Image
              src={listing.primary_image_url}
              alt={listing.title}
              fill
              unoptimized
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-antique-text-mute text-4xl">
              🏛️
            </div>
          )}

          {/* Sponsored badge */}
          <div className="absolute top-2 left-2 bg-amber-400 text-amber-900 text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1">
            ✦ Sponsored
          </div>

          {/* External link icon */}
          <div className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1">
            <ExternalLink className="w-3 h-3" />
          </div>
        </div>

        {/* Info */}
        <div className="p-3 space-y-1.5">
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">
            {listing.sponsor_name}
          </p>
          <p className="text-sm font-medium text-antique-text line-clamp-2 leading-snug">
            {listing.title}
          </p>

          {listing.category && (
            <span className="inline-block text-xs px-2 py-0.5 rounded-full font-medium bg-amber-50 text-amber-700 border border-amber-200">
              {listing.category}
            </span>
          )}

          {listing.city && (
            <span className="text-xs text-antique-text-mute flex items-center gap-0.5">
              <MapPin className="w-3 h-3" />
              {listing.city}, {listing.state}
            </span>
          )}

          <div className="pt-1">
            <span className="inline-block text-xs font-semibold text-amber-700 bg-amber-100 border border-amber-300 px-3 py-1 rounded-lg group-hover:bg-amber-400 group-hover:text-white group-hover:border-amber-400 transition-colors">
              {listing.cta_label}
            </span>
          </div>
        </div>
      </a>
    </div>
  );
}
