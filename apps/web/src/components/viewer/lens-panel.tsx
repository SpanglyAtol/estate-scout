"use client";

/**
 * LensPanel — multi-lens toolbar for examining an item from different angles.
 *
 * Lenses:
 *  1. Google Lens   — open the current image in Google Lens (URL-based search)
 *  2. Claude Vision — AI appraisal via our /api/v1/vision/analyze endpoint
 *  3. Camera        — capture a new photo and add it to the 3D viewer
 *  4. Upload        — pick image files to add to the 3D viewer
 *  5. Google Images — reverse image search
 *  6. eBay search   — search eBay sold listings using Claude's suggested terms or the item title
 */

import { useRef, useState } from "react";

interface VisionResult {
  identification: string;
  category: string;
  estimated_period: string;
  estimated_value_usd: { low: number; mid: number; high: number };
  condition_notes: string;
  key_features: string[];
  ebay_search_terms: string;
  google_lens_tip: string;
  confidence: "high" | "medium" | "low";
}

interface LensPanelProps {
  /** The currently visible image URL (used for Google Lens, Claude, reverse search) */
  activeImageUrl: string | null;
  /** Item title for eBay search fallback */
  title: string;
  /** Callback when user adds new images (camera/upload) */
  onImagesAdded: (dataUrls: string[]) => void;
}

const CONFIDENCE_COLOR = {
  high: "text-emerald-600 dark:text-emerald-400",
  medium: "text-amber-600 dark:text-amber-400",
  low: "text-red-500 dark:text-red-400",
};

