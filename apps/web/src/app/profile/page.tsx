"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  User, Bell, BellOff, Link2, Link2Off, ExternalLink,
  RefreshCw, Loader2, CheckCircle2, AlertCircle, BookMarked,
  ChevronDown, ChevronUp, Search,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  PLATFORM_CONFIGS,
  getConnectedAccounts,
  connectAccount,
  disconnectAccount,
  updateAccount,
  type ConnectedAccount,
  type PlatformConfig,
} from "@/lib/connected-accounts";
import type { AdminMetrics } from "@/app/api/v1/admin/metrics/route";

// ── Auth prompt ───────────────────────────────────────────────────────────────

function AuthPrompt() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-2xl text-center">
      <div className="text-6xl mb-6">🔗</div>
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Connected Accounts</h1>
      <p className="text-gray-600 mb-8 max-w-md mx-auto">
        Link your BidSpotter, HiBid, MaxSold and other accounts to see all your
        watchlisted items in one place and get unified notifications.
      </p>
      <div className="flex gap-3 justify-center">
        <Link
          href="/auth?mode=register"
          className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
        >
          Sign Up Free
        </Link>
        <Link
          href="/auth"
          className="bg-white border border-gray-300 text-gray-700 px-6 py-3 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
        >
          Sign In
        </Link>
      </div>
    </div>
  );
}

// ── Platform card ─────────────────────────────────────────────────────────────

interface PlatformCardProps {
  config: PlatformConfig;
  account: ConnectedAccount | null;
  listingCount: number;
  onConnect: (platformId: number, username: string, opts: { notify_new_lots: boolean; notify_ending_soon: boolean }) => void;
  onDisconnect: (platformId: number) => void;
  onToggleNotify: (platformId: number, field: "notify_new_lots" | "notify_ending_soon", value: boolean) => void;
  onSync: (platformId: number) => void;
  isSyncing: boolean;
}

