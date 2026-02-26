"""
Admin-only endpoints.  Requires the `X-Admin-Key` header to match
the ADMIN_SECRET_KEY setting.  These are never exposed in production
docs and are meant for internal use / scripted automation only.

Endpoints:
  GET  /api/v1/admin/stats          → counts for listings, users, alerts
  POST /api/v1/admin/trigger-scrape → fire the scrape job immediately
  POST /api/v1/admin/trigger-alerts → fire the alert-check job immediately
  GET  /api/v1/admin/scheduler      → show APScheduler job next-run times
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Security, status
from fastapi.security import APIKeyHeader
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import engine
from app.dependencies import get_db
from app.models.alert import Alert
from app.models.listing import Listing
from app.models.user import User
from app.scheduler import get_scheduler, run_alerts, run_scrapers

logger = logging.getLogger(__name__)
router = APIRouter()

# ── Admin key auth ─────────────────────────────────────────────────────────────

_admin_key_header = APIKeyHeader(name="X-Admin-Key", auto_error=False)


async def require_admin(api_key: str | None = Security(_admin_key_header)):
    if not settings.admin_secret_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin endpoints are disabled (ADMIN_SECRET_KEY not set).",
        )
    if api_key != settings.admin_secret_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin key.",
        )


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/stats", summary="Database and usage statistics")
async def get_stats(
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_admin),
):
    """Return row counts and key metrics."""
    listing_count = await db.scalar(select(func.count()).select_from(Listing))
    active_listing_count = await db.scalar(
        select(func.count()).select_from(Listing).where(Listing.is_completed == False)  # noqa: E712
    )
    user_count = await db.scalar(select(func.count()).select_from(User))
    pro_user_count = await db.scalar(
        select(func.count()).select_from(User).where(User.tier != "free")
    )
    alert_count = await db.scalar(select(func.count()).select_from(Alert))
    active_alert_count = await db.scalar(
        select(func.count()).select_from(Alert).where(Alert.is_active == True)  # noqa: E712
    )

    # Platform breakdown
    platform_rows = await db.execute(
        text(
            "SELECT p.display_name, COUNT(l.id) as cnt "
            "FROM listings l JOIN platforms p ON l.platform_id = p.id "
            "GROUP BY p.display_name ORDER BY cnt DESC"
        )
    )

    return {
        "listings": {
            "total": listing_count,
            "active": active_listing_count,
            "completed": (listing_count or 0) - (active_listing_count or 0),
        },
        "users": {
            "total": user_count,
            "paid": pro_user_count,
        },
        "alerts": {
            "total": alert_count,
            "active": active_alert_count,
        },
        "by_platform": [
            {"platform": row[0], "count": row[1]} for row in platform_rows
        ],
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/trigger-scrape", summary="Immediately run all scrapers")
async def trigger_scrape(_: None = Depends(require_admin)):
    """
    Fire the scrape job outside the normal schedule.
    Returns immediately; scraping continues in the background.
    """
    import asyncio
    asyncio.create_task(run_scrapers())
    logger.info("Admin triggered scrape job")
    return {"status": "scrape job started", "triggered_at": datetime.now(timezone.utc).isoformat()}


@router.post("/trigger-alerts", summary="Immediately run alert checks")
async def trigger_alerts(_: None = Depends(require_admin)):
    """Fire the alert-check job outside the normal schedule."""
    import asyncio
    asyncio.create_task(run_alerts())
    logger.info("Admin triggered alert check")
    return {"status": "alert check started", "triggered_at": datetime.now(timezone.utc).isoformat()}


@router.get("/scheduler", summary="Show APScheduler job status")
async def scheduler_status(_: None = Depends(require_admin)):
    """List scheduled jobs and their next run times."""
    sched = get_scheduler()
    jobs = []
    for job in sched.get_jobs():
        next_run = job.next_run_time
        jobs.append({
            "id": job.id,
            "name": job.name,
            "next_run_time": next_run.isoformat() if next_run else None,
            "running": sched.running,
        })
    return {
        "scheduler_running": sched.running,
        "jobs": jobs,
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }
