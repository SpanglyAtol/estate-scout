"""
Catalog router — personal antiques collection tracker.

Endpoints
---------
GET    /api/v1/catalog            List all catalog items for the current user
POST   /api/v1/catalog            Create a new catalog item
GET    /api/v1/catalog/{item_id}  Get a single item
PUT    /api/v1/catalog/{item_id}  Update item details or AI analysis results
DELETE /api/v1/catalog/{item_id}  Delete an item

All endpoints require authentication (Bearer JWT).
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_current_user
from app.models.catalog_item import CatalogItem
from app.schemas.catalog import CatalogItemCreate, CatalogItemOut, CatalogItemUpdate

router = APIRouter()


# ── helpers ───────────────────────────────────────────────────────────────────

async def _get_item_or_404(
    item_id: str,
    user_id: str,
    db: AsyncSession,
) -> CatalogItem:
    result = await db.execute(
        select(CatalogItem).where(
            CatalogItem.id == item_id,
            CatalogItem.user_id == user_id,
        )
    )
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Catalog item not found")
    return item


# ── routes ────────────────────────────────────────────────────────────────────

@router.get("/", response_model=list[CatalogItemOut])
async def list_catalog_items(
    current_user=Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all catalog items for the authenticated user, newest first."""
    result = await db.execute(
        select(CatalogItem)
        .where(CatalogItem.user_id == current_user.id)
        .order_by(CatalogItem.added_at.desc())
    )
    return result.scalars().all()


@router.post("/", response_model=CatalogItemOut, status_code=status.HTTP_201_CREATED)
async def create_catalog_item(
    body: CatalogItemCreate,
    current_user=Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a new item to the user's catalog."""
    item = CatalogItem(
        user_id=current_user.id,
        **body.model_dump(),
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.get("/{item_id}", response_model=CatalogItemOut)
async def get_catalog_item(
    item_id: str,
    current_user=Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fetch a single catalog item by ID."""
    return await _get_item_or_404(item_id, current_user.id, db)


@router.put("/{item_id}", response_model=CatalogItemOut)
async def update_catalog_item(
    item_id: str,
    body: CatalogItemUpdate,
    current_user=Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Update catalog item fields.

    Accepts a partial update — only fields present in the request body
    (excluding None) are applied.  Use this endpoint to:
    - Edit title / description / notes
    - Save AI analysis results returned by the /valuation/query endpoint
    """
    item = await _get_item_or_404(item_id, current_user.id, db)

    patch = body.model_dump(exclude_none=True)

    # If AI analysis data is included, also update last_analyzed_at
    if "ai_analysis" in patch or any(k in patch for k in ("estimate_low", "estimate_mid", "estimate_high")):
        patch["last_analyzed_at"] = datetime.now(timezone.utc)

    for field, value in patch.items():
        setattr(item, field, value)

    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_catalog_item(
    item_id: str,
    current_user=Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove an item from the user's catalog."""
    item = await _get_item_or_404(item_id, current_user.id, db)
    await db.delete(item)
    await db.commit()
