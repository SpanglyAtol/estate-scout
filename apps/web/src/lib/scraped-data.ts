/**
 * Scraped Data Loader
 * -------------------
 * Returns real scraped listings when `hydrate.py` has been run, otherwise
 * falls back to the 24-item mock dataset so the app always works.
 *
 * The scraped file lives at:  apps/web/src/data/scraped-listings.json
 * Generate it by running (from project root):
 *   python backend/scrapers/hydrate.py
 *
 * Using require() so webpack bundles the JSON at build time — this works
 * correctly on Vercel serverless (unlike fs.readFileSync which requires
 * outputFileTracingIncludes, an experimental Next.js 14 option).
 *
 * This module runs only on the server (Next.js API routes / Server Components).
 * It MUST NOT be imported from client components.
 */

import { LISTINGS as MOCK_LISTINGS, type MockListing } from "@/app/api/v1/_mock-data";

// eslint-disable-next-line @typescript-eslint/no-require-imports
let _data: MockListing[] = MOCK_LISTINGS;

try {
  // webpack bundles this JSON at build time; falls back to mock if file is absent
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw: unknown = require("@/data/scraped-listings.json");
  if (Array.isArray(raw) && raw.length > 0) {
    _data = raw as MockListing[];
  }
} catch {
  // File not present at build time → use mock data
}

export function getListings(): MockListing[] {
  return _data;
}
