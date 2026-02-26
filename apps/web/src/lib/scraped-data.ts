/**
 * Scraped Data Loader
 * -------------------
 * Returns real scraped listings when `hydrate.py` has been run, otherwise
 * falls back to the 24-item mock dataset so the app always works.
 *
 * The scraped file lives at:  apps/web/src/data/scraped-listings.json
 * Generate it by running:
 *   pip install httpx beautifulsoup4 lxml python-dateutil
 *   python backend/scrapers/hydrate.py
 *
 * This module runs only on the server (Next.js API routes / Server Components).
 * It MUST NOT be imported from client components.
 */

import { existsSync, readFileSync } from "fs";
import path from "path";
import { LISTINGS as MOCK_LISTINGS, type MockListing } from "@/app/api/v1/_mock-data";

const SCRAPED_PATH = path.join(process.cwd(), "src", "data", "scraped-listings.json");

let _cache: MockListing[] | null = null;
let _cacheTime = 0;
const CACHE_TTL_MS = 60_000; // re-read file at most once per minute

/**
 * Returns real scraped listings if `hydrate.py` output exists and is valid,
 * otherwise returns the mock dataset. Results are cached for 60 seconds.
 */
export function getListings(): MockListing[] {
  const now = Date.now();

  // Return cached value if fresh
  if (_cache !== null && now - _cacheTime < CACHE_TTL_MS) {
    return _cache;
  }

  if (existsSync(SCRAPED_PATH)) {
    try {
      const raw = readFileSync(SCRAPED_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        _cache = parsed as MockListing[];
        _cacheTime = now;
        return _cache;
      }
    } catch {
      // JSON parse error or empty file — fall through to mock data
    }
  }

  _cache = MOCK_LISTINGS;
  _cacheTime = now;
  return _cache;
}
