"""
Sponsored placements management endpoints.

Admin endpoints (require X-Admin-Key header):
  GET  /api/v1/sponsored          → list all sponsored placements
  POST /api/v1/sponsored          → create a new placement
  PATCH /api/v1/sponsored/{id}    → update a placement
  DELETE /api/v1/sponsored/{id}   → deactivate a placement

Public tracking endpoints (no auth required):
  POST /api/v1/sponsored/{id}/click → increment click counter
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Security, status
from fastapi.security import APIKeyHeader
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.dependencies import get_db
from app.models.sponsored_placement import SponsoredPlacement

router = APIRouter()

# ── Admin auth ────────────────────────────────────────────────────────────────

_admin_key_header = APIKeyHeader(name="X-Admin-Key", auto_error=False)


async def _require_admin(api_key: str | None = Security(_admin_key_header)) -> None:
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


# ── Schemas ───────────────────────────────────────────────────────────────────

class SponsoredPlacementCreate(BaseModel):
    listing_id: int | None = None
    sponsor_name: str | None = None
    contact_email: str | None = None
    search_keywords: list[str] = []
    categories: list[str] = []
    location_states: list[str] = []
    priority_score: int = 100
    cost_per_day: float | None = None
    starts_at: datetime
    ends_at: datetime


class SponsoredPlacementUpdate(BaseModel):
    search_keywords: list[str] | None = None
    categories: list[str] | None = None
    location_states: list[str] | None = None
    priority_score: int | None = None
    cost_per_day: float | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    is_active: bool | None = None


class SponsoredPlacementOut(BaseModel):
    id: int
    listing_id: int | None
    sponsor_name: str | None
    contact_email: str | None
    search_keywords: list[str]
    categories: list[str]
    location_states: list[str]
    priority_score: int
    cost_per_day: float | None
    starts_at: datetime
    ends_at: datetime
    impressions: int
    clicks: int
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.get("/", response_model=list[SponsoredPlacementOut])
async def list_placements(
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_require_admin),
):
    result = await db.execute(
        select(SponsoredPlacement).order_by(SponsoredPlacement.priority_score.desc())
    )
    return result.scalars().all()


@router.post("/", response_model=SponsoredPlacementOut, status_code=201)
async def create_placement(
    body: SponsoredPlacementCreate,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_require_admin),
):
    placement = SponsoredPlacement(**body.model_dump())
    db.add(placement)
    await db.commit()
    await db.refresh(placement)
    return placement


@router.patch("/{placement_id}", response_model=SponsoredPlacementOut)
async def update_placement(
    placement_id: int,
    body: SponsoredPlacementUpdate,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_require_admin),
):
    result = await db.execute(
        select(SponsoredPlacement).where(SponsoredPlacement.id == placement_id)
    )
    placement = result.scalar_one_or_none()
    if placement is None:
        raise HTTPException(status_code=404, detail="Sponsored placement not found")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(placement, field, value)

    await db.commit()
    await db.refresh(placement)
    return placement


@router.delete("/{placement_id}", status_code=204)
async def deactivate_placement(
    placement_id: int,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_require_admin),
):
    await db.execute(
        update(SponsoredPlacement)
        .where(SponsoredPlacement.id == placement_id)
        .values(is_active=False)
    )
    await db.commit()


@router.post("/{placement_id}/click", status_code=200)
async def track_click(
    placement_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Increment click counter for a sponsored placement (public endpoint)."""
    await db.execute(
        update(SponsoredPlacement)
        .where(SponsoredPlacement.id == placement_id)
        .values(clicks=SponsoredPlacement.clicks + 1)
    )
    await db.commit()
    return {"ok": True}
