from fastapi import APIRouter, Depends, Query, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_current_user_optional
from app.schemas.listing import ListingOut, ListingSearchParams
from app.services.search_service import SearchService

router = APIRouter()
_limiter = Limiter(key_func=get_remote_address)


@router.get("/", response_model=list[ListingOut])
@_limiter.limit("60/minute")
async def search_listings(
    request: Request,
    q: str | None = Query(None, description="Search text"),
    lat: float | None = Query(None, description="Center latitude for radius search"),
    lon: float | None = Query(None, description="Center longitude for radius search"),
    radius_miles: int = Query(50, ge=1, le=500, description="Search radius in miles"),
    min_price: float | None = Query(None, ge=0),
    max_price: float | None = Query(None),
    pickup_only: bool = Query(False),
    ending_hours: int | None = Query(None, description="Items ending within N hours"),
    category: str | None = Query(None),
    platform_ids: list[int] = Query(default=[]),
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user_optional),
):
    params = ListingSearchParams(
        q=q,
        lat=lat,
        lon=lon,
        radius_miles=radius_miles,
        min_price=min_price,
        max_price=max_price,
        pickup_only=pickup_only,
        ending_hours=ending_hours,
        category=category,
        platform_ids=platform_ids,
        page=page,
        page_size=page_size,
    )
    service = SearchService(db)
    return await service.execute(params)
