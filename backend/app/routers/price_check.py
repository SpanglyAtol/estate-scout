from fastapi import APIRouter, Depends, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession
import redis.asyncio as aioredis

from app.dependencies import get_db, get_redis
from app.schemas.price_check import PriceCheckRequest, PriceCheckResponse
from app.services.ai_price_service import AiPriceService
from app.services.cache_service import CacheService

router = APIRouter()

# 20 price checks per hour per IP — Claude calls have real cost.
# Cached responses don't incur LLM cost but still count against the limit.
_limiter = Limiter(key_func=get_remote_address)


@router.post("/price-check", response_model=PriceCheckResponse)
@_limiter.limit("20/hour")
async def price_check(
    request: Request,
    body: PriceCheckRequest,
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
):
    """
    AI-powered price estimate for an antique, collectible, or estate sale item.

    Assembles context from three data layers — market_price_index (aggregate
    trends), item_fingerprints (provenance matches), and price_snapshots
    (recent comparable sales) — then uses Claude Opus 4.6 with adaptive
    thinking to reason through a price estimate and asking-price verdict.

    Rate limit: 20 requests / hour per IP. Results are cached for 24 hours.
    """
    cache = CacheService(redis)
    service = AiPriceService(db, cache)
    return await service.check_price(body)
