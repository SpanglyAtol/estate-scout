from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_current_user
from app.models.alert import Alert
from app.schemas.user import AlertCreate

router = APIRouter()


@router.get("/")
async def list_alerts(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_current_user),
):
    result = await db.execute(select(Alert).where(Alert.user_id == current_user.id))
    return result.scalars().all()


@router.post("/", status_code=201)
async def create_alert(
    data: AlertCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_current_user),
):
    alert = Alert(
        user_id=current_user.id,
        name=data.name,
        query_text=data.query_text,
        filters=data.filters,
        max_price=data.max_price,
        notify_email=data.notify_email,
        notify_push=data.notify_push,
    )
    db.add(alert)
    await db.commit()
    await db.refresh(alert)
    return alert


@router.patch("/{alert_id}/toggle")
async def toggle_alert(
    alert_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_current_user),
):
    result = await db.execute(
        select(Alert).where(Alert.id == alert_id, Alert.user_id == current_user.id)
    )
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.is_active = not alert.is_active
    await db.commit()
    return {"id": alert.id, "is_active": alert.is_active}


@router.delete("/{alert_id}", status_code=204)
async def delete_alert(
    alert_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_current_user),
):
    result = await db.execute(
        select(Alert).where(Alert.id == alert_id, Alert.user_id == current_user.id)
    )
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    await db.delete(alert)
    await db.commit()
