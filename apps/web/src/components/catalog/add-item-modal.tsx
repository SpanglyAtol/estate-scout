"use client";

import { useState, useRef } from "react";
import { X, Upload, Plus } from "lucide-react";
import { addCatalogItem, CATEGORIES, CONDITIONS, type CatalogItem } from "./catalog-types";

interface Props {
  onClose: () => void;
  onAdded: (item: CatalogItem) => void;
}

export function AddItemModal({ onClose, onAdded }: Props) {
  const [title, setTitle]       = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [condition, setCondition] = useState(CONDITIONS[1]);
  const [description, setDescription] = useState("");
  const [notes, setNotes]       = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [saving, setSaving]     = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFiles(files: FileList | null) {
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (dataUrl) setImageUrls((prev) => [...prev, dataUrl]);
      };
      reader.readAsDataURL(file);
    });
  }

  function removeImage(idx: number) {
    setImageUrls((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    const item = addCatalogItem({ title, category, condition, description, notes, imageUrls });
    onAdded(item);
    setSaving(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-antique-surface border border-antique-border rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-antique-border">
          <h2 className="font-display text-lg font-bold text-antique-text">Add Item to Catalog</h2>
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
              placeholder="e.g. Haviland Limoges Porcelain Plate Set"
              required
              className="w-full border border-antique-border rounded-lg px-3 py-2.5 text-sm bg-antique-bg text-antique-text placeholder:text-antique-text-mute focus:outline-none focus:border-antique-accent transition-colors"
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
              placeholder="Describe the item — maker's marks, dimensions, provenance, any damage…"
              rows={3}
              className="w-full border border-antique-border rounded-lg px-3 py-2.5 text-sm bg-antique-bg text-antique-text placeholder:text-antique-text-mute focus:outline-none focus:border-antique-accent transition-colors resize-none"
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
              placeholder="e.g. Purchased at estate sale, July 2024"
              className="w-full border border-antique-border rounded-lg px-3 py-2.5 text-sm bg-antique-bg text-antique-text placeholder:text-antique-text-mute focus:outline-none focus:border-antique-accent transition-colors"
            />
          </div>

          {/* Photo upload */}
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
                    onClick={() => removeImage(idx)}
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
              <Plus className="w-4 h-4" />
              Save Item
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
