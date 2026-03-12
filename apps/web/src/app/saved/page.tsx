"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BookMarked, Bell, Trash2, ToggleLeft,
  ToggleRight, Plus, Loader2, Bookmark, ExternalLink, Clock,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  getSavedSearches, createSavedSearch, deleteSavedSearch,
  getAlerts, createAlert, toggleAlert, deleteAlert,
  type SavedSearch, type AlertItem,
} from "@/lib/api-client";
import { getWatchlist, removeFromWatchlist, type WatchItem } from "@/lib/watchlist";
import { formatPrice, timeUntil } from "@/lib/format";

// ── Unauthenticated splash ────────────────────────────────────────────────────

function AuthPrompt() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-2xl text-center">
      <div className="w-16 h-16 rounded-full bg-antique-muted flex items-center justify-center mx-auto mb-6">
        <Bell className="w-7 h-7 text-antique-accent" />
      </div>
      <h1 className="font-display text-3xl font-bold text-antique-text mb-3">
        Saved Searches &amp; Alerts
      </h1>
      <p className="text-antique-text-sec text-base mb-8 max-w-md mx-auto">
        Save searches and get notified the moment a matching item appears across
        all auction platforms.
      </p>
      <div className="flex gap-3 justify-center">
        <Link
          href="/auth?mode=register"
          className="bg-antique-accent text-white px-6 py-3 rounded-lg font-semibold hover:bg-antique-accent-hover transition-colors text-sm"
        >
          Create Account
        </Link>
        <Link
          href="/auth"
          className="bg-antique-surface border border-antique-border text-antique-text px-6 py-3 rounded-lg font-semibold hover:bg-antique-muted transition-colors text-sm"
        >
          Sign In
        </Link>
      </div>
    </div>
  );
}

// ── Input helper ──────────────────────────────────────────────────────────────

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full border border-antique-border rounded-lg px-3 py-2 text-sm bg-antique-surface text-antique-text placeholder-antique-text-mute focus:ring-2 focus:ring-antique-accent/40 focus:border-antique-accent outline-none transition"
    />
  );
}

// ── Watchlist panel ───────────────────────────────────────────────────────────

