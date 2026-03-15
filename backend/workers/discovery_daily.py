from __future__ import annotations

import json
import subprocess
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2]
DISCOVERY_LISTINGS_PATH = ROOT / "apps" / "web" / "src" / "data" / "scraped-listings-discovery.json"
OUTPUT_DIR = ROOT / "backend" / "scrapers" / "discovery_outputs"
SEEN_SITES_PATH = OUTPUT_DIR / "seen_sites.json"
TASK_QUEUE_JSON_PATH = OUTPUT_DIR / "new_sites_task_queue.json"
TASK_QUEUE_MD_PATH = OUTPUT_DIR / "new_sites_task_queue.md"
RUN_SUMMARY_PATH = OUTPUT_DIR / "last_run_summary.json"


EXISTING_SCRAPER_DOMAIN_HINTS: dict[str, str] = {
    "hibid.com": "hibid",
    "liveauctioneers.com": "liveauctioneers",
    "estatesales.net": "estatesales_net",
    "maxsold.com": "maxsold",
    "bidspotter.com": "bidspotter",
    "ebay.com": "ebay",
    "proxibid.com": "proxibid",
    "1stdibs.com": "1stdibs",
    "ebth.com": "ebth",
    "invaluable.com": "invaluable",
    "auctionzip.com": "auctionzip",
}


@dataclass
class SiteCandidate:
    domain: str
    sample_url: str
    listing_count: int
    recommendation: str
    target_scraper: str | None


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _load_json(path: Path, default):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def _normalize_domain(url: str) -> str:
    domain = urlparse(url).netloc.lower().lstrip("www.")
    return domain


def classify_site(domain: str) -> tuple[str, str | None]:
    for hint, scraper in EXISTING_SCRAPER_DOMAIN_HINTS.items():
        if domain == hint or domain.endswith(f".{hint}"):
            return "extend_existing_scraper", scraper
    return "build_new_adapter", None


def build_site_candidates(listings: list[dict]) -> list[SiteCandidate]:
    by_domain_urls: dict[str, str] = {}
    counts = Counter()
    for row in listings:
        if not isinstance(row, dict):
            continue
        url = str(row.get("external_url") or "").strip()
        if not url.startswith("http"):
            continue
        domain = _normalize_domain(url)
        if not domain:
            continue
        counts[domain] += 1
        by_domain_urls.setdefault(domain, url)

    candidates: list[SiteCandidate] = []
    for domain, listing_count in counts.items():
        recommendation, target = classify_site(domain)
        candidates.append(
            SiteCandidate(
                domain=domain,
                sample_url=by_domain_urls[domain],
                listing_count=listing_count,
                recommendation=recommendation,
                target_scraper=target,
            )
        )

    candidates.sort(key=lambda c: (c.listing_count, c.domain), reverse=True)
    return candidates


def run_discovery_hydration(max_pages: int = 80, max_sites: int = 120) -> None:
    DISCOVERY_LISTINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "python",
        "backend/scrapers/hydrate.py",
        "--targets",
        "dc",
        "--state",
        "",
        "--max-pages",
        str(max_pages),
        "--out",
        str(DISCOVERY_LISTINGS_PATH),
    ]
    # max_sites arg is passed via env for discovery scraper kwargs compatibility in future extensions.
    env = dict(**__import__("os").environ)
    env["DISCOVERY_MAX_SITES"] = str(max_sites)
    subprocess.run(cmd, check=True, cwd=ROOT, env=env)


def generate_outputs() -> dict:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    listings = _load_json(DISCOVERY_LISTINGS_PATH, [])
    candidates = build_site_candidates(listings)

    seen_data = _load_json(SEEN_SITES_PATH, {"sites": {}, "last_run_at": None})
    seen_sites: dict = seen_data.get("sites", {})

    now = _utc_now_iso()
    new_candidates: list[SiteCandidate] = []
    for candidate in candidates:
        if candidate.domain not in seen_sites:
            new_candidates.append(candidate)
            seen_sites[candidate.domain] = {
                "domain": candidate.domain,
                "first_seen_at": now,
                "sample_url": candidate.sample_url,
                "recommendation": candidate.recommendation,
                "target_scraper": candidate.target_scraper,
            }
        else:
            seen_sites[candidate.domain]["last_seen_at"] = now
            seen_sites[candidate.domain]["sample_url"] = candidate.sample_url

    seen_payload = {
        "last_run_at": now,
        "total_known_sites": len(seen_sites),
        "sites": dict(sorted(seen_sites.items())),
    }
    SEEN_SITES_PATH.write_text(json.dumps(seen_payload, indent=2, ensure_ascii=False), encoding="utf-8")

    task_rows = [
        {
            "domain": c.domain,
            "sample_url": c.sample_url,
            "listing_count": c.listing_count,
            "recommendation": c.recommendation,
            "target_scraper": c.target_scraper,
            "task_title": (
                f"Extend scraper '{c.target_scraper}' for {c.domain}"
                if c.target_scraper
                else f"Create new scraper adapter for {c.domain}"
            ),
            "task_description": (
                f"Discovered {c.listing_count} listings from {c.domain}. "
                f"Recommendation: {c.recommendation}."
            ),
        }
        for c in new_candidates
    ]
    TASK_QUEUE_JSON_PATH.write_text(json.dumps(task_rows, indent=2, ensure_ascii=False), encoding="utf-8")

    md_lines = [
        "# Discovery Task Queue",
        "",
        f"Generated at: `{now}`",
        "",
        f"New sites this run: **{len(task_rows)}**",
        f"Total candidate domains in run: **{len(candidates)}**",
        "",
        "## New discovery tasks",
        "",
    ]
    if task_rows:
        md_lines.append("| Domain | Listings | Recommendation | Suggested Task |")
        md_lines.append("|---|---:|---|---|")
        for row in task_rows:
            recommendation = row["recommendation"]
            if row["target_scraper"]:
                recommendation += f" (`{row['target_scraper']}`)"
            md_lines.append(
                f"| `{row['domain']}` | {row['listing_count']} | {recommendation} | {row['task_title']} |"
            )
    else:
        md_lines.append("No newly discovered domains; all candidates already known.")

    TASK_QUEUE_MD_PATH.write_text("\n".join(md_lines) + "\n", encoding="utf-8")

    summary = {
        "run_at": now,
        "total_listings_scraped": len(listings),
        "candidate_domains": len(candidates),
        "new_domains": len(new_candidates),
        "known_domains": len(seen_sites),
        "output_files": {
            "listings": str(DISCOVERY_LISTINGS_PATH.relative_to(ROOT)),
            "seen_sites": str(SEEN_SITES_PATH.relative_to(ROOT)),
            "task_queue_json": str(TASK_QUEUE_JSON_PATH.relative_to(ROOT)),
            "task_queue_md": str(TASK_QUEUE_MD_PATH.relative_to(ROOT)),
        },
    }
    RUN_SUMMARY_PATH.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
    return summary


def main() -> None:
    run_discovery_hydration()
    summary = generate_outputs()
    print(json.dumps(summary, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
