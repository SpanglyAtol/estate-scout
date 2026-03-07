"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Plus, BookOpen, Truck, Package, ChevronRight, Sparkles, Loader2, Cloud, HardDrive } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  loadCatalog,
  loadCatalogFromApi,
  updateCatalogItemInApi,
  deleteCatalogItemFromApi,
  type CatalogItem,
} from "@/components/catalog/catalog-types";
import { CatalogItemCard } from "@/components/catalog/catalog-item-card";
import { AddItemModal } from "@/components/catalog/add-item-modal";

type Tab = "catalog" | "ship-and-list";

/**
 * Detect whether the backend API is configured.
 * If NEXT_PUBLIC_API_URL points somewhere other than the Next.js origin,
 * we treat it as a real backend and use server-side catalog storage.
 */
function hasBackend(): boolean {
  if (typeof window === "undefined") return false;
  const url = process.env.NEXT_PUBLIC_API_URL ?? "";
  return Boolean(url) && !url.includes("localhost:3000") && !url.includes("localhost");
}

export default function CatalogPage() {
  const { user, loading } = useAuth();
  const [items, setItems]           = useState<CatalogItem[]>([]);
  const [fetching, setFetching]     = useState(false);
  const [showAdd, setShowAdd]       = useState(false);
  const [activeTab, setActiveTab]   = useState<Tab>("catalog");
  const [useApi, setUseApi]         = useState(false);
  const [error, setError]           = useState<string | null>(null);

  // Load items — prefer backend API when user is logged in and backend is available
  const refresh = useCallback(async () => {
    if (!user) return;
    setFetching(true);
    setError(null);
    const backendAvailable = hasBackend();
    setUseApi(backendAvailable);
    try {
      if (backendAvailable) {
        setItems(await loadCatalogFromApi());
      } else {
        setItems(loadCatalog());
      }
    } catch (err) {
      // Fall back to localStorage if API fails
      setUseApi(false);
      setItems(loadCatalog());
      console.warn("Catalog API unavailable, using localStorage:", err);
    } finally {
      setFetching(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleAdded = useCallback((item: CatalogItem) => {
    setItems((prev) => [item, ...prev]);
    setShowAdd(false);
  }, []);

  const handleDeleted = useCallback(async (id: string) => {
    if (useApi) {
      try { await deleteCatalogItemFromApi(id); } catch { /* ignore */ }
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, [useApi]);

  const handleUpdated = useCallback(async (updated: CatalogItem) => {
    if (useApi) {
      try {
        const refreshed = await updateCatalogItemInApi(updated.id, updated);
        setItems((prev) => prev.map((i) => (i.id === refreshed.id ? refreshed : i)));
        return;
      } catch { /* fall through to local update */ }
    }
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  }, [useApi]);

  // ── Loading state ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-antique-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Unauthenticated ───────────────────────────────────────────────────────

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-20 max-w-lg text-center">
        <div className="text-6xl mb-6">📦</div>
        <h1 className="font-display text-3xl font-bold text-antique-text mb-4">My Catalog</h1>
        <p className="text-antique-text-sec mb-8 leading-relaxed">
          Create a free account to build your personal antiques catalog. Add photos, descriptions,
          and get AI-powered pricing and identification for every item you own.
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/auth?mode=register"
            className="bg-antique-accent text-white px-6 py-3 rounded-xl font-semibold hover:bg-antique-accent-h transition-colors"
          >
            Sign Up Free
          </Link>
          <Link
            href="/auth"
            className="bg-antique-surface border border-antique-border text-antique-text-sec px-6 py-3 rounded-xl font-semibold hover:border-antique-accent transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  // ── Authenticated ─────────────────────────────────────────────────────────

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-antique-text">My Catalog</h1>
          <p className="text-antique-text-sec text-sm mt-1 flex items-center gap-2">
            {fetching ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <span>
                {items.length} item{items.length !== 1 ? "s" : ""} · Personal collection tracker
              </span>
            )}
            {useApi ? (
              <span className="inline-flex items-center gap-1 text-green-600 text-xs">
                <Cloud className="w-3 h-3" /> Synced
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-antique-text-mute text-xs">
                <HardDrive className="w-3 h-3" /> Local only
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-antique-accent hover:bg-antique-accent-h text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Item
        </button>
      </div>

      {error && (
        <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-8 border-b border-antique-border">
        {[
          { id: "catalog" as Tab,       icon: <BookOpen className="w-4 h-4" />, label: "My Items" },
          { id: "ship-and-list" as Tab, icon: <Truck className="w-4 h-4" />,    label: "List & Ship" },
        ].map(({ id, icon, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === id
                ? "border-antique-accent text-antique-accent"
                : "border-transparent text-antique-text-sec hover:text-antique-text"
            }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {/* ── Catalog tab ── */}
      {activeTab === "catalog" && (
        <>
          {fetching ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-antique-accent" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">🏺</div>
              <h2 className="font-display text-xl font-bold text-antique-text mb-2">
                Your catalog is empty
              </h2>
              <p className="text-antique-text-sec text-sm mb-6 max-w-sm mx-auto">
                Add photos of your antiques and collectibles to track their value, document
                provenance, and get AI-powered pricing estimates.
              </p>
              <button
                onClick={() => setShowAdd(true)}
                className="bg-antique-accent hover:bg-antique-accent-h text-white px-6 py-3 rounded-xl font-semibold text-sm transition-colors"
              >
                Add Your First Item
              </button>

              {/* Feature highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-12 text-left max-w-2xl mx-auto">
                {[
                  {
                    icon: "📷",
                    title: "Photo Documentation",
                    desc: "Upload multiple photos and document condition, markings, and provenance.",
                  },
                  {
                    icon: "🤖",
                    title: "AI Price Estimates",
                    desc: "Get instant valuations based on comparable completed auction sales.",
                  },
                  {
                    icon: "📊",
                    title: "Collection Tracking",
                    desc: useApi
                      ? "Items sync across all your devices automatically."
                      : "Connect a backend to sync your catalog across devices.",
                  },
                ].map(({ icon, title, desc }) => (
                  <div key={title} className="antique-card p-4">
                    <div className="text-2xl mb-2">{icon}</div>
                    <p className="font-display font-bold text-antique-text text-sm mb-1">{title}</p>
                    <p className="text-xs text-antique-text-sec leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Quick AI tip */}
              <div className="flex items-center gap-3 bg-antique-accent-s border border-antique-accent-lt rounded-xl px-4 py-3 mb-6">
                <Sparkles className="w-5 h-5 text-antique-accent flex-shrink-0" />
                <p className="text-sm text-antique-text-sec">
                  Click <strong className="text-antique-text">AI Analysis</strong> on any item to get an
                  estimated value and identification from our AI, based on comparable auction sales.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {items.map((item) => (
                  <CatalogItemCard
                    key={item.id}
                    item={item}
                    onDeleted={handleDeleted}
                    onUpdated={handleUpdated}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* ── List & Ship tab (Coming Soon) ── */}
      {activeTab === "ship-and-list" && (
        <div className="py-10 max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-antique-accent-lt text-antique-accent text-xs font-semibold px-3 py-1.5 rounded-full mb-4 uppercase tracking-wide">
              Coming Soon
            </div>
            <h2 className="font-display text-2xl font-bold text-antique-text mb-3">
              List &amp; Ship Your Items
            </h2>
            <p className="text-antique-text-sec leading-relaxed">
              From your catalog, list items directly to multiple selling platforms and get
              instant shipping quotes — all in one place.
            </p>
          </div>

          <div className="space-y-4">
            <div className="antique-card p-5 flex gap-4 items-start">
              <div className="w-10 h-10 bg-antique-accent-lt rounded-xl flex items-center justify-center flex-shrink-0 text-xl">
                🛍️
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-bold text-antique-text">Cross-Platform Listing</h3>
                  <span className="text-xs bg-antique-muted text-antique-text-sec px-2 py-0.5 rounded-full">Planned</span>
                </div>
                <p className="text-sm text-antique-text-sec mt-1 leading-relaxed">
                  List your catalog items to eBay, Etsy, Facebook Marketplace, and HiBid simultaneously.
                  AI auto-fills titles, descriptions, and suggested pricing.
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {["eBay", "Etsy", "Facebook Marketplace", "HiBid"].map((p) => (
                    <span key={p} className="text-xs border border-antique-border text-antique-text-sec px-2 py-0.5 rounded-full">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="antique-card p-5 flex gap-4 items-start">
              <div className="w-10 h-10 bg-antique-accent-lt rounded-xl flex items-center justify-center flex-shrink-0">
                <Package className="w-5 h-5 text-antique-accent" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-bold text-antique-text">Shipping Carrier Comparison</h3>
                  <span className="text-xs bg-antique-muted text-antique-text-sec px-2 py-0.5 rounded-full">Planned</span>
                </div>
                <p className="text-sm text-antique-text-sec mt-1 leading-relaxed">
                  Compare shipping rates from USPS, UPS, and FedEx. Enter item dimensions and
                  weight to get instant quotes and print labels.
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {["USPS", "UPS", "FedEx"].map((c) => (
                    <span key={c} className="text-xs border border-antique-border text-antique-text-sec px-2 py-0.5 rounded-full">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="antique-card p-5 flex gap-4 items-start">
              <div className="w-10 h-10 bg-antique-accent-lt rounded-xl flex items-center justify-center flex-shrink-0 text-xl">
                ✍️
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-bold text-antique-text">AI-Generated Listings</h3>
                  <span className="text-xs bg-antique-muted text-antique-text-sec px-2 py-0.5 rounded-full">Planned</span>
                </div>
                <p className="text-sm text-antique-text-sec mt-1 leading-relaxed">
                  Automatically generate compelling listing titles, detailed descriptions, and
                  optimal pricing suggestions based on recent comparable sales.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 text-center">
            <p className="text-sm text-antique-text-sec mb-4">
              Want to be notified when List &amp; Ship launches?
            </p>
            <Link
              href="/saved"
              className="inline-flex items-center gap-2 bg-antique-accent text-white px-6 py-3 rounded-xl font-semibold text-sm hover:bg-antique-accent-h transition-colors"
            >
              Set Up Alerts
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {showAdd && (
        <AddItemModal
          onClose={() => setShowAdd(false)}
          onAdded={handleAdded}
          useApi={useApi}
        />
      )}
    </div>
  );
}
