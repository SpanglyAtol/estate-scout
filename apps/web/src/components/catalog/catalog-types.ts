export interface CatalogItem {
  id: string;
  title: string;
  description: string;
  category: string;
  condition: string;
  imageUrls: string[]; // base64 data URIs or https URLs
  notes: string;
  addedAt: string;    // ISO 8601
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
  const items = loadCatalog();
  saveCatalog([newItem, ...items]);
  return newItem;
}

export function updateCatalogItem(id: string, patch: Partial<CatalogItem>): void {
  const items = loadCatalog().map((i) => (i.id === id ? { ...i, ...patch } : i));
  saveCatalog(items);
}

export function deleteCatalogItem(id: string): void {
  saveCatalog(loadCatalog().filter((i) => i.id !== id));
}

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
