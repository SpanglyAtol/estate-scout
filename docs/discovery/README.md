# Discovery Automation Outputs

The daily discovery workflow writes task-planning artifacts to:

- `backend/scrapers/discovery_outputs/seen_sites.json` — persistent dedupe registry of discovered domains.
- `backend/scrapers/discovery_outputs/new_sites_task_queue.json` — machine-readable tasks for newly discovered domains.
- `backend/scrapers/discovery_outputs/new_sites_task_queue.md` — human-readable task queue.
- `backend/scrapers/discovery_outputs/last_run_summary.json` — run-level summary metrics.

Workflow: `.github/workflows/discovery-daily.yml`.
Script entrypoint: `backend/workers/discovery_daily.py`.
