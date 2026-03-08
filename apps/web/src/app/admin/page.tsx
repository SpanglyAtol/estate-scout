/**
 * Admin Analytics Dashboard
 * ──────────────────────────
 * Protected by middleware — requires ADMIN_PASSWORD env var + login at /admin/login.
 * Tracks scraper health, enrichment coverage, AI pricing accuracy, and data quality
 * across all platforms. All metrics computed server-side from scraped JSON files.
 */
import Link from "next/link";
import {
  Package, TrendingUp, Clock, Calendar, AlertCircle,
  RefreshCw, ExternalLink, BarChart3,
  Database, DollarSign, ChevronRight,
  GitBranch, Server, Bot, CreditCard, Megaphone,
  Activity, Target, MapPin, Layers, ChevronDown,
} from "lucide-react";
import { getListings } from "@/lib/scraped-data";
import { AdminLogoutButton } from "./logout-button";

export const dynamic = "force-dynamic";

// ── Tiny shared helpers ────────────────────────────────────────────────────────

function pct(num: number, den: number) {
  return den === 0 ? 0 : Math.round((num / den) * 100);
}

function Bar({ value, max, color = "bg-antique-accent" }: { value: number; max: number; color?: string }) {
  const w = max === 0 ? 0 : Math.max(Math.round((value / max) * 100), value > 0 ? 2 : 0);
  return (
    <div className="w-full bg-antique-subtle rounded-full h-1.5 mt-1">
      <div className={`${color} h-1.5 rounded-full`} style={{ width: `${w}%` }} />
    </div>
  );
}

function PctBar({ p }: { p: number }) {
  const color = p >= 75 ? "bg-green-500" : p >= 40 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="w-full bg-antique-subtle rounded-full h-1.5 mt-0.5">
      <div className={`${color} h-1.5 rounded-full`} style={{ width: `${Math.max(p, p > 0 ? 2 : 0)}%` }} />
    </div>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <h2 className="font-display text-base font-bold text-antique-text mb-5 flex items-center gap-2">
      <Icon className="w-4 h-4 text-antique-accent" />
      {children}
    </h2>
  );
}

function KpiCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string;
}) {
  return (
    <div className="antique-card p-4 text-center">
      <Icon className={`w-5 h-5 ${color} mx-auto mb-2`} />
      <div className="font-display text-2xl font-bold text-antique-text tabular-nums">
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
      <div className="text-xs text-antique-text-mute mt-0.5">{label}</div>
      {sub && <div className="text-xs text-antique-text-mute mt-0.5 opacity-70">{sub}</div>}
    </div>
  );
}

type StepStatus = "done" | "pending" | "optional";

