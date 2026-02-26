from fastapi import APIRouter, Depends, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession
import redis.asyncio as aioredis

from app.dependencies import get_db, get_redis, get_current_user_optional
from app.schemas.valuation import ValuationRequest, ValuationResponse
from app.services.cache_service import CacheService
from app.services.valuation_service import ValuationService

router = APIRouter()

# Each key (IP or token prefix) gets 10 valuation queries per hour.
# Cached results don't count toward the upstream LLM cost, but we still
# want to cap the volume to avoid abuse and runaway DB load.
_limiter = Limiter(key_func=get_remote_address)


@router.post("/query", response_model=ValuationResponse)
@_limiter.limit("10/hour")
async def get_valuation(
    request: Request,
    body: ValuationRequest,
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
    current_user=Depends(get_current_user_optional),
):
    """
    Return AI-powered valuation (price range + comparable sales) for an item.

    Rate limit: 10 requests / hour per IP (cached responses count against limit
    but are free — no LLM call is made when the cache is warm).
    """
    cache = CacheService(redis)
    service = ValuationService(db, cache)
    return await service.query(body.query_text, body.image_url)
