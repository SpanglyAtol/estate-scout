"""
AI Curation Worker
==================
Uses Claude Haiku to analyse scraped listings and produce:
  1. A hand-curated "Featured Picks" set (12 items across all categories)
  2. Per-category "Top Picks" (up to 4 items per category)
  3. A short editorial narrative for each selected listing

Output: apps/web/src/data/scraped-curated.json

Run manually:
    ANTHROPIC_API_KEY=sk-... python backend/workers/ai_curate.py

Run in GitHub Actions:  see .github/workflows/ai-curate.yml

Cost: ~2 000 tokens / run with Claude Haiku ≈ $0.00050 per run
      At twice-daily runs: ~$0.03/month
"""

import json
import os
import random
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import anthropic

# ── Paths ─────────────────────────────────────────────────────────────────────

ROOT = Path(__file__).resolve().parents[2]   # repo root
DATA_DIR = ROOT / "apps" / "web" / "src" / "data"
OUT_PATH  = DATA_DIR / "scraped-curated.json"

PLATFORM_FILES = [
    DATA_DIR / "scraped-listings-fast.json",
    DATA_DIR / "scraped-listings-estate.json",
    DATA_DIR / "scraped-listings-ebay.json",
    DATA_DIR / "scraped-listings.json",
]

# ── Helpers ────────────────────────────────────────────────────────────────────

def load_listings() -> list[dict]:
    """Load all available platform files, deduplicate, return live listings."""
    raw: list[dict] = []
    seen: set[str] = set()

    for path in PLATFORM_FILES:
        if not path.exists():
            continue
        try:
            data = json.loads(path.read_text())
            if isinstance(data, list):
                raw.extend(data)
        except Exception as e:
            print(f"Warning: could not load {path.name}: {e}", file=sys.stderr)

    if not raw:
        print("No listing files found — nothing to curate.", file=sys.stderr)
        sys.exit(0)

    # Deduplicate
    deduped: list[dict] = []
    for listing in raw:
        key = f"{listing.get('platform', {}).get('name', 'x')}:{listing.get('external_id', listing.get('id'))}"
        if key not in seen:
            seen.add(key)
            deduped.append(listing)

    now_ts = datetime.now(timezone.utc).timestamp() * 1000

    # Keep only listings that have an image and aren't ended
    def is_live(l: dict) -> bool:
        if l.get("is_completed"):
            return False
        ends = l.get("sale_ends_at")
        if ends:
            try:
                end_ts = datetime.fromisoformat(ends.replace("Z", "+00:00")).timestamp() * 1000
                if end_ts < now_ts:
                    return False
            except Exception:
                pass
        return bool(l.get("primary_image_url"))

    return [l for l in deduped if is_live(l)]


def slim(listing: dict) -> dict:
    """Return only the fields Claude needs (keeps prompt small → lower cost)."""
    return {
        "id":          listing.get("id"),
        "title":       listing.get("title", "")[:120],
        "category":    listing.get("category"),
        "description": (listing.get("description") or "")[:200],
        "price":       listing.get("current_price") or listing.get("buy_now_price") or listing.get("estimate_low"),
        "platform":    listing.get("platform", {}).get("display_name"),
        "city":        listing.get("city"),
        "state":       listing.get("state"),
        "listing_type": listing.get("listing_type"),
        "ends":        listing.get("sale_ends_at"),
    }


def build_candidates(listings: list[dict], max_per_category: int = 5) -> list[dict]:
    """
    Sample up to max_per_category items per category so Claude gets diversity.
    Prefer listings with higher prices (proxy for interestingness).
    """
    by_cat: dict[str, list[dict]] = defaultdict(list)
    for l in listings:
        cat = (l.get("category") or "uncategorised").lower()
        by_cat[cat].append(l)

    candidates: list[dict] = []
    for cat, items in by_cat.items():
        # Sort: items with images + higher price first
        sorted_items = sorted(
            items,
            key=lambda x: (
                1 if x.get("primary_image_url") else 0,
                x.get("current_price") or x.get("buy_now_price") or x.get("estimate_low") or 0,
            ),
            reverse=True,
        )
        candidates.extend(sorted_items[:max_per_category])

    # Cap total candidates sent to Claude to keep cost low
    if len(candidates) > 60:
        candidates = random.sample(candidates, 60)

    return candidates


