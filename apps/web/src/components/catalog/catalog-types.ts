/**
 * Catalog data layer
 * ──────────────────
 * Provides a unified API for catalog items with two storage backends:
 *
 * 1. **Backend API** (when user is logged in + NEXT_PUBLIC_API_URL is set)
 *    Items are persisted server-side via POST/PUT/DELETE /api/v1/catalog.
 *    Accessible across devices, backed by PostgreSQL.
 *
 * 2. **localStorage fallback** (anonymous users or no backend)
 *    Items live in the browser only.  Preserved for backward compatibility.
 *
 * The catalog page calls `useCatalog()` which picks the right backend.
 */

import {
  getCatalogItems,
  createCatalogItemApi,
  updateCatalogItemApi,
  deleteCatalogItemApi,
  type CatalogItemApi,
} from "@/lib/api-client";

// ── Shared CatalogItem shape (compatible with both backends) ─────────────────

export interface CatalogItem {
  id: string;
  title: string;
  description: string;
  category: string;
  condition: string;
  imageUrls: string[];   // base64 data URIs or https URLs
  notes: string;
  addedAt: string;       // ISO 8601
  lastAnalyzed?: string;
  aiAnalysis?: {
    narrative: string;
    priceLow: number | null;
    priceMid: number | null;
    priceHigh: number | null;
    priceCount: number;
    queriedWith: string;
  };
}

// ── Converters ───────────────────────────────────────────────────────────────

/** Map API response shape → CatalogItem (camelCase ↔ snake_case) */
export function fromApi(api: CatalogItemApi): CatalogItem {
  return {
    id:           api.id,
    title:        api.title,
    description:  api.description ?? "",
    category:     api.category ?? "",
    condition:    api.condition ?? "",
    imageUrls:    api.image_urls ?? [],
    notes:        api.notes ?? "",
    addedAt:      api.added_at,
    lastAnalyzed: api.last_analyzed_at ?? undefined,
    aiAnalysis:   api.ai_analysis
      ? {
          narrative:   api.ai_analysis.narrative,
          priceLow:    api.ai_analysis.priceLow,
          priceMid:    api.ai_analysis.priceMid,
          priceHigh:   api.ai_analysis.priceHigh,
          priceCount:  api.ai_analysis.priceCount,
          queriedWith: api.ai_analysis.queriedWith,
        }
      : undefined,
  };
}

/** Map CatalogItem → API request body */
function toApiBody(item: Omit<CatalogItem, "id" | "addedAt">) {
  return {
    title:       item.title,
    description: item.description || undefined,
    category:    item.category || undefined,
    condition:   item.condition || undefined,
    notes:       item.notes || undefined,
    image_urls:  item.imageUrls,
  };
}

// ── API-backed operations (requires authenticated user + backend) ─────────────

export async function loadCatalogFromApi(): Promise<CatalogItem[]> {
  const items = await getCatalogItems();
  return items.map(fromApi);
}

export async function addCatalogItemToApi(
  item: Omit<CatalogItem, "id" | "addedAt">,
): Promise<CatalogItem> {
  const created = await createCatalogItemApi(toApiBody(item));
  return fromApi(created);
}

export async function updateCatalogItemInApi(
  id: string,
  patch: Partial<CatalogItem>,
): Promise<CatalogItem> {
  const body: Record<string, unknown> = {};
  if (patch.title !== undefined)       body.title       = patch.title;
  if (patch.description !== undefined) body.description = patch.description;
  if (patch.category !== undefined)    body.category    = patch.category;
  if (patch.condition !== undefined)   body.condition   = patch.condition;
  if (patch.notes !== undefined)       body.notes       = patch.notes;
  if (patch.imageUrls !== undefined)   body.image_urls  = patch.imageUrls;
  if (patch.aiAnalysis !== undefined)  body.ai_analysis = patch.aiAnalysis;

  const updated = await updateCatalogItemApi(id, body);
  return fromApi(updated);
}

export async function deleteCatalogItemFromApi(id: string): Promise<void> {
  await deleteCatalogItemApi(id);
}

// ── localStorage-backed operations (anonymous / offline fallback) ─────────────

const STORAGE_KEY = "estate-scout-catalog";

export function loadCatalog(): CatalogItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function saveCatalog(items: CatalogItem[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function addCatalogItem(item: Omit<CatalogItem, "id" | "addedAt">): CatalogItem {
  const newItem: CatalogItem = {
    ...item,
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    addedAt: new Date().toISOString(),
  };
  saveCatalog([newItem, ...loadCatalog()]);
  return newItem;
}

export function updateCatalogItem(id: string, patch: Partial<CatalogItem>): void {
  saveCatalog(loadCatalog().map((i) => (i.id === id ? { ...i, ...patch } : i)));
}

export function deleteCatalogItem(id: string): void {
  saveCatalog(loadCatalog().filter((i) => i.id !== id));
}

// ── Constants ────────────────────────────────────────────────────────────────

export const CATEGORIES = [
  "Ceramics & Porcelain",
  "Silver & Metalware",
  "Furniture",
  "Art & Paintings",
  "Jewelry & Watches",
  "Books & Manuscripts",
  "Rugs & Textiles",
  "Glass & Crystal",
  "Clocks & Instruments",
  "Coins & Stamps",
  "Toys & Collectibles",
  "Other",
];

export const CONDITIONS = [
  "Excellent / Mint",
  "Very Good",
  "Good",
  "Fair",
  "Poor / For Parts",
];