function WatchlistPanel() {
  const [items, setItems] = useState<WatchItem[]>([]);

  useEffect(() => {
    setItems(getWatchlist());
  }, []);

  function handleRemove(id: number) {
    removeFromWatchlist(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div className="bg-antique-surface border border-antique-border rounded-xl p-6">
      <h2 className="font-display font-semibold text-antique-text flex items-center gap-2 mb-5">
        <Bookmark className="w-4 h-4 text-antique-accent" />
        Watchlist
        {items.length > 0 && (
          <span className="ml-auto text-xs font-normal text-antique-text-mute">
            {items.length} item{items.length !== 1 ? "s" : ""}
          </span>
        )}
      </h2>

      {items.length === 0 ? (
        <div className="py-8 text-center space-y-3">
          <p className="text-sm text-antique-text-mute">No saved listings yet.</p>
          <Link
            href="/search"
            className="inline-block text-sm text-antique-accent hover:text-antique-accent-hover font-medium transition-colors"
          >
            Browse listings →
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const countdown = timeUntil(item.sale_ends_at);
            return (
              <li
                key={item.id}
                className="flex items-start gap-3 p-3 rounded-lg border border-antique-border hover:border-antique-accent/40 transition-colors"
              >
                {/* Thumbnail */}
                {item.primary_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.primary_image_url}
                    alt={item.title}
                    className="w-14 h-14 rounded-lg object-cover flex-shrink-0 bg-antique-muted"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-antique-muted flex-shrink-0" />
                )}

                {/* Info */}
                <div className="flex-1 min-w-0 space-y-0.5">
                  <Link
                    href={`/listing/${item.id}`}
                    className="text-sm font-medium text-antique-text line-clamp-2 leading-snug hover:text-antique-accent transition-colors"
                  >
                    {item.title}
                  </Link>
                  <div className="flex items-center gap-2 flex-wrap">
                    {item.current_price != null && (
                      <span className="text-sm font-bold text-antique-accent">
                        {formatPrice(item.current_price)}
                      </span>
                    )}
                    {item.platform_name && (
                      <span className="text-xs text-antique-text-mute">{item.platform_name}</span>
                    )}
                    {countdown && (
                      <span className="text-xs text-antique-text-mute flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {countdown}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <a
                    href={item.external_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="View on platform"
                    className="p-1.5 text-antique-text-mute hover:text-antique-accent transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => handleRemove(item.id)}
                    title="Remove from watchlist"
                    className="p-1.5 text-antique-text-mute hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── Saved searches panel ──────────────────────────────────────────────────────

function SavedSearchesPanel() {
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");
  const [newQuery, setNewQuery] = useState("");
  const [showForm, setShowForm] = useState(false);

  const { data: searches = [], isLoading } = useQuery({
    queryKey: ["saved-searches"],
    queryFn: getSavedSearches,
  });

  const createMut = useMutation({
    mutationFn: createSavedSearch,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saved-searches"] });
      setNewName(""); setNewQuery(""); setShowForm(false);
    },
  });

  const deleteMut = useMutation({
    mutationFn: deleteSavedSearch,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-searches"] }),
  });

  return (
    <div className="bg-antique-surface border border-antique-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-display font-semibold text-antique-text flex items-center gap-2">
          <BookMarked className="w-4 h-4 text-antique-accent" />
          Saved Searches
        </h2>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="flex items-center gap-1.5 text-xs text-antique-accent hover:text-antique-accent-hover font-medium transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> New
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!newName.trim()) return;
            createMut.mutate({ name: newName, query_text: newQuery || undefined });
          }}
          className="mb-5 space-y-2.5 bg-antique-muted rounded-lg p-4 border border-antique-border"
        >
          <Input
            type="text" placeholder="Name (e.g. Imari plates)"
            value={newName} onChange={(e) => setNewName(e.target.value)} required
          />
          <Input
            type="text" placeholder="Search query (optional)"
            value={newQuery} onChange={(e) => setNewQuery(e.target.value)}
          />
          <div className="flex gap-2 pt-1">
            <button
              type="submit" disabled={createMut.isPending}
              className="flex-1 bg-antique-accent text-white py-2 rounded-lg text-sm font-medium hover:bg-antique-accent-hover disabled:opacity-60 flex items-center justify-center gap-1.5 transition-colors"
            >
              {createMut.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
              Save Search
            </button>
            <button
              type="button" onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm text-antique-text-sec hover:text-antique-text transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="py-8 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-antique-text-mute" />
        </div>
      ) : searches.length === 0 ? (
        <p className="text-sm text-antique-text-mute text-center py-8">No saved searches yet.</p>
      ) : (
        <ul className="divide-y divide-antique-border">
          {(searches as SavedSearch[]).map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-antique-text truncate">{s.name}</p>
                {s.query_text && (
                  <p className="text-xs text-antique-text-sec truncate mt-0.5">
                    &ldquo;{s.query_text}&rdquo;
                  </p>
                )}
              </div>
              <Link
                href={`/search?q=${encodeURIComponent(s.query_text ?? s.name)}`}
                className="text-xs text-antique-accent hover:text-antique-accent-hover font-medium flex-shrink-0 transition-colors"
              >
                Search
              </Link>
              <button
                onClick={() => deleteMut.mutate(s.id)}
                className="text-antique-text-mute hover:text-red-500 flex-shrink-0 transition-colors"
                title="Remove"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Alerts panel ──────────────────────────────────────────────────────────────

function AlertsPanel() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newQuery, setNewQuery] = useState("");
  const [newMaxPrice, setNewMaxPrice] = useState("");

  const { data: alerts = [], isLoading } = useQuery({ queryKey: ["alerts"], queryFn: getAlerts });

  const createMut = useMutation({
    mutationFn: createAlert,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts"] });
      setNewName(""); setNewQuery(""); setNewMaxPrice(""); setShowForm(false);
    },
  });

  const toggleMut = useMutation({
    mutationFn: toggleAlert,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  });

  const deleteMut = useMutation({
    mutationFn: deleteAlert,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  });

  return (
    <div className="bg-antique-surface border border-antique-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-display font-semibold text-antique-text flex items-center gap-2">
          <Bell className="w-4 h-4 text-antique-accent" />
          Email Alerts
        </h2>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="flex items-center gap-1.5 text-xs text-antique-accent hover:text-antique-accent-hover font-medium transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> New Alert
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!newName.trim()) return;
            createMut.mutate({
              name: newName,
              query_text: newQuery || undefined,
              max_price: newMaxPrice ? Number(newMaxPrice) : undefined,
              notify_email: true,
            });
          }}
          className="mb-5 space-y-2.5 bg-antique-muted rounded-lg p-4 border border-antique-border"
        >
          <Input
            type="text" placeholder="Alert name (e.g. Tiffany lamp)" value={newName}
            onChange={(e) => setNewName(e.target.value)} required
          />
          <Input
            type="text" placeholder="Keywords to watch" value={newQuery}
            onChange={(e) => setNewQuery(e.target.value)}
          />
          <Input
            type="number" placeholder="Max price (optional)" value={newMaxPrice}
            onChange={(e) => setNewMaxPrice(e.target.value)} min={0}
          />
          <p className="text-xs text-antique-text-mute pt-0.5">
            You&apos;ll receive an email when matching listings appear.
          </p>
          <div className="flex gap-2 pt-1">
            <button
              type="submit" disabled={createMut.isPending}
              className="flex-1 bg-antique-accent text-white py-2 rounded-lg text-sm font-medium hover:bg-antique-accent-hover disabled:opacity-60 flex items-center justify-center gap-1.5 transition-colors"
            >
              {createMut.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
              Create Alert
            </button>
            <button
              type="button" onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm text-antique-text-sec hover:text-antique-text transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="py-8 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-antique-text-mute" />
        </div>
      ) : alerts.length === 0 ? (
        <p className="text-sm text-antique-text-mute text-center py-8">
          No alerts yet. Create one to watch for listings.
        </p>
      ) : (
        <ul className="divide-y divide-antique-border">
          {(alerts as AlertItem[]).map((a) => (
            <li key={a.id} className="flex items-center gap-3 py-3">
              <button
                onClick={() => toggleMut.mutate(a.id)}
                title={a.is_active ? "Disable alert" : "Enable alert"}
                className="flex-shrink-0"
              >
                {a.is_active
                  ? <ToggleRight className="w-5 h-5 text-antique-accent" />
                  : <ToggleLeft className="w-5 h-5 text-antique-text-mute" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${a.is_active ? "text-antique-text" : "text-antique-text-mute line-through"}`}>
                  {a.name}
                </p>
                <div className="flex items-center gap-2 text-xs text-antique-text-sec mt-0.5">
                  {a.query_text && <span>&ldquo;{a.query_text}&rdquo;</span>}
                  {a.max_price != null && <span>· max ${a.max_price.toLocaleString()}</span>}
                  {a.trigger_count > 0 && (
                    <span className="text-antique-accent font-medium">
                      · {a.trigger_count} match{a.trigger_count !== 1 ? "es" : ""}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => deleteMut.mutate(a.id)}
                className="text-antique-text-mute hover:text-red-500 flex-shrink-0 transition-colors"
                title="Delete alert"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SavedPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-antique-text-mute" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold text-antique-text">Saved</h1>
        {user && (
          <span className="text-xs text-antique-text-sec">
            {user.email} &middot; {user.tier} plan
          </span>
        )}
      </div>
      <div className="space-y-5">
        {/* Watchlist — always visible, no auth required */}
        <WatchlistPanel />

        {/* Saved searches + alerts — require authentication */}
        {user ? (
          <>
            <SavedSearchesPanel />
            <AlertsPanel />
          </>
        ) : (
          <AuthPrompt />
        )}
      </div>
    </div>
  );
}