function PlatformCard({
  config, account, listingCount,
  onConnect, onDisconnect, onToggleNotify, onSync, isSyncing,
}: PlatformCardProps) {
  const [expanded, setExpanded]       = useState(false);
  const [username, setUsername]       = useState("");
  const [notifyLots, setNotifyLots]   = useState(true);
  const [notifyEnd, setNotifyEnd]     = useState(true);
  const [justSynced, setJustSynced]   = useState(false);

  function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim()) return;
    onConnect(config.id, username.trim(), { notify_new_lots: notifyLots, notify_ending_soon: notifyEnd });
    setUsername("");
    setExpanded(false);
  }

  function handleSync() {
    onSync(config.id);
    setJustSynced(true);
    setTimeout(() => setJustSynced(false), 3000);
  }

  const searchUrl = `/search?platform_ids=${config.id}`;

  return (
    <div className={`bg-white border rounded-2xl overflow-hidden transition-all ${
      account ? "border-blue-200 shadow-sm" : "border-gray-200"
    }`}>
      {/* Card header */}
      <div className="p-5">
        <div className="flex items-start gap-3">
          {/* Platform icon */}
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${config.color_class}`}>
            {config.emoji}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-gray-900">{config.display_name}</h3>
              {account ? (
                <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-medium">
                  <CheckCircle2 className="w-3 h-3" /> Connected
                </span>
              ) : (
                <span className="text-xs text-gray-400">Not connected</span>
              )}
            </div>

            {account ? (
              <p className="text-sm text-gray-600 mt-0.5">
                <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-xs">{account.username}</span>
              </p>
            ) : (
              <p className="text-xs text-gray-500 mt-0.5">{config.connect_hint}</p>
            )}
          </div>

          {/* Expand toggle */}
          <button
            onClick={() => setExpanded((e) => !e)}
            className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0 mt-0.5"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
          <Link href={searchUrl} className="flex items-center gap-1 hover:text-blue-600 transition-colors">
            <Search className="w-3 h-3" />
            {listingCount.toLocaleString()} listings on Estate Scout
          </Link>
          {account?.last_synced_at && (
            <span>Synced {new Date(account.last_synced_at).toLocaleDateString()}</span>
          )}
        </div>
      </div>

      {/* Expanded section */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 p-5">
          {account ? (
            /* ── Connected state ── */
            <div className="space-y-4">
              {/* Notification toggles */}
              <div>
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                  Notifications
                </p>
                <div className="space-y-2">
                  {[
                    { key: "notify_new_lots" as const, label: "Alert me when new listings appear from this platform", value: account.notify_new_lots },
                    { key: "notify_ending_soon" as const, label: "Alert me when tracked items are ending soon (< 24h)", value: account.notify_ending_soon },
                  ].map(({ key, label, value }) => (
                    <label key={key} className="flex items-start gap-2.5 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={value}
                        onChange={(e) => onToggleNotify(config.id, key, e.target.checked)}
                        className="mt-0.5 accent-blue-600"
                      />
                      <span className="text-sm text-gray-700 group-hover:text-blue-600 transition-colors leading-snug">
                        {label}
                      </span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                  <Bell className="w-3 h-3" />
                  Email delivery coming soon — configure in{" "}
                  <Link href="/saved" className="underline hover:text-amber-800">Saved Searches &amp; Alerts</Link>
                </p>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  onClick={handleSync}
                  disabled={isSyncing}
                  className="inline-flex items-center gap-1.5 text-xs bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg hover:border-blue-300 hover:text-blue-600 transition-colors disabled:opacity-50"
                >
                  {isSyncing
                    ? <><Loader2 className="w-3 h-3 animate-spin" /> Syncing…</>
                    : justSynced
                    ? <><CheckCircle2 className="w-3 h-3 text-green-500" /> Synced!</>
                    : <><RefreshCw className="w-3 h-3" /> Sync now</>
                  }
                </button>

                <a
                  href={`${config.account_url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg hover:border-blue-300 hover:text-blue-600 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  Open {config.display_name}
                </a>

                <button
                  onClick={() => onDisconnect(config.id)}
                  className="inline-flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 px-3 py-1.5 transition-colors"
                >
                  <Link2Off className="w-3 h-3" />
                  Disconnect
                </button>
              </div>
            </div>
          ) : (
            /* ── Connect form ── */
            <form onSubmit={handleConnect} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1.5">
                  Your {config.display_name} username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={`e.g. john_collector`}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                />
                <p className="text-xs text-gray-400 mt-1">
                  We&apos;ll cross-reference your username to highlight matching listings on Estate Scout.
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Notifications</p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={notifyLots} onChange={(e) => setNotifyLots(e.target.checked)} className="accent-blue-600" />
                  <span className="text-sm text-gray-700">Notify me when new listings appear from {config.display_name}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={notifyEnd} onChange={(e) => setNotifyEnd(e.target.checked)} className="accent-blue-600" />
                  <span className="text-sm text-gray-700">Alert me when items are ending soon (within 24h)</span>
                </label>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Link2 className="w-4 h-4" /> Connect account
                </button>
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>

              <div className="pt-1 border-t border-gray-200">
                <a
                  href={config.account_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  Find my {config.display_name} username →
                </a>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [syncingPlatformId, setSyncingPlatformId] = useState<number | null>(null);

  // Load connected accounts from localStorage on mount (client-only)
  useEffect(() => {
    setAccounts(getConnectedAccounts());
  }, []);

  // Admin metrics — used to show listing counts per platform
  const { data: metrics } = useQuery<AdminMetrics>({
    queryKey: ["admin-metrics"],
    queryFn:  () => fetch("/api/v1/admin/metrics").then((r) => r.json()),
    staleTime: 60_000,
  });

  function getListingCount(platformId: number): number {
    const config = PLATFORM_CONFIGS.find((p) => p.id === platformId);
    if (!config || !metrics) return 0;
    return metrics.by_platform.find((p) => p.display_name === config.display_name)?.count ?? 0;
  }

  function handleConnect(
    platformId: number,
    username: string,
    opts: { notify_new_lots: boolean; notify_ending_soon: boolean }
  ) {
    const acc = connectAccount(platformId, username, opts);
    setAccounts((prev) => [...prev.filter((a) => a.platform_id !== platformId), acc]);
  }

  function handleDisconnect(platformId: number) {
    disconnectAccount(platformId);
    setAccounts((prev) => prev.filter((a) => a.platform_id !== platformId));
  }

  function handleToggleNotify(
    platformId: number,
    field: "notify_new_lots" | "notify_ending_soon",
    value: boolean
  ) {
    updateAccount(platformId, { [field]: value });
    setAccounts((prev) =>
      prev.map((a) => (a.platform_id === platformId ? { ...a, [field]: value } : a))
    );
  }

  async function handleSync(platformId: number) {
    setSyncingPlatformId(platformId);
    const count = getListingCount(platformId);
    // Simulate sync latency (real implementation would call platform API)
    await new Promise((r) => setTimeout(r, 1200));
    const now = new Date().toISOString();
    updateAccount(platformId, { last_synced_at: now, cached_listing_count: count });
    setAccounts((prev) =>
      prev.map((a) =>
        a.platform_id === platformId
          ? { ...a, last_synced_at: now, cached_listing_count: count }
          : a
      )
    );
    setSyncingPlatformId(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!user) return <AuthPrompt />;

  const connectedCount = accounts.length;
  const initials = (user.display_name ?? user.email)
    .split(/\s|@/)[0]
    .slice(0, 2)
    .toUpperCase();
  const memberSince = new Date(user.created_at ?? Date.now()).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">

      {/* ── Profile header ── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-8 flex flex-col sm:flex-row gap-5 items-start sm:items-center">
        {/* Avatar */}
        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
          {initials}
        </div>

        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{user.display_name ?? user.email}</h1>
          <p className="text-sm text-gray-500">{user.email}</p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${
              user.tier === "pro"     ? "bg-blue-100 text-blue-700"
              : user.tier === "premium" ? "bg-purple-100 text-purple-700"
              : "bg-gray-100 text-gray-600"
            }`}>
              {user.tier} plan
            </span>
            <span className="text-xs text-gray-400">Member since {memberSince}</span>
          </div>
        </div>

        {/* Quick stats */}
        <div className="flex gap-5 sm:gap-8 text-center">
          {[
            { label: "Platforms",   value: connectedCount },
            { label: "Listing pool",value: metrics ? metrics.total.toLocaleString() : "…" },
          ].map(({ label, value }) => (
            <div key={label}>
              <div className="text-2xl font-bold text-gray-900">{value}</div>
              <div className="text-xs text-gray-500">{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* ── Connected platforms (main) ── */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Link2 className="w-5 h-5 text-blue-500" />
              Connected Platforms
            </h2>
            <span className="text-sm text-gray-500">
              {connectedCount}/{PLATFORM_CONFIGS.length} connected
            </span>
          </div>

          {connectedCount === 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-sm text-blue-700 mb-2">
              <p className="font-semibold mb-1">Connect your auction accounts</p>
              <p className="text-blue-600">
                Link your accounts to track your watchlisted items across all platforms in one place
                and receive unified notifications when items are ending soon.
              </p>
            </div>
          )}

          {PLATFORM_CONFIGS.map((config) => (
            <PlatformCard
              key={config.id}
              config={config}
              account={accounts.find((a) => a.platform_id === config.id) ?? null}
              listingCount={getListingCount(config.id)}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              onToggleNotify={handleToggleNotify}
              onSync={handleSync}
              isSyncing={syncingPlatformId === config.id}
            />
          ))}
        </div>

        {/* ── Sidebar ── */}
        <div className="space-y-5">

          {/* How it works */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2 text-sm">
              <AlertCircle className="w-4 h-4 text-blue-500" />
              How connected accounts work
            </h3>
            <ol className="space-y-3 text-sm text-gray-600 list-none">
              {[
                { n: "1", text: "Enter your username from each platform you use for bidding" },
                { n: "2", text: "Estate Scout cross-references our scraped listings against your connected platforms" },
                { n: "3", text: "Enable notifications to get alerts when new matching listings appear" },
                { n: "4", text: "Click 'Open [Platform]' to jump directly to your watchlist on any site" },
              ].map(({ n, text }) => (
                <li key={n} className="flex gap-3">
                  <span className="flex-shrink-0 w-5 h-5 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">
                    {n}
                  </span>
                  <span>{text}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Quick links */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
            <h3 className="font-bold text-gray-900 text-sm mb-1">Quick links</h3>
            {[
              { href: "/search",  icon: Search,     label: "Browse all listings",    sub: `${metrics?.total.toLocaleString() ?? "…"} available` },
              { href: "/saved",   icon: BookMarked, label: "Saved searches & alerts", sub: "Manage your notifications" },
              { href: "/valuation", icon: User,     label: "AI price check",          sub: "Check item values" },
            ].map(({ href, icon: Icon, label, sub }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 py-2 hover:text-blue-600 transition-colors group"
              >
                <Icon className="w-4 h-4 text-gray-400 group-hover:text-blue-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-800 group-hover:text-blue-600">{label}</p>
                  <p className="text-xs text-gray-400">{sub}</p>
                </div>
              </Link>
            ))}
          </div>

          {/* Coming soon */}
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
            <h3 className="font-bold text-amber-800 text-sm mb-2 flex items-center gap-1.5">
              <Bell className="w-4 h-4" /> Coming soon
            </h3>
            <ul className="text-xs text-amber-700 space-y-1.5">
              <li>📧 Email notifications for connected platforms</li>
              <li>🔄 Auto-import your watchlists from each platform</li>
              <li>📱 Push notifications (mobile app)</li>
              <li>🤝 OAuth login with LiveAuctioneers / HiBid</li>
              <li>⭐ Bid tracking &amp; winning bid history</li>
            </ul>
          </div>

          {/* Notification status */}
          {connectedCount > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <h3 className="font-bold text-gray-900 text-sm mb-3 flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-500" />
                Notification summary
              </h3>
              <div className="space-y-2">
                {accounts.map((acc) => {
                  const config = PLATFORM_CONFIGS.find((p) => p.id === acc.platform_id)!;
                  const hasAny  = acc.notify_new_lots || acc.notify_ending_soon;
                  return (
                    <div key={acc.id} className="flex items-center gap-2 text-sm">
                      <span>{config?.emoji}</span>
                      <span className="flex-1 text-gray-700">{config?.display_name}</span>
                      {hasAny
                        ? <Bell    className="w-3.5 h-3.5 text-green-500" />
                        : <BellOff className="w-3.5 h-3.5 text-gray-300" />}
                    </div>
                  );
                })}
              </div>
              <Link
                href="/saved"
                className="mt-3 block text-xs text-blue-600 hover:underline"
              >
                Manage all alerts →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
