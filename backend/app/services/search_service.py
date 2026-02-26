import logging
import math
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.listing import Listing
from app.models.platform import Platform
from app.schemas.listing import ListingOut, ListingSearchParams

logger = logging.getLogger(__name__)


class SearchService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def execute(self, params: ListingSearchParams) -> list[ListingOut]:
        query = (
            select(Listing)
            .options(selectinload(Listing.platform))
            .where(Listing.is_active == True)  # noqa: E712
        )

        # Full-text search
        if params.q:
            query = query.where(
                Listing.search_vector.op("@@")(
                    text(f"to_tsquery('english', :q)").bindparams(
                        q=" & ".join(params.q.split()[:15])
                    )
                )
            )

        # Price filters
        if params.min_price is not None:
            query = query.where(Listing.current_price >= params.min_price)
        if params.max_price is not None:
            query = query.where(Listing.current_price <= params.max_price)

        # Pickup only
        if params.pickup_only:
            query = query.where(Listing.pickup_only == True)  # noqa: E712

        # Ending soon
        if params.ending_hours is not None:
            cutoff = datetime.now(timezone.utc) + timedelta(hours=params.ending_hours)
            query = query.where(
                and_(
                    Listing.sale_ends_at != None,  # noqa: E711
                    Listing.sale_ends_at <= cutoff,
                    Listing.sale_ends_at > datetime.now(timezone.utc),
                )
            )

        # Category
        if params.category:
            query = query.where(Listing.category.ilike(f"%{params.category}%"))

        # Platform filter
        if params.platform_ids:
            query = query.where(Listing.platform_id.in_(params.platform_ids))

        # Only active (not completed) listings by default
        query = query.where(Listing.is_completed == False)  # noqa: E712

        # Ordering: ending soonest first (if no text search), else relevance
        if not params.q:
            query = query.order_by(Listing.sale_ends_at.asc().nulls_last())

        # Pagination
        offset = (params.page - 1) * params.page_size
        query = query.offset(offset).limit(params.page_size)

        result = await self.db.execute(query)
        listings = result.scalars().all()

        outputs = []
        for listing in listings:
            out = ListingOut.model_validate(listing)
            # Compute distance if location provided
            if params.lat is not None and params.lon is not None:
                if listing.latitude is not None and listing.longitude is not None:
                    out.distance_miles = self._haversine(
                        params.lat, params.lon,
                        float(listing.latitude), float(listing.longitude)
                    )
                    # Filter by radius
                    if out.distance_miles > params.radius_miles:
                        continue
            outputs.append(out)

        return outputs

    @staticmethod
    def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        R = 3958.8  # Earth radius in miles
        phi1, phi2 = math.radians(lat1), math.radians(lat2)
        dphi = math.radians(lat2 - lat1)
        dlambda = math.radians(lon2 - lon1)
        a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
