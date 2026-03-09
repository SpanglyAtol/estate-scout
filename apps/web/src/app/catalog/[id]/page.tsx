"use client";

/**
 * Catalog Item Detail Page — /catalog/[id]
 *
 * Shows the SphericalViewer + LensPanel for a user's own catalogued item.
 * Photos taken via camera or uploaded through the lens panel are auto-saved
 * back to the item in localStorage (and via API when authenticated).
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Pencil, TrendingUp, X, Loader2, Upload, Plus } from "lucide-react";
import { SphericalViewer } from "@/components/viewer/spherical-viewer";
import {
  loadCatalog,
  saveCatalog,
  updateCatalogItem,
  updateCatalogItemInApi,
  type CatalogItem,
  CATEGORIES,
  CONDITIONS,
} from "@/components/catalog/catalog-types";

interface PageProps {
  params: { id: string };
}

export default function CatalogItemDetailPage({ params }: PageProps) {
  const [item, setItem] = useState<CatalogItem | null | "loading">("loading");
  const [editing, setEditing] = useState(false);

  // ── Load item from localStorage on mount ───────────────────────────────────
  useEffect(() => {
    const found = loadCatalog().find((i) => i.id === params.id) ?? null;
    setItem(found);
  }, [params.id]);

  // ── Persist photo additions from SphericalViewer ───────────────────────────
  const handlePhotosAdded = (newUrls: string[]) => {
    if (!item || item === "loading") return;
    const updated: CatalogItem = {
      ...item,
      imageUrls: [...newUrls, ...item.imageUrls],
    };
    setItem(updated);
    // Persist to localStorage
    updateCatalogItem(item.id, { imageUrls: updated.imageUrls });
    // Best-effort API sync (ignore failures — localStorage is source of truth here)
    updateCatalogItemInApi(item.id, { imageUrls: updated.imageUrls }).catch(() => {});
  };

  // ── Handle edit save ───────────────────────────────────────────────────────
  const handleSaved = (updated: CatalogItem) => {
    setItem(updated);
    setEditing(false);
  };

  // ── Render states ──────────────────────────────────────────────────────────
  if (item === "loading") {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-antique-accent mx-auto" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="container mx-auto px-4 py-20 text-center space-y-4">
        <p className="text-2xl">🏺</p>
        <p className="text-antique-text-sec">Item not found in your catalog.</p>
        <Link href="/catalog" className="text-antique-accent underline text-sm">
          ← Back to Catalog
        </Link>
      </div>
    );
  }

  const analysis = item.aiAnalysis;

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Back link */}
      <Link
        href="/catalog"
        className="inline-flex items-center gap-1.5 text-sm text-antique-text-mute hover:text-antique-text transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Catalog
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* ── Left: 3D viewer + lens panel ── */}
        <SphericalViewer
          primaryImageUrl={item.imageUrls[0] ?? null}
          imageUrls={item.imageUrls.slice(1)}
          title={item.title}
          onPhotosAdded={handlePhotosAdded}
        />

        {/* ── Right: item details ── */}
        <div className="space-y-4">
          {/* Category badge */}
          <span className="inline-block bg-antique-accent-s text-antique-accent text-xs font-semibold px-3 py-1 rounded-full border border-antique-accent-lt">
            {item.category}
          </span>

          {/* Title + edit button */}
          <div className="flex items-start gap-2">
            <h1 className="text-2xl font-bold text-antique-text font-display flex-1 leading-snug">
              {item.title}
            </h1>
            <button
              onClick={() => setEditing(true)}
              className="flex-shrink-0 p-2 rounded-lg border border-antique-border text-antique-text-mute hover:text-antique-accent hover:border-antique-accent transition-colors"
              aria-label="Edit item"
            >
              <Pencil className="w-4 h-4" />
            </button>
          </div>

          {/* Condition */}
          <p className="text-sm text-antique-text-sec">
            <span className="font-medium text-antique-text">Condition:</span> {item.condition}
          </p>

          {/* AI value estimate */}
          {analysis?.priceMid != null && (
            <div className="bg-antique-accent-s border border-antique-accent-lt rounded-xl px-4 py-3 flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-antique-accent flex-shrink-0" />
              <div>
                <p className="text-xs text-antique-text-mute">Estimated value</p>
                <p className="font-bold text-antique-accent text-lg">
                  ${analysis.priceLow?.toLocaleString() ?? "—"} – ${analysis.priceHigh?.toLocaleString() ?? "—"}
                </p>
              </div>
            </div>
          )}

          {/* Description */}
          {item.description && (
            <div>
              <p className="text-xs font-semibold text-antique-text-sec uppercase tracking-wide mb-1">Description</p>
              <p className="text-sm text-antique-text-sec leading-relaxed whitespace-pre-wrap">
                {item.description}
              </p>
            </div>
          )}

          {/* Private notes */}
          {item.notes && (
            <div className="bg-antique-muted rounded-xl px-4 py-3 border border-antique-border">
              <p className="text-xs font-semibold text-antique-text-sec uppercase tracking-wide mb-1">Private Notes</p>
              <p className="text-sm text-antique-text-sec">{item.notes}</p>
            </div>
          )}

          {/* AI analysis narrative */}
          {analysis?.narrative && (
            <div className="border border-antique-border rounded-xl overflow-hidden">
              <div className="bg-antique-muted px-4 py-2.5 text-xs font-semibold text-antique-text-sec uppercase tracking-wide">
                AI Appraisal
              </div>
              <div className="px-4 py-3">
                <p className="text-sm text-antique-text-sec leading-relaxed">{analysis.narrative}</p>
                {item.lastAnalyzed && (
                  <p className="text-xs text-antique-text-mute mt-2">
                    Analysed {new Date(item.lastAnalyzed!).toLocaleDateString()}
                    {analysis.priceCount > 0 && ` · Based on ${analysis.priceCount} comparable sales`}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Metadata footer */}
          <p className="text-xs text-antique-text-mute">
            Added {new Date(item.addedAt).toLocaleDateString()}
            {item.imageUrls.length > 0 && ` · ${item.imageUrls.length} photo${item.imageUrls.length > 1 ? "s" : ""}`}
          </p>
        </div>
      </div>

      {/* Edit modal */}
      {editing && (
        <EditItemModal item={item} onSaved={handleSaved} onClose={() => setEditing(false)} />
      )}
    </div>
  );
}

// ── Inline edit modal ─────────────────────────────────────────────────────────

interface EditModalProps {
  item: CatalogItem;
  onSaved: (updated: CatalogItem) => void;
  onClose: () => void;
}

function EditItemModal({ item, onSaved, onClose }: EditModalProps) {
  const [title, setTitle]             = useState(item.title);
  const [category, setCategory]       = useState(item.category);
  const [condition, setCondition]     = useState(item.condition);
  const [description, setDescription] = useState(item.description);
  const [notes, setNotes]             = useState(item.notes);
  const [imageUrls, setImageUrls]     = useState<string[]>(item.imageUrls);
  const [saving, setSaving]           = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  function handleFiles(files: FileList | null) {
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const url = e.target?.result as string;
        if (url) setImageUrls((prev) => [...prev, url]);
      };
      reader.readAsDataURL(file);
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    const patch: Partial<CatalogItem> = { title, category, condition, description, notes, imageUrls };
    const updated: CatalogItem = { ...item, ...patch };
    // Persist localStorage
    updateCatalogItem(item.id, patch);
    // Best-effort API sync
    updateCatalogItemInApi(item.id, patch).catch(() => {});
    setSaving(false);
    onSaved(updated);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-antique-surface border border-antique-border rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-antique-border">
          <h2 className="font-display text-lg font-bold text-antique-text">Edit Item</h2>
          <button onClick={onClose} className="p-1 text-antique-text-mute hover:text-antique-text transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-antique-text-sec uppercase tracking-wide mb-1.5">
              Item Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full border border-antique-border rounded-lg px-3 py-2.5 text-sm bg-antique-bg text-antique-text focus:outline-none focus:border-antique-accent transition-colors"
            />
          </div>

          {/* Category + Condition */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-antique-text-sec uppercase tracking-wide mb-1.5">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full border border-antique-border rounded-lg px-3 py-2.5 text-sm bg-antique-bg text-antique-text focus:outline-none focus:border-antique-accent transition-colors"
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-antique-text-sec uppercase tracking-wide mb-1.5">
                Condition
              </label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="w-full border border-antique-border rounded-lg px-3 py-2.5 text-sm bg-antique-bg text-antique-text focus:outline-none focus:border-antique-accent transition-colors"
              >
                {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-antique-text-sec uppercase tracking-wide mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full border border-antique-border rounded-lg px-3 py-2.5 text-sm bg-antique-bg text-antique-text focus:outline-none focus:border-antique-accent transition-colors resize-none"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-antique-text-sec uppercase tracking-wide mb-1.5">
              Private Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border border-antique-border rounded-lg px-3 py-2.5 text-sm bg-antique-bg text-antique-text focus:outline-none focus:border-antique-accent transition-colors"
            />
          </div>

          {/* Photos */}
          <div>
            <label className="block text-xs font-semibold text-antique-text-sec uppercase tracking-wide mb-2">
              Photos
            </label>
            <div className="flex flex-wrap gap-2">
              {imageUrls.map((url, idx) => (
                <div key={idx} className="relative w-20 h-20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="w-20 h-20 rounded-lg object-cover border border-antique-border" />
                  <button
                    type="button"
                    onClick={() => setImageUrls((prev) => prev.filter((_, i) => i !== idx))}
                    className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-20 h-20 rounded-lg border-2 border-dashed border-antique-border hover:border-antique-accent text-antique-text-mute hover:text-antique-accent transition-colors flex flex-col items-center justify-center gap-1"
              >
                <Upload className="w-5 h-5" />
                <span className="text-[10px]">Add photo</span>
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={!title.trim() || saving}
              className="flex-1 flex items-center justify-center gap-2 bg-antique-accent hover:bg-antique-accent-h disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Save Changes
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-sm text-antique-text-sec hover:text-antique-text border border-antique-border rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

