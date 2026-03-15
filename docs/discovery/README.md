# Discovery Automation Outputs

The daily discovery workflow writes task-planning artifacts during the run:

- `backend/scrapers/discovery_outputs/seen_sites.json` — persistent dedupe registry of discovered domains (**committed back to git**).
- `backend/scrapers/discovery_outputs/new_sites_task_queue.json` — machine-readable tasks for newly discovered domains (**uploaded as workflow artifact**).
- `backend/scrapers/discovery_outputs/new_sites_task_queue.md` — human-readable task queue (**uploaded as workflow artifact**).
- `backend/scrapers/discovery_outputs/last_run_summary.json` — run-level summary metrics (**uploaded as workflow artifact**).

Workflow: `.github/workflows/discovery-daily.yml`.
Script entrypoint: `backend/workers/discovery_daily.py`.


Operational playbook: `docs/discovery/NEXT_STEPS.md`.
