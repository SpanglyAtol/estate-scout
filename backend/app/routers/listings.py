from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies import get_db
from app.models.listing import Listing
from app.schemas.listing import ListingOut

router = APIRouter()


@router.get("/", response_model=list[ListingOut])
async def get_listings(
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    offset = (page - 1) * page_size
    result = await db.execute(
        select(Listing)
        .options(selectinload(Listing.platform))
        .where(Listing.is_active == True, Listing.is_completed == False)  # noqa: E712
        .order_by(Listing.sale_ends_at.asc().nulls_last())
        .offset(offset)
        .limit(page_size)
    )
    return [ListingOut.model_validate(l) for l in result.scalars().all()]


@router.get("/{listing_id}", response_model=ListingOut)
async def get_listing(listing_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Listing)
        .options(selectinload(Listing.platform))
        .where(Listing.id == listing_id)
    )
    listing = result.scalar_one_or_none()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    return ListingOut.model_validate(listing)
