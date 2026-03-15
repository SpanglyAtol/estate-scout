# Discovery → New Scraper Next Steps

Use this workflow after each daily discovery run.

## 1) Review new domain intake

Primary outputs (available in the workflow artifact `discovery-task-queue` and in local runs):

- `backend/scrapers/discovery_outputs/new_sites_task_queue.md`
- `backend/scrapers/discovery_outputs/new_sites_task_queue.json`
- `backend/scrapers/discovery_outputs/last_run_summary.json`

The JSON includes a recommendation:

- `extend_existing_scraper` → domain likely belongs to a platform you already scrape.
- `build_new_adapter` → domain is likely an independent source and should get a new adapter.

## 2) Create implementation tasks

For each row in `new_sites_task_queue.json`:

1. Create a GitHub issue using `source_onboarding` template.
2. Copy over:
   - domain
   - sample URL
   - listing count
   - recommendation
   - suggested task title

## 3) Execution path by recommendation

### A) `extend_existing_scraper`

- Verify HTML/API shape for the sample URL.
- Add domain-specific mapping/routing to the existing source scraper.
- Add fixture test for that domain shape.

### B) `build_new_adapter`

- Create `backend/scrapers/sources/adapters/<source>_adapter.py`.
- Implement `fetch`, `parse`, `normalize` on `SourceAdapter`.
- Register source in orchestration registry.
- Add canonical contract tests + parser fixture tests.

## 4) Promote stable discoveries

Once a domain is production-stable in a dedicated scraper:

- Add it to the relevant source docs/runbook.
- If needed, add domain to discovery exclusion list to reduce noisy rediscovery.

## 5) Keep discovery efficient

The discovery scraper now suppresses candidate URLs for domains already tracked in:

- `backend/scrapers/discovery_outputs/seen_sites.json`

This keeps daily discovery focused on genuinely new domains.
