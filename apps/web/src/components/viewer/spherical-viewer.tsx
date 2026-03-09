"use client";

/**
 * SphericalViewer — top-level wrapper combining the 3D turntable + lens panel.
 *
 * Props mirror ListingImages so it can be swapped in on the detail page.
 */

import { useState } from "react";
import { ItemViewer3D } from "./item-viewer-3d";
import { LensPanel } from "./lens-panel";

interface SphericalViewerProps {
  primaryImageUrl: string | null | undefined;
  imageUrls: string[];
  title: string;
}

export function SphericalViewer({ primaryImageUrl, imageUrls, title }: SphericalViewerProps) {
  const [userImages, setUserImages] = useState<string[]>([]);
  const [mode, setMode] = useState<"3d" | "gallery">("3d");

  const allImages = [
    ...userImages,
    ...(primaryImageUrl ? [primaryImageUrl] : []),
    ...imageUrls.filter((u) => u && u !== primaryImageUrl),
  ].filter(Boolean);

  // Track which panel is visible to pass to LensPanel (for lens operations)
  // We approximate this with a simple index — ItemViewer3D controls its own rotation
  // so we just use the primary image as the default for external lenses.
  const activeImageUrl = allImages[0] ?? null;

  const handleImagesAdded = (newUrls: string[]) => {
    setUserImages((prev) => [...newUrls, ...prev]);
  };

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="flex gap-1 bg-antique-muted rounded-xl p-1 w-fit">
        {(["3d", "gallery"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={[
              "px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
              mode === m
                ? "bg-antique-surface text-antique-text shadow-sm"
                : "text-antique-text-mute hover:text-antique-text",
            ].join(" ")}
          >
            {m === "3d" ? "⟳ 3D View" : "▤ Gallery"}
          </button>
        ))}
      </div>

      {mode === "3d" ? (
        <ItemViewer3D images={allImages.slice(userImages.length)} title={title} userImages={userImages} />
      ) : (
        <GalleryView images={allImages} title={title} />
      )}

      {/* Lens toolbar */}
      <div>
        <p className="text-xs font-semibold text-antique-text-mute uppercase tracking-wide mb-2">
          Lens Tools
        </p>
        <LensPanel
          activeImageUrl={activeImageUrl}
          title={title}
          onImagesAdded={handleImagesAdded}
        />
      </div>
    </div>
  );
}

// ── Flat gallery fallback (mode="gallery") ────────────────────────────────────

import Image from "next/image";

function GalleryView({ images, title }: { images: string[]; title: string }) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [errors, setErrors] = useState<Set<number>>(new Set());

  const src = images[selectedIdx];

  return (
    <div className="space-y-3">
      <div className="aspect-square bg-antique-muted rounded-2xl overflow-hidden relative border border-antique-border">
        {src && !errors.has(selectedIdx) ? (
          <Image
            src={src}
            alt={title}
            fill
            unoptimized
            priority={selectedIdx === 0}
            className="object-contain"
            onError={() => setErrors((s) => new Set(s).add(selectedIdx))}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-antique-text-mute text-8xl">🏺</div>
        )}
      </div>

      {images.length > 1 && (
        <div className="grid grid-cols-4 gap-2">
          {images.slice(0, 4).map((url, i) => (
            <button
              key={i}
              onClick={() => setSelectedIdx(i)}
              className={`aspect-square bg-antique-muted rounded-lg overflow-hidden relative border-2 transition-colors ${
                selectedIdx === i ? "border-antique-accent" : "border-transparent hover:border-antique-border"
              }`}
            >
              {!errors.has(i) ? (
                <Image
                  src={url}
                  alt={`${title} photo ${i + 1}`}
                  fill
                  unoptimized
                  className="object-cover"
                  onError={() => setErrors((s) => new Set(s).add(i))}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl">🏺</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
