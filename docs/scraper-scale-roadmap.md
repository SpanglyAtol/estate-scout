# Scraper Scale Roadmap (to 1k → 100k+ listings)

This document defines how we evolve Estate Scout from early-source scraper testing to a reliable, high-volume ingestion platform.

## 1) Repository structure for scale

Keep a strict split between these concerns:

- **Source adapters**: one module per site (request strategy + parsing only)
- **Ingestion orchestration**: queues, retries, backoff, scheduling, and batching
- **Normalization pipeline**: map raw source payloads into a canonical listing schema
- **Persistence layer**: idempotent upsert and dedupe logic
- **Observability**: metrics, health checks, and incident logs

Suggested backend layout (incremental migration):

```text
backend/
  scrapers/
    sources/                  # per-source adapters
    orchestration/            # queue workers, retries, scheduler glue
    normalization/            # canonical mapping + validators
    persistence/              # upsert and dedupe services
    monitoring/               # scrape health, alerts, metrics emitters
```

## 2) GitHub operating model

To support thousands of listings/day, we need repeatable operations, not only code:

1. **Every source gets its own issue stream**
   - Use `source:<name>` labels (example: `source:hibid`, `source:estatesales`).
   - Track blocker patterns (`blocked:captcha`, `blocked:403`, `selector:drift`).
2. **Use templates for consistency**
   - Scraper-failure issues capture URL, HTTP status, selectors, and run ID.
   - Source-onboarding issues enforce a checklist before merge.
3. **PR quality gate**
   - Any scraper PR must include: sample payload, parser test, and expected volume impact.
4. **Milestones by maturity**
   - `M1 Stabilize top 5 sources`
   - `M2 Expand to 20 sources`
   - `M3 National-scale ingestion`

## 3) CI/CD stages to add or tighten

Current workflows already run scheduled scrapes. Next, add hardening stages:

1. **Adapter smoke tests (PR-time)**
   - Fast parser fixture tests for each source adapter.
   - Contract check: required canonical fields exist.
2. **Nightly integration replay**
   - Run adapters against stored raw HTML/API fixtures to detect selector drift.
3. **Data quality checks**
   - Validate duplicate ratio, missing location ratio, and stale listing ratio.
4. **Failure budget alerts**
   - If a source drops below a minimum success rate for N runs, auto-open an incident issue.

## 4) Data model + ingestion policy

For 100k+ listings, preserve source truth and normalized truth separately:

- `raw_listing_events` (append-only snapshots from each source run)
- `normalized_listings` (latest canonical projection)
- `source_runs` (run metadata: duration, success count, failure class, proxy usage)

Policy recommendations:

- **Idempotent upserts** keyed by `(source, external_id)`
- **Soft delete / stale marks** instead of immediate hard deletion
- **Versioned normalizers** so schema evolution does not break historic rows

## 5) Scraper reliability playbook

When a source fails, triage in this order:

1. Transport failure (DNS, TLS, timeout, proxy)
2. Access control (403, bot challenge, geo restrictions)
3. Response shape change (DOM drift / API contract drift)
4. Parsing assumptions (date/price/location format)
5. Persistence conflicts (dedupe, constraints)

Minimum recovery artifact per incident:

- failing URL or endpoint
- response snippet/screenshot (if legal and safe)
- parser stack trace
- recent successful commit SHA
- proposed fix + rollback plan

## 6) Phased execution plan

### Phase A — Stabilize (now)
- Add issue + PR templates (done in this repo).
- Add source ownership labels and runbook references.
- Add fixture-based parser tests for top traffic sources.

### Phase B — Standardize adapters
- Define a source adapter interface (`fetch`, `parse`, `normalize`, `emit_stats`).
- Move source-specific retries out of adapter into orchestration layer.

### Phase C — Throughput scaling
- Shift scheduled monolith jobs to queue-based fan-out workers.
- Partition by source and geography.
- Add incremental crawl cursors and backfill mode.

### Phase D — National coverage
- Build source prioritization by yield/cost/reliability.
- Add continuous monitoring dashboard and incident SLA.

## 7) Success metrics

Track weekly:

- Ingestion volume (new + updated listings)
- Source success rate per run
- Median scrape latency per source
- Duplicate collapse rate
- Freshness (% listings updated within SLA window)

Targets for scale readiness:

- >= 95% success on top sources
- <= 2% hard parser failures/day
- >= 80% listings refreshed within target cadence
