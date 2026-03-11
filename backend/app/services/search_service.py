import logging
import math
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.listing import Listing
from app.models.sponsored_placement import SponsoredPlacement
from app.schemas.listing import ListingOut, ListingSearchParams

logger = logging.getLogger(__name__)


class SearchService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def execute(self, params: ListingSearchParams) -> list[ListingOut]:
        query = (
            select(Listing)
            .options(selectinload(Listing.platform))
            .where(
                Listing.is_active == True,      # noqa: E712
                Listing.archived_at.is_(None),
            )
        )

        # Full-text search — websearch_to_tsquery handles natural language phrases
        if params.q:
            query = query.where(
                Listing.search_vector.op("@@")(
                    func.websearch_to_tsquery("english", params.q)
                )
            )

        # Geo-radius filter in SQL so LIMIT is applied AFTER geo filtering
        if params.lat is not None and params.lon is not None:
            haversine = _haversine_expr(params.lat, params.lon)
            query = query.where(
                Listing.latitude.is_not(None),
                Listing.longitude.is_not(None),
                haversine <= params.radius_miles,
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

        # Listing type (estate_sale / auction / individual_item)
        if params.listing_type:
            query = query.where(Listing.listing_type == params.listing_type)

        # Platform filter
        if params.platform_ids:
            query = query.where(Listing.platform_id.in_(params.platform_ids))

        # Only active (not completed) listings by default
        query = query.where(Listing.is_completed == False)  # noqa: E712

        # Ordering
        if params.lat is not None and params.lon is not None:
            query = query.order_by(_haversine_expr(params.lat, params.lon).asc())
        elif not params.q:
            query = query.order_by(Listing.sale_ends_at.asc().nulls_last())

        # Pagination
        offset = (params.page - 1) * params.page_size
        query = query.offset(offset).limit(params.page_size)

        result = await self.db.execute(query)
        listings = result.scalars().all()

        outputs = []
        for listing in listings:
            out = ListingOut.model_validate(listing)
            if params.lat is not None and params.lon is not None:
                if listing.latitude is not None and listing.longitude is not None:
                    out.distance_miles = _haversine_py(
                        params.lat, params.lon,
                        float(listing.latitude), float(listing.longitude),
                    )
            outputs.append(out)

        # Prepend sponsored listings that match the query context
        sponsored = await self._fetch_sponsored(params)
        return sponsored + outputs

    async def _fetch_sponsored(self, params: ListingSearchParams) -> list[ListingOut]:
        """Return active sponsored placements that match the search context."""
        now = datetime.now(timezone.utc)
        sp_q = (
            select(SponsoredPlacement)
            .where(
                SponsoredPlacement.is_active == True,  # noqa: E712
                SponsoredPlacement.starts_at <= now,
                SponsoredPlacement.ends_at >= now,
                SponsoredPlacement.listing_id.is_not(None),
            )
            .order_by(SponsoredPlacement.priority_score.desc())
            .limit(3)
        )

        if params.q:
            q_words = [w.lower() for w in params.q.split() if w]
            if q_words:
                sp_q = sp_q.where(
                    or_(
                        func.cardinality(SponsoredPlacement.search_keywords) == 0,
                        SponsoredPlacement.search_keywords.overlap(q_words),
                    )
                )

        if params.category:
            sp_q = sp_q.where(
                or_(
                    func.cardinality(SponsoredPlacement.categories) == 0,
                    SponsoredPlacement.categories.overlap([params.category]),
                )
            )

        sp_result = await self.db.execute(sp_q)
        placements = sp_result.scalars().all()
        if not placements:
            return []

        listing_ids = [p.listing_id for p in placements]
        lst_result = await self.db.execute(
            select(Listing)
            .options(selectinload(Listing.platform))
            .where(
                Listing.id.in_(listing_ids),
                Listing.is_active == True,  # noqa: E712
                Listing.archived_at.is_(None),
            )
        )
        listings_by_id = {lst.id: lst for lst in lst_result.scalars().all()}

        # Bump impression counters (fire-and-forget style)
        if placements:
            await self.db.execute(
                update(SponsoredPlacement)
                .where(SponsoredPlacement.id.in_([p.id for p in placements]))
                .values(impressions=SponsoredPlacement.impressions + 1)
            )
            await self.db.commit()

        outputs = []
        for placement in placements:
            listing = listings_by_id.get(placement.listing_id)
            if not listing:
                continue
            out = ListingOut.model_validate(listing)
            out.is_sponsored = True
            if params.lat is not None and params.lon is not None:
                if listing.latitude is not None and listing.longitude is not None:
                    out.distance_miles = _haversine_py(
                        params.lat, params.lon,
                        float(listing.latitude), float(listing.longitude),
                    )
            outputs.append(out)

        return outputs


# ── Helpers ───────────────────────────────────────────────────────────────────

def _haversine_expr(lat: float, lon: float):
    """SQLAlchemy expression for Haversine distance (miles) from a fixed point."""
    return (
        3958.8
        * 2
        * func.asin(
            func.sqrt(
                func.power(func.sin(func.radians((lat - Listing.latitude) / 2)), 2)
                + func.cos(func.radians(lat))
                * func.cos(func.radians(Listing.latitude))
                * func.power(func.sin(func.radians((lon - Listing.longitude) / 2)), 2)
            )
        )
    )


def _haversine_py(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 3958.8
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
