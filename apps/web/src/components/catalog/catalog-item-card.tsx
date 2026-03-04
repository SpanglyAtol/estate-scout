"use client";

import { useState } from "react";
import { Sparkles, Trash2, TrendingUp } from "lucide-react";
import { type CatalogItem } from "./catalog-types";
import { AiAnalysisPanel } from "./ai-analysis-panel";

interface Props {
  item: CatalogItem;
  onDeleted: (id: string) => void;
  onUpdated: (item: CatalogItem) => void;
}

export function CatalogItemCard({ item, onDeleted, onUpdated }: Props) {
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleDelete() {
    onDeleted(item.id);
  }

  const thumb = item.imageUrls[0];
  const analysis = item.aiAnalysis;

  return (
    <>
      <div className="antique-card flex flex-col overflow-hidden hover:border-antique-accent hover:shadow-md transition-all">
        {/* Image */}
        <div className="aspect-[4/3] bg-antique-muted relative overflow-hidden">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumb}
              alt={item.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl text-antique-text-mute">
              🏺
            </div>
          )}
          {item.imageUrls.length > 1 && (
            <span className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
              +{item.imageUrls.length - 1} more
            </span>
          )}
        </div>

        {/* Info */}
        <div className="p-4 flex flex-col flex-1 gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-antique-accent mb-0.5">
              {item.category}
            </p>
            <h3 className="font-display font-bold text-antique-text text-sm leading-snug line-clamp-2">
              {item.title}
            </h3>
            <p className="text-xs text-antique-text-mute mt-0.5">{item.condition}</p>
          </div>

          {item.description && (
            <p className="text-xs text-antique-text-sec leading-relaxed line-clamp-2">
              {item.description}
            </p>
          )}

          {/* Price estimate */}
          {analysis?.priceMid != null && (
            <div className="flex items-center gap-1.5 bg-antique-accent-s border border-antique-accent-lt rounded-lg px-3 py-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-antique-accent flex-shrink-0" />
              <span className="text-xs text-antique-text-sec">Est. value:</span>
              <span className="text-sm font-bold text-antique-accent ml-auto">
                ${analysis.priceLow?.toLocaleString() ?? "—"} – ${analysis.priceHigh?.toLocaleString() ?? "—"}
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 mt-auto pt-1">
            <button
              onClick={() => setShowAnalysis(true)}
              className="flex-1 flex items-center justify-center gap-1.5 border border-antique-accent text-antique-accent hover:bg-antique-accent hover:text-white transition-colors rounded-lg py-2 text-xs font-semibold"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {analysis ? "Re-analyse" : "AI Analysis"}
            </button>

            {confirmDelete ? (
              <div className="flex gap-1">
                <button
                  onClick={handleDelete}
                  className="px-3 py-2 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 transition-colors"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-2 border border-antique-border text-antique-text-sec rounded-lg text-xs hover:border-antique-accent transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="p-2 text-antique-text-mute hover:text-red-600 border border-antique-border hover:border-red-300 rounded-lg transition-colors"
                aria-label="Delete item"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          <p className="text-[10px] text-antique-text-mute">
            Added {new Date(item.addedAt).toLocaleDateString()}
            {item.lastAnalyzed && ` · Analysed ${new Date(item.lastAnalyzed).toLocaleDateString()}`}
          </p>
        </div>
      </div>

      {showAnalysis && (
        <AiAnalysisPanel
          item={item}
          onUpdated={(updated) => { onUpdated(updated); setShowAnalysis(false); }}
          onClose={() => setShowAnalysis(false)}
        />
      )}
    </>
  );
}