export function LensPanel({ activeImageUrl, title, onImagesAdded }: LensPanelProps) {
  const [visionResult, setVisionResult] = useState<VisionResult | null>(null);
  const [visionLoading, setVisionLoading] = useState(false);
  const [visionError, setVisionError] = useState<string | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  // ── Google Lens ────────────────────────────────────────────────────────────
  const openGoogleLens = () => {
    if (!activeImageUrl) return;
    const url = `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(activeImageUrl)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // ── Claude Vision ──────────────────────────────────────────────────────────
  const runClaudeVision = async () => {
    if (!activeImageUrl) return;
    setVisionLoading(true);
    setVisionError(null);
    setVisionResult(null);
    try {
      const res = await fetch("/api/v1/vision/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageUrl: activeImageUrl, context: title }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");
      setVisionResult(data.result as VisionResult);
    } catch (err) {
      setVisionError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setVisionLoading(false);
    }
  };

  // ── Reverse image search (Google Images) ───────────────────────────────────
  const openReverseSearch = () => {
    if (!activeImageUrl) return;
    const url = `https://www.google.com/searchbyimage?image_url=${encodeURIComponent(activeImageUrl)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // ── eBay sold listings ────────────────────────────────────────────────────
  const openEbay = () => {
    const terms = visionResult?.ebay_search_terms ?? title;
    const url = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(terms)}&LH_Sold=1&LH_Complete=1`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // ── File reading helper ───────────────────────────────────────────────────
  const readFilesAsDataUrls = (files: FileList) => {
    const readers = Array.from(files).map(
      (file) =>
        new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        })
    );
    Promise.all(readers).then((urls) => onImagesAdded(urls));
  };

  // ── Camera / Upload input handlers ───────────────────────────────────────
  const onCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) readFilesAsDataUrls(e.target.files);
    e.target.value = "";
  };

  const onUploadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) readFilesAsDataUrls(e.target.files);
    e.target.value = "";
  };

  const noImage = !activeImageUrl;

  return (
    <div className="space-y-3">
      {/* ── Lens buttons ── */}
      <div className="grid grid-cols-3 gap-2">
        {/* Google Lens */}
        <LensButton
          emoji="🔍"
          label="Google Lens"
          onClick={openGoogleLens}
          disabled={noImage}
          title="Open in Google Lens visual search"
        />

        {/* Claude Vision */}
        <LensButton
          emoji="✨"
          label={visionLoading ? "Analyzing…" : "Claude Vision"}
          onClick={runClaudeVision}
          disabled={noImage || visionLoading}
          highlight
          title="AI appraisal using Claude"
        />

        {/* Reverse Image Search */}
        <LensButton
          emoji="🖼"
          label="Reverse Search"
          onClick={openReverseSearch}
          disabled={noImage}
          title="Find similar images on Google"
        />

        {/* Camera */}
        <LensButton
          emoji="📷"
          label="Camera"
          onClick={() => cameraInputRef.current?.click()}
          title="Take a photo to add to the 3D viewer"
        />

        {/* Upload */}
        <LensButton
          emoji="📁"
          label="Upload Photos"
          onClick={() => uploadInputRef.current?.click()}
          title="Upload additional angle photos"
        />

        {/* eBay */}
        <LensButton
          emoji="🏷"
          label="eBay Sold"
          onClick={openEbay}
          title="Search eBay sold listings for comparable prices"
        />
      </div>

      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onCameraChange}
      />
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={onUploadChange}
      />

      {/* ── Vision error ── */}
      {visionError && (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {visionError}
        </div>
      )}

      {/* ── Vision result card ── */}
      {visionResult && (
        <div className="rounded-xl border border-antique-border bg-antique-muted p-4 space-y-3 text-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-antique-text">{visionResult.identification}</p>
              <p className="text-antique-text-mute text-xs mt-0.5">{visionResult.estimated_period}</p>
            </div>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full bg-white dark:bg-black/20 border border-current ${CONFIDENCE_COLOR[visionResult.confidence ?? "low"]}`}
            >
              {visionResult.confidence} confidence
            </span>
          </div>

          {/* Value estimate */}
          <div className="bg-white dark:bg-black/10 rounded-lg px-3 py-2 flex items-baseline gap-2">
            <span className="text-antique-text-mute text-xs">Est. value</span>
            <span className="font-bold text-antique-accent">
              ${visionResult.estimated_value_usd.low.toLocaleString()}
              {" – "}
              ${visionResult.estimated_value_usd.high.toLocaleString()}
            </span>
            <span className="text-antique-text-mute text-xs">USD</span>
          </div>

          {/* Condition */}
          {visionResult.condition_notes && (
            <p className="text-antique-text-sec">
              <span className="font-medium text-antique-text">Condition: </span>
              {visionResult.condition_notes}
            </p>
          )}

          {/* Key features */}
          {visionResult.key_features?.length > 0 && (
            <ul className="list-disc list-inside text-antique-text-sec space-y-0.5">
              {visionResult.key_features.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          )}

          {/* Google Lens tip */}
          {visionResult.google_lens_tip && (
            <p className="text-antique-text-sec text-xs italic border-t border-antique-border pt-2">
              <span className="not-italic font-medium">Google Lens tip: </span>
              {visionResult.google_lens_tip}
            </p>
          )}

          {/* eBay shortcut using Claude's search terms */}
          {visionResult.ebay_search_terms && (
            <button
              onClick={openEbay}
              className="w-full text-xs text-antique-accent hover:text-antique-accent-h underline text-left"
            >
              Search eBay sold: &ldquo;{visionResult.ebay_search_terms}&rdquo; →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Small helper component ────────────────────────────────────────────────────

interface LensButtonProps {
  emoji: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  highlight?: boolean;
  title?: string;
}

function LensButton({ emoji, label, onClick, disabled, highlight, title }: LensButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={[
        "flex flex-col items-center justify-center gap-1 rounded-xl border px-2 py-3 text-xs font-medium transition-colors",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        highlight
          ? "bg-antique-accent text-white border-antique-accent hover:bg-antique-accent-h"
          : "bg-antique-surface border-antique-border text-antique-text hover:bg-antique-muted",
      ].join(" ")}
    >
      <span className="text-xl leading-none">{emoji}</span>
      {label}
    </button>
  );
}
