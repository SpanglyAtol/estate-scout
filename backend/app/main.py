import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address
from sqlalchemy import text

from app.config import settings
from app.database import engine
from app.routers import admin, alerts, auth, billing, catalog, health, listings, market, price_check, saved_searches, search, valuation
from app.scheduler import start_scheduler, stop_scheduler

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ── Rate limiter ──────────────────────────────────────────────────────────────
# Key function: use authenticated user ID when available, fallback to IP
def _rate_limit_key(request: Request) -> str:
    """Use bearer token as key so authenticated users share their own quota,
    while anonymous users are keyed by IP."""
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:40]  # first 33 chars of JWT as key (avoids logging full token)
    return get_remote_address(request)


limiter = Limiter(key_func=_rate_limit_key, default_limits=["200/minute"])


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info(f"Starting Estate Scout API [{settings.environment}]")
    async with engine.begin() as conn:
        await conn.execute(text("SELECT 1"))
    logger.info("Database connection verified")
    start_scheduler()
    yield
    # Shutdown
    stop_scheduler()
    await engine.dispose()
    logger.info("Database connection pool closed")


app = FastAPI(
    title="Estate Scout API",
    version="0.1.0",
    description="Estate sale & auction aggregator with AI-powered valuation",
    docs_url="/docs" if settings.environment != "production" else None,
    redoc_url="/redoc" if settings.environment != "production" else None,
    lifespan=lifespan,
)

# Attach limiter to app state so route decorators can access it
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(SlowAPIMiddleware)
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/health", tags=["health"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(listings.router, prefix="/api/v1/listings", tags=["listings"])
app.include_router(search.router, prefix="/api/v1/search", tags=["search"])
app.include_router(valuation.router, prefix="/api/v1/valuation", tags=["valuation"])
app.include_router(saved_searches.router, prefix="/api/v1/saved-searches", tags=["saved-searches"])
app.include_router(alerts.router, prefix="/api/v1/alerts", tags=["alerts"])
app.include_router(billing.router, prefix="/api/v1/billing", tags=["billing"])
app.include_router(catalog.router, prefix="/api/v1/catalog", tags=["catalog"])
app.include_router(market.router)  # prefix defined in the router itself: /api/v1/market
app.include_router(price_check.router, prefix="/api/v1", tags=["price-check"])
# Admin — only included when ADMIN_SECRET_KEY is set
app.include_router(
    admin.router,
    prefix="/api/v1/admin",
    tags=["admin"],
    include_in_schema=settings.environment != "production",
)
