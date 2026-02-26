from datetime import datetime
from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    display_name: str | None = None


class UserOut(BaseModel):
    id: str
    email: str
    display_name: str | None
    tier: str
    valuation_queries_this_month: int
    created_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class SavedSearchCreate(BaseModel):
    name: str
    query_text: str | None = None
    filters: dict = {}
    notify_email: bool = False


class AlertCreate(BaseModel):
    name: str
    query_text: str | None = None
    filters: dict = {}
    max_price: float | None = None
    notify_email: bool = True
    notify_push: bool = False
