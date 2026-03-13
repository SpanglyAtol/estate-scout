"use client";

import { useEffect, useState } from "react";
import type { PriceHistoryBucket } from "@/lib/market-stats";

interface Props {
  category: string;
  /** Pre-loaded buckets (optional — fetches if not provided) */
  initialBuckets?: PriceHistoryBucket[];
  months?: number;
  className?: string;
}

const fmt = (n: number) =>
  n >= 1000
    ? `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`
    : `$${Math.round(n)}`;

const MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function monthLabel(timeBucket: string): string {
  const d = new Date(timeBucket + "T00:00:00Z");
  return MONTH_ABBR[d.getUTCMonth()];
}

export function PriceHistoryChart({ category, initialBuckets, months = 12, className = "" }: Props) {
  const [buckets, setBuckets] = useState<PriceHistoryBucket[]>(initialBuckets ?? []);
  const [loading, setLoading] = useState(!initialBuckets);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialBuckets) return;
    setLoading(true);
    fetch(`/api/v1/market/price-history?category=${encodeURIComponent(category)}&months=${months}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        // API returns newest-first; reverse for left-to-right chart
        setBuckets((d.buckets ?? []).slice().reverse());
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [category, months, initialBuckets]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-28 text-sm text-antique-text-mute ${className}`}>
        <span className="animate-pulse">Loading price data…</span>
      </div>
    );
  }

  if (error || buckets.length === 0) {
    return (
      <div className={`flex items-center justify-center h-28 text-sm text-antique-text-mute ${className}`}>
        {buckets.length === 0 ? "No price history data yet." : `Could not load chart.`}
      </div>
    );
  }

  // Use the last `months` buckets
  const display = buckets.slice(-months);
  const prices = display.map((b) => b.median_price ?? 0).filter(Boolean);
  const maxP = Math.max(...prices);
  const minP = Math.min(...prices);
  const range = maxP - minP || 1;

  // Chart dimensions
  const W = 600;
  const H = 100;
  const PAD_L = 4;
  const PAD_R = 4;
  const PAD_T = 10;
  const PAD_B = 20; // room for month labels
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;
  const barW = Math.max(4, chartW / display.length - 2);
  const gap = chartW / display.length;

  // Line path for the median
  const points = display.map((b, i) => {
    const p = b.median_price ?? 0;
    const x = PAD_L + gap * i + gap / 2;
    const y = PAD_T + chartH - ((p - minP) / range) * chartH;
    return { x, y, b };
  });

  const pathD = points
    .map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
    .join(" ");

  // P25-P75 band path
  const bandD = [
    ...display.map((b, i) => {
      const y = PAD_T + chartH - (((b.p75_price ?? b.median_price ?? 0) - minP) / range) * chartH;
      const x = PAD_L + gap * i + gap / 2;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }),
    ...display
      .slice()
      .reverse()
      .map((b, i) => {
        const y = PAD_T + chartH - (((b.p25_price ?? b.median_price ?? 0) - minP) / range) * chartH;
        const ri = display.length - 1 - i;
        const x = PAD_L + gap * ri + gap / 2;
        return `L ${x.toFixed(1)} ${y.toFixed(1)}`;
      }),
    "Z",
  ].join(" ");

  // Show only every N-th month label to avoid crowding
  const labelEvery = display.length > 18 ? 3 : display.length > 9 ? 2 : 1;

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: "auto" }}
        aria-label={`Price history chart for ${category}`}
      >
        {/* P25–P75 band */}
        {display.some((b) => b.p25_price && b.p75_price) && (
          <path d={bandD} fill="var(--antique-accent, #8B6914)" fillOpacity={0.08} />
        )}

        {/* Bars behind the line */}
        {display.map((b, i) => {
          const p = b.median_price ?? 0;
          if (!p) return null;
          const barH = ((p - minP) / range) * chartH;
          const x = PAD_L + gap * i + gap / 2 - barW / 2;
          const y = PAD_T + chartH - barH;
          return (
            <rect
              key={i}
              x={x.toFixed(1)}
              y={y.toFixed(1)}
              width={barW.toFixed(1)}
              height={barH.toFixed(1)}
              fill="var(--antique-accent, #8B6914)"
              fillOpacity={0.18}
              rx="2"
            />
          );
        })}

        {/* Trend line */}
        <path
          d={pathD}
          fill="none"
          stroke="var(--antique-accent, #8B6914)"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {points.map((pt, i) =>
          pt.b.median_price ? (
            <circle key={i} cx={pt.x} cy={pt.y} r="3" fill="var(--antique-accent, #8B6914)" />
          ) : null
        )}

        {/* Month labels */}
        {display.map((b, i) => {
          if (i % labelEvery !== 0) return null;
          const x = PAD_L + gap * i + gap / 2;
          return (
            <text
              key={i}
              x={x}
              y={H - 4}
              textAnchor="middle"
              fontSize="9"
              fill="var(--antique-text-mute, #9ca3af)"
            >
              {monthLabel(b.time_bucket)}
            </text>
          );
        })}

        {/* Min / max price labels */}
        {prices.length > 0 && (
          <>
            <text x={PAD_L} y={PAD_T + 8} fontSize="9" fill="var(--antique-text-mute, #9ca3af)">
              {fmt(maxP)}
            </text>
            <text x={PAD_L} y={PAD_T + chartH} fontSize="9" fill="var(--antique-text-mute, #9ca3af)">
              {fmt(minP)}
            </text>
          </>
        )}
      </svg>

      {/* Stats row */}
      <div className="flex flex-wrap gap-4 mt-2 text-xs text-antique-text-mute">
        <span>
          <strong className="text-antique-text">
            {display.reduce((s, b) => s + b.sale_count, 0)}
          </strong>{" "}
          sold
        </span>
        {prices.length > 0 && (
          <span>
            Median:{" "}
            <strong className="text-antique-text">
              {fmt(prices[Math.floor(prices.length / 2)])}
            </strong>
          </span>
        )}
        {maxP > 0 && (
          <span>
            Range: {fmt(minP)} – {fmt(maxP)}
          </span>
        )}
      </div>
    </div>
  );
}
