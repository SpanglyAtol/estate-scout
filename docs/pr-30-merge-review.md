# PR #30 Merge-Conflict Review Guide

This guide is for resolving merge conflicts around `codex/optimize-github-repo-for-scraper-setup-7kwvik`.

## What this repo history shows

From local git history:

- PR #29 (`codex/optimize-github-repo-for-scraper-setup-hdmtpw`) added the scraper architecture changes (orchestration, normalization, adapter base, idempotency) and discovery workflow updates.
- PR #31 added a focused fix for LiveAuctioneers sitemap fallback + tests.
- These merged PRs also touched generated data files (`apps/web/src/data/*.json`, `backend/scrapers/discovery_outputs/*.json`), which are frequent conflict hotspots.

## How to think about conflict blocks (`<<<<<<<`, `=======`, `>>>>>>>`)

A conflict block means both branches edited overlapping lines.
It does **not** always mean "pick one side only".

Use this rule:

1. **Behavioral Python/TS code** (`backend/scrapers/**/*.py`, `backend/workers/**/*.py`)  
   - Usually needs a **manual merge** (keep both bugfixes + features).
2. **Generated snapshot/data files** (`apps/web/src/data/*.json`, `backend/scrapers/discovery_outputs/*`)  
   - Usually pick **one canonical version** (typically target branch), then regenerate in a follow-up run.
3. **Workflow/docs/templates** (`.github/**`, `docs/**`, `README.md`)  
   - Usually safe to combine unless contradictory.

## Recommended decision for this PR family

If PR #30 overlaps with the same areas as #29/#31:

- Prefer keeping incoming branch changes for:
  - `backend/scrapers/sources/*.py`
  - `backend/scrapers/orchestration/*.py`
  - `backend/scrapers/normalization/*.py`
  - `backend/scrapers/persistence/*.py`
  - `backend/workers/discovery_daily.py`
  - `backend/tests/scrapers/*.py`
- For `apps/web/src/data/scraped-listings-*.json` and `backend/scrapers/discovery_outputs/*.json`, keep one side consistently (usually base branch), then regenerate later.

## Safe conflict-resolution workflow

```bash
git checkout -b review/pr30-merge
# merge candidate branch and resolve conflicts
git merge <branch-or-commit>

# inspect unresolved files
git status

# for each conflicted file
git checkout --ours path/to/file      # keep base version
# or
git checkout --theirs path/to/file    # keep incoming version
# or manually edit to combine both

# verify no conflict markers remain
rg "^(<<<<<<<|=======|>>>>>>>)" -n

# run scraper-focused tests
cd backend && pytest tests/scrapers tests/workers/test_discovery_daily.py
```

## Quick accept/reject heuristic

- **Accept PR #30** if, after conflict resolution, scraper tests pass and it does not regress PR #31 behavior.
- **Request changes / close PR #30** if it reverts architectural files already merged by PR #29, or reintroduces brittle sitemap/discovery behavior fixed later.

## Extra guardrail before merge

Run this to detect accidental rollback of important scraper modules:

```bash
git diff --name-status origin/<base_branch>...HEAD | rg "backend/scrapers|backend/workers/discovery_daily.py|backend/tests/scrapers"
```

If many key files show deletions/replacements, do a manual re-review before merging.
