/**
 * Admin / Operations Dashboard
 * ─────────────────────────────
 * Serves as the owner's command centre: live data stats, phased setup
 * checklist, and quick links to every external service.
 *
 * Navigate to /admin to view. No authentication yet — keep URL private.
 */
import Link from "next/link";
import {
  Package, TrendingUp, Clock, Calendar, AlertCircle,
  CheckCircle, RefreshCw, ExternalLink, BarChart3, Tag,
  Database, Key, Zap, DollarSign, Globe, ChevronRight,
  GitBranch, Server, Bot, CreditCard, Megaphone,
} from "lucide-react";
import { getListings } from "@/lib/scraped-data";

export const dynamic = "force-dynamic";

// ── Tiny layout helpers ────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon: Icon, color,
}: {
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

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="w-full bg-antique-subtle rounded-full h-1.5 mt-1.5">
      <div className={`${color} h-1.5 rounded-full`} style={{ width: `${Math.max(pct, 2)}%` }} />
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

// ── Setup step card ────────────────────────────────────────────────────────────

type StepStatus = "done" | "pending" | "optional";

function SetupStep({
  status, title, desc, href, linkLabel, children,
}: {
  status: StepStatus;
  title: string;
  desc: string;
  href?: string;
  linkLabel?: string;
  children?: React.ReactNode;
}) {
  const dot =
    status === "done"
      ? "bg-green-500"
      : status === "pending"
      ? "bg-amber-400"
      : "bg-antique-border";

  return (
    <div className="flex gap-4 pb-5 border-b border-antique-border last:border-0 last:pb-0">
      <div className="flex-shrink-0 mt-0.5">
        <span className={`inline-block w-2.5 h-2.5 rounded-full ${dot}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm font-semibold text-antique-text">{title}</p>
          {status === "done" && (
            <span className="text-xs text-green-600 font-medium">Complete</span>
          )}
          {status === "optional" && (
            <span className="text-xs text-antique-text-mute">Optional</span>
          )}
        </div>
        <p className="text-xs text-antique-text-sec mt-0.5 leading-relaxed">{desc}</p>
        {children && (
          <div className="mt-2 bg-antique-muted rounded-lg p-3 text-xs text-antique-text-sec space-y-1 leading-relaxed">
            {children}
          </div>
        )}
        {href && linkLabel && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-2 text-xs text-antique-accent hover:text-antique-accent-h font-medium transition-colors"
          >
            {linkLabel}
            <ChevronRight className="w-3 h-3" />
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
  let withImage = 0, withLocation = 0, withPrice = 0, withCategory = 0;
  const platformCounts: Record<string, { display_name: string; count: number }> = {};
  const categoryCounts: Record<string, number> = {};
  let latestScrapedAt: string | null = null;

  for (const l of all) {
    const starts = l.sale_starts_at ? new Date(l.sale_starts_at).getTime() : null;
    const ends   = l.sale_ends_at   ? new Date(l.sale_ends_at).getTime()   : null;

    if (l.is_completed)                             ended++;
    else if (starts !== null && starts > now)       upcoming++;
    else if (ends   !== null && ends   < now)       ended++;
    else {
      if (ends !== null && ends - now < 86_400_000) endingSoon++;
      live++;
    }

    if (l.primary_image_url)             withImage++;
    if (l.city || l.state || l.zip_code) withLocation++;
    if (l.current_price !== null)        withPrice++;
    if (l.category) {
      withCategory++;
      categoryCounts[l.category] = (categoryCounts[l.category] ?? 0) + 1;
    }

    const pName = l.platform.name;
    if (!platformCounts[pName]) platformCounts[pName] = { display_name: l.platform.display_name, count: 0 };
    platformCounts[pName].count++;

    if (l.scraped_at && (!latestScrapedAt || l.scraped_at > latestScrapedAt)) {
      latestScrapedAt = l.scraped_at;
    }
  }

  const byPlatform = Object.entries(platformCounts)
    .sort(([, a], [, b]) => b.count - a.count)
    .map(([, d]) => ({ name: d.display_name, count: d.count, pct: total ? Math.round((d.count / total) * 100) : 0 }));

  const byCategory = Object.entries(categoryCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([name, count]) => ({ name, count, pct: total ? Math.round((count / total) * 100) : 0 }));

  const maxCat = byCategory[0]?.count ?? 1;

  let dataAgeLabel = "Unknown";
  if (latestScrapedAt) {
    const h = Math.floor((now - new Date(latestScrapedAt).getTime()) / 3_600_000);
    dataAgeLabel = h < 1 ? "< 1 hour ago" : h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
        <div>
          <p className="text-antique-accent font-display text-xs tracking-[0.2em] uppercase mb-1">
            Operations
          </p>
          <h1 className="font-display text-2xl font-bold text-antique-text flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-antique-accent" />
            Admin Dashboard
          </h1>
          <p className="text-sm text-antique-text-mute mt-1">
            Data last refreshed: <span className="font-medium text-antique-text-sec">{dataAgeLabel}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="https://github.com/SpanglyAtol/estate-scout/actions"
            target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm bg-antique-text text-antique-bg px-4 py-2 rounded-lg hover:opacity-80 transition-opacity"
          >
            <RefreshCw className="w-4 h-4" />
            Run Scraper
          </a>
          <a
            href="https://vercel.com/dashboard"
            target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm antique-card px-4 py-2 rounded-lg hover:border-antique-accent transition-colors"
          >
            <ExternalLink className="w-4 h-4 text-antique-text-sec" />
            Vercel
          </a>
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        <StatCard label="Total"       value={total}             icon={Package}    color="text-antique-accent" />
        <StatCard label="Live"        value={live}              icon={TrendingUp} color="text-green-500" />
        <StatCard label="Upcoming"    value={upcoming}          icon={Calendar}   color="text-blue-400" />
        <StatCard label="Ending Soon" value={endingSoon}        icon={Clock}      color="text-red-500" />
        <StatCard label="Ended"       value={ended}             icon={AlertCircle} color="text-antique-text-mute" />
        <StatCard label="Platforms"   value={byPlatform.length} icon={Globe}      color="text-purple-500" />
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SETUP CHECKLIST
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="mb-8">
        <div className="ornament-divider mb-6 text-xs text-antique-text-mute tracking-widest uppercase">
          Setup Checklist
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── Phase 1: Auto Scraping ── */}
          <div className="antique-card p-6">
            <SectionTitle icon={GitBranch}>
              Phase 1 — Automated Data Refresh
            </SectionTitle>
            <p className="text-xs text-antique-text-mute mb-5 leading-relaxed">
              The GitHub Actions workflow already exists and runs daily at 6 AM UTC.
              It just needs 3 secrets added to your GitHub repository.
            </p>
            <div className="space-y-5">
              <SetupStep
                status="done"
                title="GitHub Actions workflow"
                desc="refresh-listings.yml is committed and ready — runs daily + on-demand."
              />
              <SetupStep
                status="pending"
                title="Add VERCEL_TOKEN secret"
                desc="Allows the workflow to deploy to Vercel after each scrape."
                href="https://vercel.com/account/tokens"
                linkLabel="Get token at vercel.com/account/tokens"
              >
                <p>1. Go to <strong>vercel.com/account/tokens</strong> → Create token</p>
                <p>2. Copy the token</p>
                <p>3. Go to <strong>GitHub repo → Settings → Secrets → Actions</strong></p>
                <p>4. Add secret named <code className="bg-antique-subtle px-1 rounded">VERCEL_TOKEN</code></p>
              </SetupStep>
              <SetupStep
                status="pending"
                title="Add VERCEL_ORG_ID + VERCEL_PROJECT_ID secrets"
                desc="Tells the workflow which Vercel project to deploy."
                href="https://vercel.com/dashboard"
                linkLabel="Find IDs in Vercel project settings"
              >
                <p>1. Go to <strong>Vercel Dashboard → your project → Settings → General</strong></p>
                <p>2. Copy <strong>Project ID</strong> → GitHub secret: <code className="bg-antique-subtle px-1 rounded">VERCEL_PROJECT_ID</code></p>
                <p>3. Go to <strong>Vercel → Team Settings → General</strong></p>
                <p>4. Copy <strong>Team ID</strong> → GitHub secret: <code className="bg-antique-subtle px-1 rounded">VERCEL_ORG_ID</code></p>
                <p className="mt-1 text-antique-text-mute">Once done: scraper runs every morning and auto-deploys fresh data.</p>
              </SetupStep>
            </div>
          </div>

          {/* ── Phase 2: AI Features ── */}
          <div className="antique-card p-6">
            <SectionTitle icon={Bot}>
              Phase 2 — AI Valuation &amp; Chatbot
            </SectionTitle>
            <p className="text-xs text-antique-text-mute mb-5 leading-relaxed">
              The AI valuation and chatbot code is complete. It currently returns
              template responses. Add an OpenAI key to make it fully intelligent.
            </p>
            <div className="space-y-5">
              <SetupStep
                status="pending"
                title="Get OpenAI API key"
                desc="Powers AI price estimates, narrative valuations, and chatbot conversations."
                href="https://platform.openai.com/api-keys"
                linkLabel="Create key at platform.openai.com"
              >
                <p>1. Sign in at <strong>platform.openai.com</strong></p>
                <p>2. Go to <strong>API Keys → Create new secret key</strong></p>
                <p>3. Add $5–20 credit (more than enough to start)</p>
                <p>4. Go to <strong>Vercel → Project → Settings → Environment Variables</strong></p>
                <p>5. Add: <code className="bg-antique-subtle px-1 rounded">OPENAI_API_KEY</code> = your key</p>
                <p className="mt-1 text-antique-text-mute">Uses GPT-4o-mini (~$0.15/1M tokens — very cheap).</p>
              </SetupStep>
              <SetupStep
                status="optional"
                title="Anthropic API key (Claude)"
                desc="Alternative AI provider for chatbot responses if you prefer Claude over GPT."
                href="https://console.anthropic.com/"
                linkLabel="console.anthropic.com"
              >
                <p>Add <code className="bg-antique-subtle px-1 rounded">ANTHROPIC_API_KEY</code> to Vercel env vars if preferred over OpenAI.</p>
              </SetupStep>
            </div>
          </div>

          {/* ── Phase 3: Real Database ── */}
          <div className="antique-card p-6">
            <SectionTitle icon={Database}>
              Phase 3 — Persistent Database
            </SectionTitle>
            <p className="text-xs text-antique-text-mute mb-5 leading-relaxed">
              Currently user accounts, saved searches, and price alerts are stored
              in browser localStorage. A real PostgreSQL database enables proper
              user accounts and scales to 9M+ listings.
            </p>
            <div className="space-y-5">
              <SetupStep
                status="pending"
                title="Create Supabase project (free)"
                desc="Managed PostgreSQL + pgvector. Free tier: 500MB, up to 50K monthly active users."
                href="https://supabase.com/dashboard/new/default-org"
                linkLabel="Create project at supabase.com"
              >
                <p>1. Sign in at <strong>supabase.com</strong> → New project</p>
                <p>2. Name it <em>estate-scout</em>, choose a region near your users</p>
                <p>3. Go to <strong>Project Settings → Database → Connection string (URI)</strong></p>
                <p>4. Copy the string — add to Vercel as <code className="bg-antique-subtle px-1 rounded">DATABASE_URL</code></p>
                <p className="mt-1 text-antique-text-mute">Supports 9M+ listings with the included pgvector extension.</p>
              </SetupStep>
              <SetupStep
                status="pending"
                title="Deploy FastAPI backend to Railway"
                desc="Enables real-time search, user auth, saved searches, and price alerts."
                href="https://railway.app/new"
                linkLabel="Deploy at railway.app"
              >
                <p>1. Sign in at <strong>railway.app</strong> → New project → Deploy from GitHub</p>
                <p>2. Select <em>estate-scout</em> repo → Service: <code className="bg-antique-subtle px-1 rounded">backend/</code></p>
                <p>3. Add environment variables from <code className="bg-antique-subtle px-1 rounded">.env.example</code></p>
                <p>4. Copy the Railway URL → add to Vercel as <code className="bg-antique-subtle px-1 rounded">NEXT_PUBLIC_API_URL</code></p>
                <p className="mt-1 text-antique-text-mute">Free tier: $5/month credit — enough for early traffic.</p>
              </SetupStep>
            </div>
          </div>

          {/* ── Phase 4: Monetization ── */}
          <div className="antique-card p-6">
            <SectionTitle icon={DollarSign}>
              Phase 4 — Monetization
            </SectionTitle>
            <p className="text-xs text-antique-text-mute mb-5 leading-relaxed">
              Three revenue streams are already wired in the code. Each just needs
              an account and the corresponding environment variable.
            </p>
            <div className="space-y-5">
              <SetupStep
                status="pending"
                title="Google AdSense"
                desc="Display ads shown to free-tier users. Passive income once traffic grows."
                href="https://adsense.google.com/start/"
                linkLabel="Apply at adsense.google.com"
              >
                <p>1. Apply at <strong>adsense.google.com</strong> (needs ~3 months of traffic)</p>
                <p>2. Once approved, get your Publisher ID (ca-pub-XXXXXXXXXXXXXXXX)</p>
                <p>3. Add to Vercel: <code className="bg-antique-subtle px-1 rounded">NEXT_PUBLIC_GOOGLE_ADSENSE_ID</code></p>
              </SetupStep>
              <SetupStep
                status="pending"
                title="Amazon Associates"
                desc="Earn commission when users click antique-related Amazon product links."
                href="https://affiliate-program.amazon.com/"
                linkLabel="affiliate-program.amazon.com"
              >
                <p>1. Sign up and get your Associates tag (yoursite-20)</p>
                <p>2. Add to Vercel: <code className="bg-antique-subtle px-1 rounded">NEXT_PUBLIC_AMAZON_ASSOCIATES_TAG</code></p>
              </SetupStep>
              <SetupStep
                status="pending"
                title="Stripe — Pro &amp; Premium subscriptions"
                desc="$19/mo Pro and $79/mo Premium tiers. Stripe code is fully implemented."
                href="https://dashboard.stripe.com/register"
                linkLabel="dashboard.stripe.com"
              >
                <p>1. Create account → Get publishable + secret keys</p>
                <p>2. Create two products: <em>Pro ($19)</em> and <em>Premium ($79)</em></p>
                <p>3. Add to Vercel: <code className="bg-antique-subtle px-1 rounded">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code>, <code className="bg-antique-subtle px-1 rounded">STRIPE_SECRET_KEY</code>, <code className="bg-antique-subtle px-1 rounded">STRIPE_PRO_PRICE_ID</code></p>
                <p>4. Add to Railway: same vars + <code className="bg-antique-subtle px-1 rounded">STRIPE_WEBHOOK_SECRET</code></p>
              </SetupStep>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          PRODUCT ROADMAP
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="mb-8">
        <div className="ornament-divider mb-6 text-xs text-antique-text-mute tracking-widest uppercase">
          Product Roadmap
        </div>

        <div className="antique-card p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">

            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                <span className="text-xs font-bold text-antique-text uppercase tracking-wide">Done</span>
              </div>
              <ul className="space-y-2 text-xs text-antique-text-sec">
                {[
                  "Classical antique theme (light + dark)",
                  "Homepage sections (items / auctions / estate sales)",
                  "Search with filters (price, category, location, date)",
                  "Listing detail pages",
                  "AI valuation chatbot (template mode)",
                  "User catalog with AI analysis",
                  "Map view (ZIP + near me)",
                  "Chatbot widget",
                  "Saved searches (localStorage)",
                  "Pricing page",
                  "Daily scraper workflow (GitHub Actions)",
                  "BidSpotter, HiBid, MaxSold, EstateSales.NET scrapers",
                  "Data classification (item_type / listing_type)",
                  "Relevance filter (US-only, no industrial)",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-1.5">
                    <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
                <span className="text-xs font-bold text-antique-text uppercase tracking-wide">Next Up</span>
              </div>
              <ul className="space-y-2 text-xs text-antique-text-sec">
                {[
                  "GitHub Actions secrets → live daily scraping",
                  "OpenAI key → real AI valuations",
                  "Supabase database → real user accounts",
                  "Railway backend → live search API",
                  "LiveAuctioneers scraper (currently 403 blocked)",
                  "Google AdSense integration",
                  "Stripe subscription checkout",
                  "Email price alerts (SendGrid)",
                  "More estate sale states (currently WA-heavy)",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-1.5">
                    <Clock className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-block w-2 h-2 rounded-full bg-blue-400" />
                <span className="text-xs font-bold text-antique-text uppercase tracking-wide">Planned</span>
              </div>
              <ul className="space-y-2 text-xs text-antique-text-sec">
                {[
                  "eBay sold listings scraper",
                  "1stDibs scraper",
                  "Proxibid scraper",
                  "Image-based AI identification (GPT-4o Vision)",
                  "Historical price charts per category",
                  "Dealer / consignment accounts",
                  "Sponsored listing placements",
                  "Mobile app (Expo / React Native)",
                  "Embed widget for external auction sites",
                  "Browser extension for price checking",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-1.5">
                    <Calendar className="w-3 h-3 text-blue-400 flex-shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-block w-2 h-2 rounded-full bg-purple-400" />
                <span className="text-xs font-bold text-antique-text uppercase tracking-wide">End Goal</span>
              </div>
              <ul className="space-y-2 text-xs text-antique-text-sec">
                {[
                  "Shipping carrier selection (USPS, UPS, FedEx)",
                  "Cross-list items to eBay, Etsy, 1stDibs from catalog",
                  "Automated price re-evaluation as market shifts",
                  "Auction house white-label dashboard",
                  "API access tier for dealers ($79/mo)",
                  "9M+ listing database with vector search",
                  "AI-powered lot description generation",
                  "Buyer + seller matching engine",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-1.5">
                    <Zap className="w-3 h-3 text-purple-400 flex-shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          DATA STATS
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="ornament-divider mb-6 text-xs text-antique-text-mute tracking-widest uppercase">
        Current Data
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

        {/* Platform breakdown */}
        <div className="antique-card p-6">
          <SectionTitle icon={Tag}>Platform Breakdown</SectionTitle>
          <div className="space-y-4">
            {byPlatform.map(({ name, count, pct }) => (
              <div key={name}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-antique-text">{name}</span>
                  <span className="text-antique-text-mute tabular-nums">
                    {count.toLocaleString()} <span className="opacity-60">({pct}%)</span>
                  </span>
                </div>
                <Bar pct={pct} color="bg-antique-accent" />
              </div>
            ))}
          </div>
        </div>

        {/* Data quality */}
        <div className="antique-card p-6">
          <SectionTitle icon={CheckCircle}>Data Quality</SectionTitle>
          <div className="space-y-4">
            {[
              { label: "With image",    count: withImage,    pct: total ? Math.round((withImage    / total) * 100) : 0 },
              { label: "With location", count: withLocation, pct: total ? Math.round((withLocation / total) * 100) : 0 },
              { label: "With price",    count: withPrice,    pct: total ? Math.round((withPrice    / total) * 100) : 0 },
              { label: "Categorized",   count: withCategory, pct: total ? Math.round((withCategory / total) * 100) : 0 },
            ].map(({ label, count, pct }) => (
              <div key={label}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-antique-text">{label}</span>
                  <span className="font-semibold text-antique-text tabular-nums">
                    {pct}% <span className="font-normal text-antique-text-mute">({count.toLocaleString()})</span>
                  </span>
                </div>
                <Bar
                  pct={pct}
                  color={pct >= 75 ? "bg-green-500" : pct >= 40 ? "bg-amber-400" : "bg-red-400"}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Category distribution */}
      {byCategory.length > 0 && (
        <div className="antique-card p-6 mb-6">
          <SectionTitle icon={BarChart3}>Category Distribution</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-3">
            {byCategory.map(({ name, count }) => (
              <div key={name}>
                <div className="flex items-center justify-between text-sm">
                  <span className="capitalize font-medium text-antique-text">{name}</span>
                  <span className="text-antique-text-mute tabular-nums">{count.toLocaleString()}</span>
                </div>
                <Bar pct={Math.round((count / maxCat) * 100)} color="bg-purple-400" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Quick links ── */}
      <div className="ornament-divider mb-6 text-xs text-antique-text-mute tracking-widest uppercase">
        Quick Links
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {[
          { icon: GitBranch, label: "GitHub Actions",  sub: "Trigger scraper",       href: "https://github.com/SpanglyAtol/estate-scout/actions" },
          { icon: Server,    label: "Vercel",          sub: "Deployments + env vars", href: "https://vercel.com/dashboard" },
          { icon: Database,  label: "Supabase",        sub: "Database setup",         href: "https://supabase.com/dashboard" },
          { icon: Bot,       label: "OpenAI",          sub: "API keys + billing",     href: "https://platform.openai.com/api-keys" },
          { icon: CreditCard,label: "Stripe",          sub: "Subscriptions",          href: "https://dashboard.stripe.com/" },
          { icon: Megaphone, label: "AdSense",         sub: "Ad revenue",             href: "https://adsense.google.com/" },
        ].map(({ icon: Icon, label, sub, href }) => (
          <a
            key={label}
            href={href}
            target="_blank" rel="noopener noreferrer"
            className="antique-card p-4 hover:border-antique-accent transition-colors group"
          >
            <Icon className="w-5 h-5 text-antique-accent mb-2" />
            <div className="text-xs font-semibold text-antique-text group-hover:text-antique-accent transition-colors">{label}</div>
            <div className="text-xs text-antique-text-mute mt-0.5">{sub}</div>
          </a>
        ))}
      </div>

      {/* ── Scraper notes ── */}
      <div className="antique-card-warm p-5 border border-antique-border rounded-xl text-sm">
        <p className="font-semibold text-antique-text mb-2 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-antique-accent" />
          Scraper Notes
        </p>
        <ul className="space-y-1 text-xs text-antique-text-sec list-disc list-inside">
          <li>BidSpotter — JSON-LD, 17 pages, US-wide (~960 listings after relevance filter)</li>
          <li>HiBid — GraphQL API, US-wide, auto-paginates (~670 listings)</li>
          <li>EstateSales.NET — JSON-LD, 10 states × 2 pages (~8 estate sales)</li>
          <li>MaxSold — HTML + JSON, WA state only (~3 auctions)</li>
          <li>LiveAuctioneers — blocked (403) — excluded until proxy solution found</li>
        </ul>
        <p className="mt-3 text-xs text-antique-text-mute">
          Refresh manually:{" "}
          <code className="bg-antique-subtle px-1.5 py-0.5 rounded font-mono">
            python backend/scrapers/hydrate.py --targets ms,bs,hi,es --max-pages 17
          </code>
        </p>
        <div className="mt-3 flex gap-2">
          <Link
            href="/api/v1/admin/metrics"
            className="inline-flex items-center gap-1 text-xs text-antique-accent hover:text-antique-accent-h font-medium transition-colors"
          >
            Raw metrics JSON <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

    </div>
  );
}
