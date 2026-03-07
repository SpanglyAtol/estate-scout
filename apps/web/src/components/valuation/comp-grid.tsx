"use client";

import Image from "next/image";
import { AlertTriangle, CheckCircle, Info } from "lucide-react";
import type { CompSale, PriceRange, SpreadBucket, ConfidenceLevel } from "@/types";
import { formatPrice, formatDate } from "@/lib/format";
import { ExternalLink } from "lucide-react";

interface CompGridProps {
  comps: CompSale[];
  priceRange?: PriceRange;
  confidenceLevel?: ConfidenceLevel;
  confidenceReason?: string;
  priceSpread?: SpreadBucket[];
  clarifyingPrompts?: string[];
  detectionSummary?: string | null;
  isHighAmbiguity?: boolean;
}

// ── Inline SVG spread histogram ───────────────────────────────────────────────
function SpreadHistogram({ buckets }: { buckets: SpreadBucket[] }) {
  if (!buckets.length) return null;
  const maxCount = Math.max(...buckets.map((b) => b.count), 1);
  const w = 100 / buckets.length;

  return (
    <div className="mt-3">
      <p className="text-[10px] text-antique-text-mute uppercase tracking-wider mb-1.5">
        Price distribution
      </p>
      <svg
        viewBox={`0 0 100 40`}
        className="w-full h-10"
        preserveAspectRatio="none"
        aria-hidden
      >
        {buckets.map((bucket, i) => {
          const barH = (bucket.count / maxCount) * 28;
          const x = i * w + w * 0.1;
          const y = 30 - barH;
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={w * 0.8}
                height={barH}
                fill="currentColor"
                className="text-antique-accent"
                rx="0.5"
                opacity={bucket.count === 0 ? 0.15 : 0.75}
              />
              <text
                x={x + w * 0.4}
                y={38}
                textAnchor="middle"
                fontSize="3.5"
                fill="currentColor"
                className="text-antique-text-mute"
              >
                {bucket.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Confidence badge ──────────────────────────────────────────────────────────
function ConfidenceBadge({
  level,
  reason,
}: {
  level: ConfidenceLevel;
  reason?: string;
}) {
  const config = {
    high: {
      icon: CheckCircle,
      label: "High confidence",
      classes: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    medium: {
      icon: Info,
      label: "Moderate confidence",
      classes: "bg-amber-50 text-amber-700 border-amber-200",
    },
    low: {
      icon: AlertTriangle,
      label: "High variance",
      classes: "bg-red-50 text-red-700 border-red-200",
    },
    insufficient: {
      icon: Info,
      label: "Insufficient data",
      classes: "bg-antique-subtle text-antique-text-mute border-antique-border",
    },
  }[level];

  const Icon = config.icon;

  return (
    <div className={`rounded-lg border px-3 py-2 flex items-start gap-2 ${config.classes}`}>
      <Icon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
      <div className="text-xs leading-snug">
        <span className="font-semibold">{config.label}</span>
        {reason && <span className="ml-1 opacity-80">&mdash; {reason}</span>}
      </div>
    </div>
  );
}

// ── Clarifying prompts panel ──────────────────────────────────────────────────
function ClarifyPanel({ prompts }: { prompts: string[] }) {
  if (!prompts.length) return null;
  return (
    <div className="rounded-xl border border-antique-border bg-antique-subtle p-3">
      <p className="text-xs font-semibold text-antique-text mb-2">
        To improve accuracy, add:
      </p>
      <ul className="space-y-1">
        {prompts.map((p) => (
          <li key={p} className="text-xs text-antique-text-sec flex items-start gap-1.5">
            <span className="text-antique-accent mt-0.5">›</span>
            {p}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function CompGrid({
  comps,
  priceRange,
  confidenceLevel = "insufficient",
  confidenceReason,
  priceSpread = [],
  clarifyingPrompts = [],
  detectionSummary,
  isHighAmbiguity = false,
}: CompGridProps) {
  const hasResults = comps.length > 0 && priceRange?.low != null;

  if (!hasResults && confidenceLevel === "insufficient") return null;

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-antique-text font-display text-sm">
          Comparable Sales
          <span className="ml-1.5 text-antique-text-mute font-normal">
            ({comps.length})
          </span>
        </h3>
        {detectionSummary && (
          <span className="text-[10px] bg-antique-subtle border border-antique-border rounded-full px-2 py-0.5 text-antique-text-mute capitalize">
            {detectionSummary}
          </span>
        )}
      </div>

      {/* Confidence badge */}
      <ConfidenceBadge level={confidenceLevel} reason={confidenceReason} />

      {/* Price range + spread histogram */}
      {hasResults && priceRange && (
        <div className="antique-card p-4">
          <p className="text-[10px] text-antique-accent font-semibold uppercase tracking-widest mb-3">
            Price Range
          </p>
          <div className="flex justify-between items-end">
            <div className="text-center">
              <p className="text-[10px] text-antique-text-mute mb-0.5">Low</p>
              <p className="font-bold text-antique-text tabular-nums">
                {formatPrice(priceRange.low!)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-antique-text-mute mb-0.5">Median</p>
              <p className="font-bold text-xl text-antique-accent tabular-nums">
                {formatPrice(priceRange.mid!)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-antique-text-mute mb-0.5">High</p>
              <p className="font-bold text-antique-text tabular-nums">
                {formatPrice(priceRange.high!)}
              </p>
            </div>
          </div>

          {/* Gradient bar or histogram */}
          {priceSpread.length >= 3 ? (
            <SpreadHistogram buckets={priceSpread} />
          ) : (
            <div className="mt-3 h-1.5 bg-gradient-to-r from-antique-border via-antique-accent to-antique-border rounded-full" />
          )}

          <p className="text-[10px] text-antique-text-mute mt-2 text-center">
            Based on {priceRange.count} comparable listing{priceRange.count !== 1 ? "s" : ""}
          </p>
        </div>
      )}

      {/* Clarifying prompts — show when ambiguous */}
      {(isHighAmbiguity || confidenceLevel === "low") && clarifyingPrompts.length > 0 && (
        <ClarifyPanel prompts={clarifyingPrompts} />
      )}

      {/* Comp cards */}
      {comps.length > 0 && (
        <div className="space-y-2">
          {comps.map((comp) => (
            <a
              key={comp.listing_id}
              href={comp.external_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex gap-3 p-3 bg-antique-surface border border-antique-border rounded-xl hover:border-antique-accent hover:shadow-sm transition-all group"
            >
              {/* Thumbnail */}
              <div className="w-14 h-14 flex-shrink-0 bg-antique-muted rounded-lg overflow-hidden">
                {comp.primary_image_url ? (
                  <Image
                    src={comp.primary_image_url}
                    alt={comp.title}
                    width={56}
                    height={56}
                    unoptimized
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-antique-text-mute text-lg">
                    🏺
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-antique-text line-clamp-1 group-hover:text-antique-accent transition-colors">
                  {comp.title}
                </p>
                <p className="text-base font-bold text-antique-accent tabular-nums">
                  {formatPrice(comp.final_price)}
                </p>
                <p className="text-xs text-antique-text-mute">
                  {comp.platform_display_name}
                  {comp.sale_date && ` · ${formatDate(comp.sale_date)}`}
                  {comp.condition && ` · ${comp.condition}`}
                </p>
              </div>

              <ExternalLink className="w-3.5 h-3.5 text-antique-border group-hover:text-antique-accent flex-shrink-0 mt-1 transition-colors" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
