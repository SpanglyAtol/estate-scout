"use client";

/**
 * ItemViewer3D — CSS 3D turntable carousel for examining estate/auction items.
 *
 * Images are placed as panels on an imaginary cylinder:
 *   each panel is rotateY(angle) translateZ(radius)
 * The user drags left/right to spin the cylinder.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";

interface ItemViewer3DProps {
  images: string[];
  title: string;
  /** Extra images added by the user (camera/upload) — prepended to gallery */
  userImages?: string[];
  /** Called whenever the front-facing panel changes (index into allImages) */
  onActiveIndexChange?: (idx: number) => void;
}

const MIN_IMAGES = 1;

export function ItemViewer3D({ images, title, userImages = [], onActiveIndexChange }: ItemViewer3DProps) {
  const allImages = [...userImages, ...images].filter(Boolean);
  const count = Math.max(allImages.length, MIN_IMAGES);

  // cylinder radius grows with more images so they don't overlap
  const radius = Math.max(220, count * 90);

  // rotationY in degrees — increases as user drags right
  const [rotY, setRotY] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const dragStart = useRef<{ x: number; rotY: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [imgErrors, setImgErrors] = useState<Set<number>>(new Set());

  // Derive which panel is currently facing the viewer (closest to 0° mod 360°)
  const panelAngle = (i: number) => (360 / count) * i;
  const normalizedRot = ((rotY % 360) + 360) % 360;
  const activeIdx = allImages.length
    ? [...Array(count)].reduce((best, _, i) => {
        const angle = panelAngle(i);
        const diff = Math.abs(((angle - normalizedRot + 540) % 360) - 180);
        const bestAngle = panelAngle(best);
        const bestDiff = Math.abs(((bestAngle - normalizedRot + 540) % 360) - 180);
        return diff < bestDiff ? i : best;
      }, 0)
    : 0;

  // Notify parent whenever the front-facing panel changes
  useEffect(() => {
    onActiveIndexChange?.(activeIdx);
  }, [activeIdx, onActiveIndexChange]);

  // ── pointer / touch drag handlers ─────────────────────────────────────────
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragStart.current = { x: e.clientX, rotY };
    setIsSpinning(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [rotY]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    setRotY(dragStart.current.rotY - dx * 0.5);
  }, []);

  const onPointerUp = useCallback(() => {
    dragStart.current = null;
    setIsSpinning(false);
  }, []);

  // snap to nearest panel on release
  useEffect(() => {
    if (isSpinning) return;
    const target = Math.round(rotY / (360 / count)) * (360 / count);
    const diff = target - rotY;
    if (Math.abs(diff) < 0.5) return;
    const raf = requestAnimationFrame(() => setRotY((r) => r + diff * 0.15));
    return () => cancelAnimationFrame(raf);
  }, [isSpinning, rotY, count]);

  // keyboard left/right
  useEffect(() => {
    const step = 360 / count;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") setRotY((r) => r + step);
      if (e.key === "ArrowRight") setRotY((r) => r - step);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [count]);

  const goTo = (i: number) => setRotY(panelAngle(i));

  if (allImages.length === 0) {
    return (
      <div className="w-full aspect-square bg-antique-muted rounded-2xl flex items-center justify-center text-antique-text-mute text-8xl">
        🏺
      </div>
    );
  }

  return (
    <div className="select-none space-y-4">
      {/* 3D stage */}
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-b from-antique-muted to-antique-surface border border-antique-border"
        style={{ height: 340, perspective: 900 }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        tabIndex={0}
      >
        {/* hint text */}
        <p className="absolute top-3 left-0 right-0 text-center text-xs text-antique-text-mute z-10 pointer-events-none">
          ← drag to rotate →
        </p>

        {/* rotating cylinder */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ transformStyle: "preserve-3d" }}
        >
          <div
            style={{
              width: 0,
              height: 0,
              transformStyle: "preserve-3d",
              transform: `rotateY(${rotY}deg)`,
              transition: isSpinning ? "none" : "transform 0.25s ease-out",
            }}
          >
            {allImages.map((src, i) => {
              const angle = panelAngle(i);
              const isActive = i === activeIdx;
              const hasError = imgErrors.has(i);

              return (
                <div
                  key={i}
                  onClick={() => goTo(i)}
                  style={{
                    position: "absolute",
                    width: 260,
                    height: 260,
                    left: -130,
                    top: -130,
                    transform: `rotateY(${angle}deg) translateZ(${radius}px)`,
                    backfaceVisibility: "hidden",
                    cursor: "pointer",
                    transition: "opacity 0.2s",
                    opacity: isActive ? 1 : 0.45,
                  }}
                >
                  <div
                    className="w-full h-full rounded-xl overflow-hidden border-2 shadow-xl"
                    style={{
                      borderColor: isActive ? "var(--color-antique-accent, #8b6914)" : "transparent",
                      boxShadow: isActive ? "0 8px 32px rgba(0,0,0,0.35)" : "0 2px 8px rgba(0,0,0,0.15)",
                    }}
                  >
                    {hasError ? (
                      <div className="w-full h-full bg-antique-muted flex items-center justify-center text-5xl">🏺</div>
                    ) : (
                      <Image
                        src={src}
                        alt={`${title} — angle ${i + 1}`}
                        fill
                        unoptimized
                        className="object-contain bg-antique-muted"
                        onError={() => setImgErrors((s) => new Set(s).add(i))}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* dot indicators + nav arrows */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => setRotY((r) => r + 360 / count)}
          className="p-1.5 rounded-full hover:bg-antique-muted transition-colors text-antique-text-mute hover:text-antique-text"
          aria-label="Previous"
        >
          ←
        </button>

        <div className="flex gap-1.5">
          {allImages.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className="rounded-full transition-all"
              style={{
                width: i === activeIdx ? 10 : 7,
                height: i === activeIdx ? 10 : 7,
                background: i === activeIdx ? "var(--color-antique-accent, #8b6914)" : "currentColor",
                opacity: i === activeIdx ? 1 : 0.3,
              }}
              aria-label={`View angle ${i + 1}`}
            />
          ))}
        </div>

        <button
          onClick={() => setRotY((r) => r - 360 / count)}
          className="p-1.5 rounded-full hover:bg-antique-muted transition-colors text-antique-text-mute hover:text-antique-text"
          aria-label="Next"
        >
          →
        </button>
      </div>

      {/* current index label */}
      <p className="text-center text-xs text-antique-text-mute">
        {activeIdx + 1} / {allImages.length}
        {userImages.length > 0 && ` · ${userImages.length} photo${userImages.length > 1 ? "s" : ""} added by you`}
      </p>
    </div>
  );
}
