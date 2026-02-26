"use client";

/**
 * Client component for listing detail page image gallery.
 * Handles onError fallback gracefully so a broken CDN URL never
 * crashes the page — it just shows the placeholder vase instead.
 */

import { useState } from "react";
import Image from "next/image";

interface ListingImagesProps {
  primaryImageUrl: string | null | undefined;
  imageUrls: string[];
  title: string;
}

function SafeImage({
  src,
  alt,
  className,
  priority = false,
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-300 text-8xl">
        🏺
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      unoptimized
      priority={priority}
      className={className}
      onError={() => setError(true)}
    />
  );
}

export function ListingImages({ primaryImageUrl, imageUrls, title }: ListingImagesProps) {
  const [selectedIdx, setSelectedIdx] = useState(0);

  // Build the full gallery: primary image first, then additional images
  const allImages = [
    ...(primaryImageUrl ? [primaryImageUrl] : []),
    ...imageUrls.filter((u) => u && u !== primaryImageUrl),
  ];

  const displaySrc = allImages[selectedIdx] ?? null;

  return (
    <div className="space-y-3">
      {/* Primary / selected image */}
      <div className="aspect-square bg-gray-100 rounded-2xl overflow-hidden relative">
        {displaySrc ? (
          <SafeImage
            src={displaySrc}
            alt={title}
            className="object-contain"
            priority={selectedIdx === 0}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-8xl">
            🏺
          </div>
        )}
      </div>

      {/* Thumbnail strip — show when more than 1 image exists */}
      {allImages.length > 1 && (
        <div className="grid grid-cols-4 gap-2">
          {allImages.slice(0, 4).map((url, i) => (
            <button
              key={i}
              onClick={() => setSelectedIdx(i)}
              className={`aspect-square bg-gray-100 rounded-lg overflow-hidden relative border-2 transition-colors ${
                selectedIdx === i
                  ? "border-blue-500"
                  : "border-transparent hover:border-gray-300"
              }`}
            >
              <SafeImage src={url} alt={`${title} photo ${i + 1}`} className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