function SetupStep({ status, title, desc, href, linkLabel, children }: {
  status: StepStatus; title: string; desc: string;
  href?: string; linkLabel?: string; children?: React.ReactNode;
}) {
  const dot = status === "done" ? "bg-green-500" : status === "pending" ? "bg-amber-400" : "bg-antique-border";
  return (
    <div className="flex gap-4 pb-5 border-b border-antique-border last:border-0 last:pb-0">
      <div className="flex-shrink-0 mt-0.5">
        <span className={`inline-block w-2.5 h-2.5 rounded-full ${dot}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm font-semibold text-antique-text">{title}</p>
          {status === "done" && <span className="text-xs text-green-600 font-medium">Complete</span>}
          {status === "optional" && <span className="text-xs text-antique-text-mute">Optional</span>}
        </div>
        <p className="text-xs text-antique-text-sec mt-0.5 leading-relaxed">{desc}</p>
        {children && (
          <div className="mt-2 bg-antique-muted rounded-lg p-3 text-xs text-antique-text-sec space-y-1 leading-relaxed">
            {children}
          </div>
        )}
        {href && linkLabel && (
          <a href={href} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-2 text-xs text-antique-accent hover:text-antique-accent-h font-medium transition-colors">
            {linkLabel} <ChevronRight className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const all = getListings();
  const now = Date.now();
  const total = all.length;

  let live = 0, upcoming = 0, ended = 0, endingSoon = 0;
  let latestScrapedAt: string | null = null;

  type PlatformStats = {
    display_name: string;
    total: number; withImage: number; withPrice: number; withLocation: number;
    withCategory: number; withMaker: number; withPeriod: number; withSubCat: number;
    withEstimate: number; inRange: number;
  };
  const platformMap: Record<string, PlatformStats> = {};

  type CatStats = {
    total: number; withMaker: number; withPeriod: number;
    withSubCat: number; withOrigin: number; withAttrs: number; prices: number[];
  };
  const catMap: Record<string, CatStats> = {};
  const stateMap: Record<string, number> = {};

  let withEstimate = 0, priceInRange = 0, priceBelow = 0, priceAbove = 0;

  for (const l of all) {
    const starts = l.sale_starts_at ? new Date(l.sale_starts_at).getTime() : null;
    const ends   = l.sale_ends_at   ? new Date(l.sale_ends_at).getTime()   : null;
    if (l.is_completed)                           ended++;
    else if (starts !== null && starts > now)     upcoming++;
    else if (ends   !== null && ends   < now)     ended++;
    else {
      if (ends !== null && ends - now < 86_400_000) endingSoon++;
      live++;
    }
    if (l.scraped_at && (!latestScrapedAt || l.scraped_at > latestScrapedAt)) latestScrapedAt = l.scraped_at;

    const pKey = l.platform.name;
    if (!platformMap[pKey]) {
      platformMap[pKey] = {
        display_name: l.platform.display_name,
        total: 0, withImage: 0, withPrice: 0, withLocation: 0,
        withCategory: 0, withMaker: 0, withPeriod: 0, withSubCat: 0,
        withEstimate: 0, inRange: 0,
      };
    }
    const ps = platformMap[pKey];
    ps.total++;
    if (l.primary_image_url)                 ps.withImage++;
    if (l.current_price !== null)            ps.withPrice++;
    if (l.city || l.state || l.zip_code)    ps.withLocation++;
    if (l.category)                          ps.withCategory++;
    const lx = l as unknown as Record<string, unknown>;
    if (lx.maker)        ps.withMaker++;
    if (lx.period)       ps.withPeriod++;
    if (lx.sub_category) ps.withSubCat++;

    const cat = (l.category ?? "uncategorized").toLowerCase();
    if (!catMap[cat]) catMap[cat] = { total: 0, withMaker: 0, withPeriod: 0, withSubCat: 0, withOrigin: 0, withAttrs: 0, prices: [] };
    const cs = catMap[cat];
    cs.total++;
    if (lx.maker)        cs.withMaker++;
    if (lx.period)       cs.withPeriod++;
    if (lx.sub_category) cs.withSubCat++;
    if (lx.country_of_origin) cs.withOrigin++;
    if (lx.attributes && Object.keys(lx.attributes as object).length > 0) cs.withAttrs++;
    if (l.current_price !== null) cs.prices.push(l.current_price);

    if (l.state) stateMap[l.state] = (stateMap[l.state] ?? 0) + 1;

    const estLow  = (lx.estimate_low  as number | null) ?? null;
    const estHigh = (lx.estimate_high as number | null) ?? null;
    if (estLow !== null && estHigh !== null && l.current_price !== null) {
      withEstimate++;
      ps.withEstimate++;
      if (l.current_price >= estLow && l.current_price <= estHigh) { priceInRange++; ps.inRange++; }
      else if (l.current_price < estLow) priceBelow++;
      else priceAbove++;
    }
  }

  const platforms = Object.entries(platformMap).sort(([, a], [, b]) => b.total - a.total).map(([, s]) => s);

  const categories = Object.entries(catMap)
    .sort(([, a], [, b]) => b.total - a.total)
    .map(([name, s]) => {
      const sorted = [...s.prices].sort((a, b) => a - b);
      const median = sorted.length === 0 ? null
        : sorted.length % 2 === 0
          ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
          : sorted[Math.floor(sorted.length / 2)];
      return { name, ...s, median };
    });

  const states = Object.entries(stateMap).sort(([, a], [, b]) => b - a).slice(0, 16);

  let totalWithMaker = 0, totalWithPeriod = 0, totalWithSubCat = 0;
  for (const s of Object.values(catMap)) { totalWithMaker += s.withMaker; totalWithPeriod += s.withPeriod; totalWithSubCat += s.withSubCat; }
  const enrichmentRate = pct(totalWithMaker + totalWithPeriod + totalWithSubCat, total * 3);

  let dataAgeLabel = "Unknown";
  if (latestScrapedAt) {
    const h = Math.floor((now - new Date(latestScrapedAt).getTime()) / 3_600_000);
    dataAgeLabel = h < 1 ? "< 1h ago" : h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
  }

  const accuracyPct = withEstimate > 0 ? pct(priceInRange, withEstimate) : null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
        <div>
          <p className="text-antique-accent font-display text-xs tracking-[0.2em] uppercase mb-1">Operations</p>
          <h1 className="font-display text-2xl font-bold text-antique-text flex items-center gap-2">
            <Activity className="w-6 h-6 text-antique-accent" />
            Analytics Dashboard
          </h1>
          <p className="text-sm text-antique-text-mute mt-1">
            Data last refreshed: <span className="font-medium text-antique-text-sec">{dataAgeLabel}</span>
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <a href="https://github.com/SpanglyAtol/estate-scout/actions" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm bg-antique-text text-antique-bg px-4 py-2 rounded-lg hover:opacity-80 transition-opacity">
            <RefreshCw className="w-4 h-4" /> Run Scraper
          </a>
          <a href="https://vercel.com/dashboard" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm antique-card px-4 py-2 rounded-lg hover:border-antique-accent transition-colors">
            <ExternalLink className="w-4 h-4 text-antique-text-sec" /> Vercel
          </a>
          <AdminLogoutButton />
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-10">
        <KpiCard label="Total"        value={total}               icon={Package}     color="text-antique-accent" />
        <KpiCard label="Live"         value={live}                icon={TrendingUp}  color="text-green-500" />
        <KpiCard label="Upcoming"     value={upcoming}            icon={Calendar}    color="text-blue-400" />
        <KpiCard label="Ending Today" value={endingSoon}          icon={Clock}       color="text-red-500" />
        <KpiCard label="Ended"        value={ended}               icon={AlertCircle} color="text-antique-text-mute" />
        <KpiCard label="Enrichment"   value={`${enrichmentRate}%`} sub="maker+period+subcat" icon={Layers} color="text-purple-500" />
      </div>

      {/* ── Scraper performance table ── */}
      <div className="antique-card p-6 mb-8 overflow-x-auto">
        <SectionTitle icon={Activity}>Scraper Performance — per Platform</SectionTitle>
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="border-b border-antique-border text-xs text-antique-text-mute uppercase tracking-wide">
              <th className="text-left pb-2 pr-4 font-medium">Platform</th>
              <th className="text-right pb-2 px-3 font-medium">Listings</th>
              <th className="text-right pb-2 px-3 font-medium">Image</th>
              <th className="text-right pb-2 px-3 font-medium">Price</th>
              <th className="text-right pb-2 px-3 font-medium">Location</th>
              <th className="text-right pb-2 px-3 font-medium">Category</th>
              <th className="text-right pb-2 px-3 font-medium">Maker</th>
              <th className="text-right pb-2 px-3 font-medium">Period</th>
              <th className="text-right pb-2 pl-3 font-medium">Est. Accuracy</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-antique-border">
            {platforms.map((p) => {
              const fields = [
                pct(p.withImage, p.total), pct(p.withPrice, p.total), pct(p.withLocation, p.total),
                pct(p.withCategory, p.total), pct(p.withMaker, p.total), pct(p.withPeriod, p.total),
              ];
              const acc = p.withEstimate > 0 ? pct(p.inRange, p.withEstimate) : null;
              return (
                <tr key={p.display_name} className="hover:bg-antique-muted/30 transition-colors">
                  <td className="py-2.5 pr-4 font-medium text-antique-text">{p.display_name}</td>
                  <td className="py-2.5 px-3 text-right text-antique-text-sec tabular-nums">{p.total.toLocaleString()}</td>
                  {fields.map((v, i) => (
                    <td key={i} className="py-2.5 px-3 text-right">
                      <span className={v >= 75 ? "text-green-600" : v >= 40 ? "text-amber-600" : "text-red-500"}>{v}%</span>
                    </td>
                  ))}
                  <td className="py-2.5 pl-3 text-right">
                    {acc !== null
                      ? <span className={acc >= 60 ? "text-green-600" : acc >= 35 ? "text-amber-600" : "text-antique-text-mute"}>{acc}%</span>
                      : <span className="text-antique-text-mute text-xs">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-antique-border-s font-semibold text-antique-text bg-antique-muted/50">
              <td className="py-2 pr-4 text-sm">Total</td>
              <td className="py-2 px-3 text-right tabular-nums text-sm">{total.toLocaleString()}</td>
              {[
                pct(platforms.reduce((s, p) => s + p.withImage,    0), total),
                pct(platforms.reduce((s, p) => s + p.withPrice,    0), total),
                pct(platforms.reduce((s, p) => s + p.withLocation, 0), total),
                pct(platforms.reduce((s, p) => s + p.withCategory, 0), total),
                pct(platforms.reduce((s, p) => s + p.withMaker,    0), total),
                pct(platforms.reduce((s, p) => s + p.withPeriod,   0), total),
              ].map((v, i) => (
                <td key={i} className="py-2 px-3 text-right text-sm">
                  <span className={v >= 75 ? "text-green-600" : v >= 40 ? "text-amber-600" : "text-red-500"}>{v}%</span>
                </td>
              ))}
              <td className="py-2 pl-3 text-right text-sm">
                {accuracyPct !== null
                  ? <span className={accuracyPct >= 60 ? "text-green-600" : accuracyPct >= 35 ? "text-amber-600" : "text-red-500"}>{accuracyPct}%</span>
                  : <span className="text-antique-text-mute">—</span>}
              </td>
            </tr>
          </tfoot>
        </table>
        <p className="text-xs text-antique-text-mute mt-3">
          Est. Accuracy = % of listings where current_price falls within the estimate range (low–high).
        </p>
      </div>

      {/* ── AI Pricing Accuracy + Enrichment Coverage ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

        <div className="antique-card p-6">
          <SectionTitle icon={Target}>AI Pricing Accuracy</SectionTitle>
          {withEstimate === 0 ? (
            <p className="text-sm text-antique-text-mute italic">
              No listings with both estimate range and current price yet. Will populate once
              eBay sold comps + auction estimate data is scraped.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-4 mb-5">
                {[
                  { label: "Within range", value: priceInRange, color: "text-green-600", bg: "bg-green-500" },
                  { label: "Below est.",   value: priceBelow,   color: "text-blue-500",  bg: "bg-blue-400" },
                  { label: "Above est.",   value: priceAbove,   color: "text-amber-600", bg: "bg-amber-400" },
                ].map(({ label, value, color, bg }) => (
                  <div key={label} className="text-center">
                    <div className={`font-display text-2xl font-bold tabular-nums ${color}`}>
                      {pct(value, withEstimate)}%
                    </div>
                    <div className="text-xs text-antique-text-mute mt-0.5">{label}</div>
                    <div className="w-full bg-antique-subtle rounded-full h-2 mt-2">
                      <div className={`${bg} h-2 rounded-full`} style={{ width: `${pct(value, withEstimate)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-antique-text-mute">
                Based on {withEstimate.toLocaleString()} listings with estimate ranges.
                Target: &gt;60% within range = well-calibrated.
              </p>
            </>
          )}
        </div>

        <div className="antique-card p-6">
          <SectionTitle icon={Layers}>Enrichment Coverage by Category</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[340px]">
              <thead>
                <tr className="text-antique-text-mute uppercase tracking-wide border-b border-antique-border">
                  <th className="text-left pb-2 pr-3 font-medium">Category</th>
                  <th className="text-right pb-2 px-2 font-medium" title="Maker">Mkr</th>
                  <th className="text-right pb-2 px-2 font-medium" title="Period">Per</th>
                  <th className="text-right pb-2 px-2 font-medium" title="Sub-category">Sub</th>
                  <th className="text-right pb-2 px-2 font-medium" title="Country of origin">Org</th>
                  <th className="text-right pb-2 pl-2 font-medium" title="Structured attributes">Attr</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-antique-border">
                {categories.slice(0, 14).map((c) => {
                  const fields = [
                    pct(c.withMaker,  c.total), pct(c.withPeriod, c.total),
                    pct(c.withSubCat, c.total), pct(c.withOrigin, c.total),
                    pct(c.withAttrs,  c.total),
                  ];
                  return (
                    <tr key={c.name}>
                      <td className="py-1.5 pr-3 capitalize text-antique-text font-medium">{c.name}</td>
                      {fields.map((v, i) => (
                        <td key={i} className="py-1.5 px-2 text-right">
                          <span className={`font-semibold ${v >= 50 ? "text-green-600" : v >= 20 ? "text-amber-600" : "text-antique-text-mute"}`}>
                            {v > 0 ? `${v}%` : "—"}
                          </span>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-antique-text-mute mt-3">
            Mkr=Maker · Per=Period · Sub=Sub-category · Org=Origin · Attr=Attributes
          </p>
        </div>
      </div>

      {/* ── Category intelligence table ── */}
      <div className="antique-card p-6 mb-8 overflow-x-auto">
        <SectionTitle icon={BarChart3}>Category Intelligence</SectionTitle>
        <table className="w-full text-sm min-w-[580px]">
          <thead>
            <tr className="border-b border-antique-border text-xs text-antique-text-mute uppercase tracking-wide">
              <th className="text-left pb-2 pr-4 font-medium">Category</th>
              <th className="text-right pb-2 px-3 font-medium">Listings</th>
              <th className="text-right pb-2 px-3 font-medium">Share</th>
              <th className="text-right pb-2 px-3 font-medium">Median price</th>
              <th className="text-right pb-2 px-3 font-medium">Enriched</th>
              <th className="text-right pb-2 pl-3 font-medium">Sub-cats filled</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-antique-border">
            {categories.slice(0, 16).map((c) => {
              const share   = pct(c.total, total);
              const enriched = pct(c.withMaker + c.withPeriod + c.withSubCat, c.total * 3);
              return (
                <tr key={c.name} className="hover:bg-antique-muted/30 transition-colors">
                  <td className="py-2.5 pr-4">
                    <Link href={`/categories/${c.name.toLowerCase()}`}
                      className="font-medium text-antique-text capitalize hover:text-antique-accent transition-colors">
                      {c.name}
                    </Link>
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-antique-text-sec">{c.total.toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-right">
                    <div>
                      <span className="text-antique-text-sec">{share}%</span>
                      <Bar value={share} max={100} color="bg-purple-400" />
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-right text-antique-text-sec tabular-nums">
                    {c.median !== null ? `$${Math.round(c.median).toLocaleString()}` : "—"}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <div>
                      <span className={enriched >= 50 ? "text-green-600" : enriched >= 20 ? "text-amber-600" : "text-antique-text-mute"}>{enriched}%</span>
                      <PctBar p={enriched} />
                    </div>
                  </td>
                  <td className="py-2.5 pl-3 text-right text-antique-text-sec tabular-nums">
                    {pct(c.withSubCat, c.total) > 0 ? `${pct(c.withSubCat, c.total)}%` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Geographic coverage ── */}
      {states.length > 0 && (
        <div className="antique-card p-6 mb-8">
          <SectionTitle icon={MapPin}>Geographic Coverage — Top States</SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-x-6 gap-y-3">
            {states.map(([state, count]) => (
              <div key={state}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-antique-text">{state}</span>
                  <span className="tabular-nums text-antique-text-mute text-xs">{count.toLocaleString()}</span>
                </div>
                <Bar value={count} max={states[0][1]} />
              </div>
            ))}
          </div>
          <p className="text-xs text-antique-text-mute mt-4">
            {Object.keys(stateMap).length} states represented ·{" "}
            {(total - all.filter(l => l.state).length).toLocaleString()} listings missing location
          </p>
        </div>
      )}

      {/* ── Deployment checklist (collapsed) ── */}
      <details className="mb-8 group">
        <summary className="flex items-center gap-2 cursor-pointer select-none text-xs text-antique-text-mute tracking-widest uppercase mb-0 list-none border-t border-antique-border pt-6">
          <ChevronDown className="w-3.5 h-3.5 group-open:rotate-180 transition-transform" />
          Deployment Checklist
        </summary>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="antique-card p-6">
            <SectionTitle icon={GitBranch}>Phase 1 — Automated Scraping</SectionTitle>
            <div className="space-y-5">
              <SetupStep status="done"    title="GitHub Actions workflow" desc="Scraper workflows committed — run daily + on-demand." />
              <SetupStep status="pending" title="Add VERCEL_TOKEN" desc="Enables auto-deploy to Vercel after each scraper run."
                href="https://vercel.com/account/tokens" linkLabel="vercel.com/account/tokens">
                <p>GitHub Secrets: <code className="bg-antique-subtle px-1 rounded">VERCEL_TOKEN</code></p>
              </SetupStep>
              <SetupStep status="pending" title="Add VERCEL_ORG_ID + VERCEL_PROJECT_ID" desc="Tells the workflow which Vercel project to deploy."
                href="https://vercel.com/dashboard" linkLabel="Vercel project settings" />
            </div>
          </div>
          <div className="antique-card p-6">
            <SectionTitle icon={Bot}>Phase 2 — AI Features</SectionTitle>
            <div className="space-y-5">
              <SetupStep status="pending" title="ANTHROPIC_API_KEY → Curator's Picks" desc="Runs Claude Haiku to produce the Featured Picks homepage section."
                href="https://console.anthropic.com/" linkLabel="console.anthropic.com">
                <p>GitHub Secrets: <code className="bg-antique-subtle px-1 rounded">ANTHROPIC_API_KEY</code></p>
              </SetupStep>
              <SetupStep status="pending" title="OPENAI_API_KEY → AI Valuations" desc="Powers real AI price estimates in valuation chat."
                href="https://platform.openai.com/api-keys" linkLabel="platform.openai.com">
                <p>Vercel env: <code className="bg-antique-subtle px-1 rounded">OPENAI_API_KEY</code></p>
              </SetupStep>
              <SetupStep status="pending" title="ADMIN_PASSWORD → this dashboard" desc="Set to protect and enable the admin analytics dashboard."
                href="https://vercel.com/dashboard" linkLabel="Vercel env vars">
                <p>Vercel env: <code className="bg-antique-subtle px-1 rounded">ADMIN_PASSWORD</code></p>
              </SetupStep>
            </div>
          </div>
          <div className="antique-card p-6">
            <SectionTitle icon={Database}>Phase 3 — Database + Backend</SectionTitle>
            <div className="space-y-5">
              <SetupStep status="pending" title="Supabase PostgreSQL (free)" desc="Real user accounts, saved searches, price alerts at scale."
                href="https://supabase.com/dashboard/new/default-org" linkLabel="supabase.com">
                <p>Vercel env: <code className="bg-antique-subtle px-1 rounded">DATABASE_URL</code></p>
              </SetupStep>
              <SetupStep status="pending" title="FastAPI backend on Railway" desc="Live search, real-time filtering, enriched field queries."
                href="https://railway.app/new" linkLabel="railway.app">
                <p>Vercel env: <code className="bg-antique-subtle px-1 rounded">NEXT_PUBLIC_API_URL</code></p>
              </SetupStep>
            </div>
          </div>
          <div className="antique-card p-6">
            <SectionTitle icon={DollarSign}>Phase 4 — Monetization</SectionTitle>
            <div className="space-y-5">
              <SetupStep status="pending" title="Stripe — subscriptions" desc="$19/mo Pro + $79/mo Premium. Code is fully implemented."
                href="https://dashboard.stripe.com/register" linkLabel="dashboard.stripe.com">
                <p><code className="bg-antique-subtle px-1 rounded">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> + <code className="bg-antique-subtle px-1 rounded">STRIPE_SECRET_KEY</code></p>
              </SetupStep>
              <SetupStep status="optional" title="Google AdSense" desc="Display ads for free-tier users. Needs ~3 months traffic."
                href="https://adsense.google.com/start/" linkLabel="adsense.google.com" />
            </div>
          </div>
        </div>
      </details>

      {/* ── Quick links ── */}
      <div className="ornament-divider mb-6 text-xs text-antique-text-mute tracking-widest uppercase">Quick Links</div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        {[
          { icon: GitBranch, label: "GitHub Actions",  sub: "Trigger scraper",        href: "https://github.com/SpanglyAtol/estate-scout/actions" },
          { icon: Server,    label: "Vercel",          sub: "Deployments + env vars",  href: "https://vercel.com/dashboard" },
          { icon: Database,  label: "Supabase",        sub: "Database setup",          href: "https://supabase.com/dashboard" },
          { icon: Bot,       label: "Anthropic",       sub: "API keys + billing",      href: "https://console.anthropic.com/" },
          { icon: CreditCard,label: "Stripe",          sub: "Subscriptions",           href: "https://dashboard.stripe.com/" },
          { icon: Megaphone, label: "AdSense",         sub: "Ad revenue",              href: "https://adsense.google.com/" },
        ].map(({ icon: Icon, label, sub, href }) => (
          <a key={label} href={href} target="_blank" rel="noopener noreferrer"
            className="antique-card p-4 hover:border-antique-accent transition-colors group">
            <Icon className="w-5 h-5 text-antique-accent mb-2" />
            <div className="text-xs font-semibold text-antique-text group-hover:text-antique-accent transition-colors">{label}</div>
            <div className="text-xs text-antique-text-mute mt-0.5">{sub}</div>
          </a>
        ))}
      </div>

      <Link href="/api/v1/admin/metrics"
        className="inline-flex items-center gap-1 text-xs text-antique-accent hover:text-antique-accent-h font-medium transition-colors">
        Raw metrics JSON <ChevronRight className="w-3 h-3" />
      </Link>

    </div>
  );
}
