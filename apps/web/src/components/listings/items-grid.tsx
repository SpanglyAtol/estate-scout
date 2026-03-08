"use client";

import { useState } from "react";
import Image from "next/image";
import { Search, ExternalLink, Package } from "lucide-react";
import type { AuctionItem } from "@/types";
import { formatPrice } from "@/lib/format";

interface ItemsGridProps {
  items: AuctionItem[];
  auctionUrl: string;
  platform: string;
}

export function ItemsGrid({ items, auctionUrl, platform }: ItemsGridProps) {
  const [search, setSearch] = useState("");

  const query = search.trim().toLowerCase();
  const filtered = query
    ? items.filter(
        (item) =>
          item.title.toLowerCase().includes(query) ||
          item.description?.toLowerCase().includes(query) ||
          item.lot_number?.toLowerCase().includes(query)
      )
    : items;

  return (
    <div className="mt-10">
      {/* Section header */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h2 className="text-xl font-bold text-antique-text font-display">
          Items in this Auction
          <span className="ml-2 text-base font-normal text-antique-text-mute">
            ({items.length} lots)
          </span>
        </h2>

        {items.length > 6 && (
          <div className="relative flex-shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-antique-text-mute pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter lots…"
              className="pl-9 pr-3 py-1.5 border border-antique-border bg-antique-surface text-antique-text rounded-lg text-sm focus:ring-2 focus:ring-antique-accent outline-none"
            />
          </div>
        )}
      </div>

      {/* Grid or empty state */}
      {filtered.length === 0 ? (
        <p className="text-sm text-antique-text-mute py-6 text-center">
          No lots match your search.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {filtered.map((item, i) => (
            <ItemCard
              key={item.lot_number ?? i}
              item={item}
              auctionUrl={auctionUrl}
            />
          ))}
        </div>
      )}

      {/* Browse all link */}
      <div className="mt-5 text-center">
        <a
          href={auctionUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-antique-accent hover:text-antique-accent-h hover:underline"
        >
          Browse all {items.length} lots on {platform}
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}

// ── Individual lot card ────────────────────────────────────────────────────────

function ItemCard({
  item,
  auctionUrl,
}: {
  item: AuctionItem;
  auctionUrl: string;
}) {
  const [imgError, setImgError] = useState(false);
  const href = item.external_url ?? auctionUrl;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group bg-antique-surface border border-antique-border rounded-xl overflow-hidden hover:shadow-md hover:border-antique-accent transition-all duration-200"
    >
      {/* Image */}
      <div className="relative aspect-square bg-antique-muted">
        {item.primary_image_url && !imgError ? (
          <Image
            src={item.primary_image_url}
            alt={item.title}
            fill
            unoptimized
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-antique-text-mute">
            <Package className="w-8 h-8" />
          </div>
        )}

        {/* Lot number badge */}
        {item.lot_number && (
          <div className="absolute bottom-1.5 left-1.5 bg-black/60 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded leading-none">
            Lot {item.lot_number}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2 space-y-0.5">
        <p className="text-xs font-medium text-antique-text line-clamp-2 leading-snug">
          {item.title}
        </p>

        {/* Estimate range */}
        {(item.estimate_low != null || item.estimate_high != null) && (
          <p className="text-xs text-antique-text-mute">
            Est.{" "}
            {item.estimate_low != null && formatPrice(item.estimate_low)}
            {item.estimate_low != null &&
              item.estimate_high != null &&
              item.estimate_high !== item.estimate_low &&
              `–${formatPrice(item.estimate_high)}`}
            {item.estimate_low == null &&
              item.estimate_high != null &&
              formatPrice(item.estimate_high)}
          </p>
        )}

        {/* Current bid */}
        {item.current_price != null && (
          <p className="text-xs font-bold text-antique-accent">
            {formatPrice(item.current_price)}
          </p>
        )}

        {/* View lot link hint */}
        <p className="text-[10px] text-antique-accent group-hover:underline leading-none pt-0.5">
          View lot →
        </p>
      </div>
    </a>
  );
}
