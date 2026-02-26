from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_current_user
from app.models.saved_search import SavedSearch
from app.schemas.user import SavedSearchCreate

router = APIRouter()


@router.get("/")
async def list_saved_searches(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_current_user),
):
    result = await db.execute(
        select(SavedSearch).where(SavedSearch.user_id == current_user.id)
    )
    return result.scalars().all()


@router.post("/", status_code=201)
async def create_saved_search(
    data: SavedSearchCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_current_user),
):
    saved = SavedSearch(
        user_id=current_user.id,
        name=data.name,
        query_text=data.query_text,
        filters=data.filters,
        notify_email=data.notify_email,
    )
    db.add(saved)
    await db.commit()
    await db.refresh(saved)
    return saved


@router.delete("/{search_id}", status_code=204)
async def delete_saved_search(
    search_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_current_user),
):
    result = await db.execute(
        select(SavedSearch).where(
            SavedSearch.id == search_id, SavedSearch.user_id == current_user.id
        )
    )
    search = result.scalar_one_or_none()
    if not search:
        raise HTTPException(status_code=404, detail="Saved search not found")
    await db.delete(search)
    await db.commit()
