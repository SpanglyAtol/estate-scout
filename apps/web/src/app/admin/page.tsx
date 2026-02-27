/**
 * Admin Dashboard — server component, always renders fresh.
 * Reads directly from scraped-listings.json via getListings() — no API round-trip.
 *
 * Navigate to /admin to view.
 */
import Link from "next/link";
import {
  Package, TrendingUp, Clock, Calendar, AlertCircle,
  CheckCircle, RefreshCw, ExternalLink, BarChart3, Tag,
} from "lucide-react";
import { getListings } from "@/lib/scraped-data";

export const dynamic = "force-dynamic";

// ── Small helpers ─────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon: Icon, iconColor, iconBg,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 text-center">
      <div className={`inline-flex items-center justify-center w-9 h-9 rounded-full ${iconBg} mb-2`}>
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>
      <div className="text-2xl font-bold text-gray-900 tabular-nums">
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  const color =
    pct >= 75 ? "bg-green-500" : pct >= 40 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="w-full bg-gray-100 rounded-full h-2 mt-1.5">
      <div
        className={`${color} h-2 rounded-full transition-all`}
        style={{ width: `${Math.max(pct, 2)}%` }}
      />
    </div>
  );
}

function PlatformBar({ pct }: { pct: number }) {
  return (
    <div className="w-full bg-gray-100 rounded-full h-2 mt-1.5">
      <div
        className="bg-blue-500 h-2 rounded-full transition-all"
        style={{ width: `${Math.max(pct, 2)}%` }}
      />
    </div>
  );
}