CURATE_PROMPT = """\
You are a senior curator for an upscale antiques and estate sales marketplace called Estate Scout.
Your job is to review a batch of current listings and select the most compelling items for
our "Featured Picks" section — items that will excite collectors, investors, and curious browsers.

Select exactly 12 items as "featured" overall picks and up to 3 items per category as "category_picks".
An item can appear in both lists.

For each selected item write:
- curatorial_note: 1–2 compelling sentences a curator would write (evocative, specific, knowledgeable)
- featured_reason: one of: rare_find | great_value | exceptional_quality | historically_significant | trending_category | unique_provenance

Listings to evaluate:
{listings_json}

Return ONLY a valid JSON object in this exact shape (no markdown, no explanation):
{{
  "featured": [
    {{"id": <number>, "curatorial_note": "...", "featured_reason": "..."}}
  ],
  "category_picks": {{
    "<category_name>": [
      {{"id": <number>, "curatorial_note": "...", "featured_reason": "..."}}
    ]
  }}
}}
"""


def call_claude(candidates: list[dict]) -> dict:
    """Call Claude Haiku with the candidate listings and return parsed JSON."""
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    slim_candidates = [slim(c) for c in candidates]
    prompt = CURATE_PROMPT.format(listings_json=json.dumps(slim_candidates, indent=2))

    msg = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=3000,
        messages=[{"role": "user", "content": prompt}],
    )

    text = msg.content[0].text.strip()

    # Strip any accidental markdown fences
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

    return json.loads(text)


def build_output(listings: list[dict], curated: dict) -> dict:
    """Merge Claude's selections back with full listing data."""
    by_id = {l["id"]: l for l in listings}

    def enrich(sel: dict) -> dict | None:
        listing = by_id.get(sel["id"])
        if not listing:
            return None
        return {
            **listing,
            "curatorial_note": sel.get("curatorial_note", ""),
            "featured_reason": sel.get("featured_reason", ""),
            "is_curated": True,
        }

    featured = [e for s in curated.get("featured", []) if (e := enrich(s))]

    category_picks: dict[str, list] = {}
    for cat, picks in curated.get("category_picks", {}).items():
        enriched = [e for s in picks if (e := enrich(s))]
        if enriched:
            category_picks[cat] = enriched

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "featured":       featured,
        "category_picks": category_picks,
        "total_live_listings": len(listings),
    }


def main() -> None:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("ERROR: ANTHROPIC_API_KEY environment variable is not set.", file=sys.stderr)
        sys.exit(1)

    print("Loading listings…")
    listings = load_listings()
    print(f"  {len(listings)} live listings with images")

    if not listings:
        print("No live listings to curate.")
        sys.exit(0)

    print("Sampling candidates…")
    candidates = build_candidates(listings)
    print(f"  {len(candidates)} candidates sent to Claude")

    print("Calling Claude Haiku…")
    try:
        curated = call_claude(candidates)
    except json.JSONDecodeError as e:
        print(f"ERROR: Claude returned invalid JSON: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"ERROR: Claude API call failed: {e}", file=sys.stderr)
        sys.exit(1)

    n_featured  = len(curated.get("featured", []))
    n_cat_picks = sum(len(v) for v in curated.get("category_picks", {}).values())
    print(f"  {n_featured} featured picks, {n_cat_picks} category picks selected")

    output = build_output(listings, curated)

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(output, indent=2, default=str))
    print(f"✓ Wrote {OUT_PATH}")


if __name__ == "__main__":
    main()
