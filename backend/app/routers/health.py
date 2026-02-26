from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_redis
from app.config import settings

router = APIRouter()


@router.get("/")
async def health():
    return {"status": "ok", "environment": settings.environment}


@router.get("/db")
async def health_db(db: AsyncSession = Depends(get_db)):
    try:
        await db.execute(text("SELECT 1"))
        return {"status": "ok", "db": "connected"}
    except Exception as e:
        return {"status": "error", "db": str(e)}


@router.get("/redis")
async def health_redis(redis=Depends(get_redis)):
    try:
        pong = await redis.ping()
        return {"status": "ok", "redis": "connected" if pong else "no response"}
    except Exception as e:
        return {"status": "error", "redis": str(e)}


@router.get("/ai")
async def health_ai():
    from app.services.embedding_service import EmbeddingService
    svc = EmbeddingService()
    return {
        "status": "ok",
        "ai_enabled": svc.is_available,
        "embedding_model": settings.openai_embedding_model if svc.is_available else None,
        "chat_model": settings.openai_chat_model if svc.is_available else None,
    }