function CategoryBar({ pct }: { pct: number }) {
  return (
    <div className="w-full bg-gray-100 rounded-full h-2 mt-1.5">
      <div
        className="bg-purple-400 h-2 rounded-full transition-all"
        style={{ width: `${Math.max(pct, 2)}%` }}
      />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const all = getListings();
  const now = Date.now();
  const total = all.length;

  // Status breakdown
  let live = 0, upcoming = 0, ended = 0, endingSoon = 0;
  // Quality
  let withImage = 0, withLocation = 0, withPrice = 0, withCategory = 0, withItems = 0;
  // Platform + category maps
  const platformCounts: Record<string, { display_name: string; count: number }> = {};
  const categoryCounts: Record<string, number> = {};
  let latestScrapedAt: string | null = null;

  for (const l of all) {
    const starts = l.sale_starts_at ? new Date(l.sale_starts_at).getTime() : null;
    const ends   = l.sale_ends_at   ? new Date(l.sale_ends_at).getTime()   : null;

    if (l.is_completed)                             { ended++; }
    else if (starts !== null && starts > now)       { upcoming++; }
    else if (ends   !== null && ends   < now)       { ended++; }
    else {
      if (ends !== null && ends - now < 86_400_000) endingSoon++;
      live++;
    }

    if (l.primary_image_url)              withImage++;
    if (l.city || l.state || l.zip_code)  withLocation++;
    if (l.current_price !== null)         withPrice++;
    if (l.items && l.items.length > 0)    withItems++;
    if (l.category) {
      withCategory++;
      categoryCounts[l.category] = (categoryCounts[l.category] ?? 0) + 1;
    }

    const pName = l.platform.name;
    if (!platformCounts[pName]) {
      platformCounts[pName] = { display_name: l.platform.display_name, count: 0 };
    }
    platformCounts[pName].count++;

    if (l.scraped_at && (!latestScrapedAt || l.scraped_at > latestScrapedAt)) {
      latestScrapedAt = l.scraped_at;
    }
  }

  const byPlatform = Object.entries(platformCounts)
    .sort(([, a], [, b]) => b.count - a.count)
    .map(([, data]) => ({
      display_name: data.display_name,
      count: data.count,
      pct: total > 0 ? Math.round((data.count / total) * 100) : 0,
    }));

  const byCategory = Object.entries(categoryCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([name, count]) => ({
      name,
      count,
      pct: total > 0 ? Math.round((count / total) * 100) : 0,
    }));
  const maxCatCount = byCategory[0]?.count ?? 1;

  // Data freshness label
  let dataAgeLabel = "Unknown";
  if (latestScrapedAt) {
    const ageMs    = now - new Date(latestScrapedAt).getTime();
    const ageHours = Math.floor(ageMs / 3_600_000);
    if (ageHours < 1)      dataAgeLabel = "< 1 hour ago";
    else if (ageHours < 24) dataAgeLabel = `${ageHours}h ago`;
    else                    dataAgeLabel = `${Math.floor(ageHours / 24)}d ago`;
  }

  const qualityItems = [
    { label: "With image",    count: withImage,    pct: total > 0 ? Math.round((withImage    / total) * 100) : 0, emoji: "🖼️" },
    { label: "With location", count: withLocation, pct: total > 0 ? Math.round((withLocation / total) * 100) : 0, emoji: "📍" },
    { label: "With price",    count: withPrice,    pct: total > 0 ? Math.round((withPrice    / total) * 100) : 0, emoji: "💲" },
    { label: "Categorized",   count: withCategory, pct: total > 0 ? Math.round((withCategory / total) * 100) : 0, emoji: "🏷️" },
    { label: "With item lots", count: withItems,   pct: total > 0 ? Math.round((withItems    / total) * 100) : 0, emoji: "🔨" },
  ];

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            Admin Dashboard
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Data last scraped:{" "}
            <span className="font-medium text-gray-700">{dataAgeLabel}</span>
            {latestScrapedAt && (
              <span className="ml-2 text-gray-400">
                ({new Date(latestScrapedAt).toLocaleString()})
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="https://github.com/SpanglyAtol/estate-scout/actions"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm bg-gray-900 text-white px-4 py-2 rounded-xl hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Run Scraper
          </a>
          <a
            href="https://vercel.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl hover:border-blue-300 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Vercel
          </a>
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        <StatCard label="Total Listings" value={total}      icon={Package}      iconColor="text-blue-600"   iconBg="bg-blue-50" />
        <StatCard label="Live Now"        value={live}       icon={TrendingUp}   iconColor="text-green-600"  iconBg="bg-green-50" />
        <StatCard label="Upcoming"        value={upcoming}   icon={Calendar}     iconColor="text-blue-400"   iconBg="bg-sky-50" />
        <StatCard label="Ending Soon"     value={endingSoon} icon={Clock}        iconColor="text-red-500"    iconBg="bg-red-50" />
        <StatCard label="Ended / Done"    value={ended}      icon={AlertCircle}  iconColor="text-gray-400"   iconBg="bg-gray-50" />
        <StatCard label="Platforms"       value={byPlatform.length} icon={CheckCircle} iconColor="text-purple-600" iconBg="bg-purple-50" />
      </div>

      {/* ── Platform + Quality ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

        {/* Platform breakdown */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <h2 className="text-sm font-bold text-gray-900 mb-5 flex items-center gap-1.5">
            <Tag className="w-4 h-4 text-blue-500" />
            Platform Breakdown
          </h2>
          <div className="space-y-4">
            {byPlatform.map(({ display_name, count, pct }) => (
              <div key={display_name}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-700">{display_name}</span>
                  <span className="text-gray-500 tabular-nums">
                    {count.toLocaleString()}{" "}
                    <span className="text-gray-400">({pct}%)</span>
                  </span>
                </div>
                <PlatformBar pct={pct} />
              </div>
            ))}
          </div>
        </div>

        {/* Data quality */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <h2 className="text-sm font-bold text-gray-900 mb-5 flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4 text-green-500" />
            Data Quality
          </h2>
          <div className="space-y-4">
            {qualityItems.map(({ label, count, pct, emoji }) => (
              <div key={label}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">
                    {emoji} {label}
                  </span>
                  <span className="font-semibold text-gray-900 tabular-nums">
                    {pct}%{" "}
                    <span className="font-normal text-gray-400">
                      ({count.toLocaleString()})
                    </span>
                  </span>
                </div>
                <ProgressBar pct={pct} />
              </div>
            ))}
          </div>
          <div className="mt-5 pt-4 border-t border-gray-100 text-xs text-gray-400 space-y-0.5">
            <p>Total: {total.toLocaleString()} listings</p>
            <p>
              Uncategorized: {(total - withCategory).toLocaleString()} (
              {total > 0 ? Math.round(((total - withCategory) / total) * 100) : 0}%)
            </p>
          </div>
        </div>
      </div>

      {/* ── Category distribution ── */}
      {byCategory.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
          <h2 className="text-sm font-bold text-gray-900 mb-5 flex items-center gap-1.5">
            <BarChart3 className="w-4 h-4 text-purple-500" />
            Category Distribution
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-3">
            {byCategory.map(({ name, count }) => (
              <div key={name}>
                <div className="flex items-center justify-between text-sm">
                  <span className="capitalize font-medium text-gray-700">{name}</span>
                  <span className="text-gray-500 tabular-nums">{count.toLocaleString()}</span>
                </div>
                <CategoryBar pct={Math.round((count / maxCatCount) * 100)} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Quick links ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <a
          href="https://github.com/SpanglyAtol/estate-scout/actions"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-gray-900 text-white rounded-2xl p-5 hover:bg-gray-700 transition-colors"
        >
          <div className="text-xl mb-2">⚙️</div>
          <div className="font-bold text-sm">GitHub Actions</div>
          <div className="text-xs text-gray-400 mt-0.5">
            View scraper runs · trigger on-demand
          </div>
        </a>

        <a
          href="https://vercel.com/dashboard"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-white border border-gray-200 rounded-2xl p-5 hover:border-blue-300 transition-colors"
        >
          <div className="text-xl mb-2">▲</div>
          <div className="font-bold text-sm text-gray-900">Vercel Dashboard</div>
          <div className="text-xs text-gray-500 mt-0.5">
            Deployments · logs · environment vars
          </div>
        </a>

        <Link
          href="/api/v1/admin/metrics"
          className="bg-white border border-gray-200 rounded-2xl p-5 hover:border-purple-300 transition-colors"
        >
          <div className="text-xl mb-2">📊</div>
          <div className="font-bold text-sm text-gray-900">Raw Metrics JSON</div>
          <div className="text-xs text-gray-500 mt-0.5">
            /api/v1/admin/metrics endpoint
          </div>
        </Link>
      </div>

      {/* ── Status summary row ── */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 text-sm text-blue-700">
        <p className="font-semibold mb-1">Scraper Coverage Notes</p>
        <ul className="space-y-0.5 text-blue-600 list-disc list-inside">
          <li>BidSpotter — JSON API, 17 pages × 60 = ~1,020 US-wide listings</li>
          <li>HiBid — GraphQL API, auto-stops when all pages fetched (~1,009 today)</li>
          <li>EstateSales.NET — JSON-LD, 10 states × 2 pages ≈ 60 listings</li>
          <li>MaxSold — HTML scraper, WA state only, auction-level (3 unique auctions)</li>
          <li>LiveAuctioneers — blocked (403), excluded from default targets</li>
        </ul>
        <p className="mt-3 text-xs text-blue-500">
          Run <code className="bg-blue-100 px-1 py-0.5 rounded font-mono">python backend/scrapers/hydrate.py --targets ms,bs,hi,es --max-pages 17</code> locally,
          or trigger the <a href="https://github.com/SpanglyAtol/estate-scout/actions" className="underline" target="_blank" rel="noopener noreferrer">GitHub Actions workflow</a> to refresh.
        </p>
      </div>
    </div>
  );
}
