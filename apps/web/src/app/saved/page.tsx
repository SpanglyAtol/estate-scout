"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BookMarked, Bell, Trash2, ToggleLeft,
  ToggleRight, Plus, Loader2,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  getSavedSearches, createSavedSearch, deleteSavedSearch,
  getAlerts, createAlert, toggleAlert, deleteAlert,
  type SavedSearch, type AlertItem,
} from "@/lib/api-client";

// ── Unauthenticated splash ────────────────────────────────────────────────────

function AuthPrompt() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl text-center">
      <div className="text-6xl mb-6">🔔</div>
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Saved Searches &amp; Alerts</h1>
      <p className="text-gray-600 mb-8">
        Save searches and get notified the moment a matching item appears across all platforms.
      </p>
      <div className="flex gap-3 justify-center">
        <Link href="/auth?mode=register" className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors">
          Sign Up Free
        </Link>
        <Link href="/auth" className="bg-white border border-gray-300 text-gray-700 px-6 py-3 rounded-xl font-semibold hover:bg-gray-50 transition-colors">
          Sign In
        </Link>
      </div>
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
    <div className="bg-white border border-gray-200 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-gray-900 flex items-center gap-2">
          <BookMarked className="w-5 h-5 text-blue-500" /> Saved Searches
        </h2>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          <Plus className="w-4 h-4" /> New
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!newName.trim()) return;
            createMut.mutate({ name: newName, query_text: newQuery || undefined });
          }}
          className="mb-4 space-y-2 bg-gray-50 rounded-xl p-4"
        >
          <input
            type="text" placeholder="Search name (e.g. Imari plates)"
            value={newName} onChange={(e) => setNewName(e.target.value)} required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <input
            type="text" placeholder="Search query (optional)"
            value={newQuery} onChange={(e) => setNewQuery(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <div className="flex gap-2">
            <button
              type="submit" disabled={createMut.isPending}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-1.5"
            >
              {createMut.isPending && <Loader2 className="w-3 h-3 animate-spin" />} Save
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-500">
              Cancel
            </button>
          </div>
        </form>
      )}

      {isLoading
        ? <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        : searches.length === 0
          ? <p className="text-sm text-gray-400 text-center py-6">No saved searches yet.</p>
          : (
            <ul className="divide-y divide-gray-100">
              {(searches as SavedSearch[]).map((s) => (
                <li key={s.id} className="flex items-center gap-3 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{s.name}</p>
                    {s.query_text && (
                      <p className="text-xs text-gray-500 truncate">&ldquo;{s.query_text}&rdquo;</p>
                    )}
                  </div>
                  <Link
                    href={`/search?q=${encodeURIComponent(s.query_text ?? s.name)}`}
                    className="text-xs text-blue-600 hover:underline flex-shrink-0"
                  >
                    Run
                  </Link>
                  <button
                    onClick={() => deleteMut.mutate(s.id)}
                    className="text-gray-400 hover:text-red-500 flex-shrink-0"
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
    <div className="bg-white border border-gray-200 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-gray-900 flex items-center gap-2">
          <Bell className="w-5 h-5 text-amber-500" /> Price Alerts
        </h2>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          <Plus className="w-4 h-4" /> New Alert
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
          className="mb-4 space-y-2 bg-gray-50 rounded-xl p-4"
        >
          <input
            type="text" placeholder="Alert name" value={newName}
            onChange={(e) => setNewName(e.target.value)} required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <input
            type="text" placeholder="Keywords to watch" value={newQuery}
            onChange={(e) => setNewQuery(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <input
            type="number" placeholder="Max price (optional)" value={newMaxPrice}
            onChange={(e) => setNewMaxPrice(e.target.value)} min={0}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <p className="text-xs text-gray-400">
            You&apos;ll get an email when matching listings appear.
          </p>
          <div className="flex gap-2">
            <button
              type="submit" disabled={createMut.isPending}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-1.5"
            >
              {createMut.isPending && <Loader2 className="w-3 h-3 animate-spin" />} Create Alert
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-500">
              Cancel
            </button>
          </div>
        </form>
      )}

      {isLoading
        ? <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        : alerts.length === 0
          ? <p className="text-sm text-gray-400 text-center py-6">No alerts yet. Create one to watch for listings.</p>
          : (
            <ul className="divide-y divide-gray-100">
              {(alerts as AlertItem[]).map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-3">
                  <button onClick={() => toggleMut.mutate(a.id)} title={a.is_active ? "Disable" : "Enable"}>
                    {a.is_active
                      ? <ToggleRight className="w-5 h-5 text-green-500" />
                      : <ToggleLeft className="w-5 h-5 text-gray-300" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{a.name}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      {a.query_text && <span>&ldquo;{a.query_text}&rdquo;</span>}
                      {a.max_price != null && <span>· max ${a.max_price}</span>}
                      {a.trigger_count > 0 && (
                        <span className="text-green-600">· {a.trigger_count} matches</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteMut.mutate(a.id)}
                    className="text-gray-400 hover:text-red-500 flex-shrink-0"
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
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!user) return <AuthPrompt />;

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Saved</h1>
        <span className="text-sm text-gray-500">
          <strong>{user.email}</strong> · {user.tier} plan
        </span>
      </div>
      <div className="space-y-6">
        <SavedSearchesPanel />
        <AlertsPanel />
      </div>
    </div>
  );
}
