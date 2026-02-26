from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from passlib.context import CryptContext
from jose import jwt
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.dependencies import get_db, require_current_user
from app.models.user import User
from app.schemas.user import Token, UserCreate, UserOut

router = APIRouter()

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
_limiter = Limiter(key_func=get_remote_address)

ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days


def _hash_password(password: str) -> str:
    return _pwd_context.hash(password)


def _verify_password(plain: str, hashed: str) -> bool:
    return _pwd_context.verify(plain, hashed)


def _create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
@_limiter.limit("5/hour")
async def register(request: Request, body: UserCreate, db: AsyncSession = Depends(get_db)):
    """Create a new user account and return an access token."""
    # Check duplicate email
    result = await db.execute(select(User).where(User.email == body.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists.",
        )

    user = User(
        email=body.email,
        password_hash=_hash_password(body.password),
        display_name=body.display_name,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return Token(access_token=_create_access_token(str(user.id)))


@router.post("/login", response_model=Token)
@_limiter.limit("10/hour")
async def login(request: Request, body: UserCreate, db: AsyncSession = Depends(get_db)):
    """Authenticate with email + password and return an access token."""
    result = await db.execute(select(User).where(User.email == body.email, User.is_active == True))
    user = result.scalar_one_or_none()

    if not user or not _verify_password(body.password, user.password_hash or ""):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )

    return Token(access_token=_create_access_token(str(user.id)))


@router.get("/me", response_model=UserOut)
async def get_me(current_user=Depends(require_current_user)):
    """Return the currently authenticated user."""
    return current_user
