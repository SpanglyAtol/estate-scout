"""
Stripe billing routes.

Endpoints:
  POST /api/v1/billing/create-checkout-session  → start Stripe Checkout
  POST /api/v1/billing/portal                   → open Customer Portal (manage/cancel)
  POST /api/v1/billing/webhook                  → Stripe webhook handler (no auth)

Environment variables required (all optional; billing degrades gracefully):
  STRIPE_SECRET_KEY
  STRIPE_WEBHOOK_SECRET
  STRIPE_PRO_PRICE_ID       ← price ID from Stripe Dashboard for the Pro plan
  WEB_URL                   ← base URL for success/cancel redirects (default localhost:3000)
"""

import logging
from typing import Annotated

import stripe
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.dependencies import get_db, require_current_user
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter()

# ── Stripe client (lazy init so missing key just disables billing) ─────────────

def _stripe_enabled() -> bool:
    return bool(settings.stripe_secret_key)


def _get_stripe():
    if not _stripe_enabled():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Billing is not configured on this server.",
        )
    stripe.api_key = settings.stripe_secret_key
    return stripe


# ── Schemas ───────────────────────────────────────────────────────────────────

class CheckoutSessionRequest(BaseModel):
    plan: str = "pro"  # "pro" is the only paid plan for now


class CheckoutSessionResponse(BaseModel):
    checkout_url: str


class PortalSessionResponse(BaseModel):
    portal_url: str


# ── Helpers ───────────────────────────────────────────────────────────────────

PLAN_PRICE_IDS: dict[str, str] = {
    "pro": settings.stripe_pro_price_id,
}

WEB_URL = settings.web_url


async def _get_or_create_customer(user: User, db: AsyncSession) -> str:
    """Return the Stripe customer ID for a user, creating one if needed."""
    _get_stripe()  # validates key
    if user.stripe_customer_id:
        return user.stripe_customer_id

    customer = stripe.Customer.create(
        email=user.email,
        name=user.display_name or user.email,
        metadata={"user_id": str(user.id)},
    )
    # Persist immediately
    result = await db.execute(select(User).where(User.id == user.id))
    db_user = result.scalar_one()
    db_user.stripe_customer_id = customer["id"]
    await db.commit()
    return customer["id"]


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post(
    "/create-checkout-session",
    response_model=CheckoutSessionResponse,
    summary="Start a Stripe Checkout session to upgrade tier",
)
async def create_checkout_session(
    body: CheckoutSessionRequest,
    current_user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
):
    s = _get_stripe()

    price_id = PLAN_PRICE_IDS.get(body.plan)
    if not price_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown plan '{body.plan}'. Set STRIPE_PRO_PRICE_ID in your environment.",
        )

    customer_id = await _get_or_create_customer(current_user, db)

    session = s.checkout.Session.create(
        customer=customer_id,
        payment_method_types=["card"],
        line_items=[{"price": price_id, "quantity": 1}],
        mode="subscription",
        success_url=f"{WEB_URL}/pricing?upgrade=success",
        cancel_url=f"{WEB_URL}/pricing?upgrade=cancelled",
        metadata={"user_id": str(current_user.id), "plan": body.plan},
        allow_promotion_codes=True,
        billing_address_collection="auto",
    )

    logger.info(f"Checkout session created for user {current_user.id} (plan={body.plan})")
    return CheckoutSessionResponse(checkout_url=session["url"])


@router.post(
    "/portal",
    response_model=PortalSessionResponse,
    summary="Open Stripe Customer Portal to manage or cancel subscription",
)
async def create_portal_session(
    current_user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
):
    s = _get_stripe()

    if not current_user.stripe_customer_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No billing account found. Subscribe first.",
        )

    portal = s.billing_portal.Session.create(
        customer=current_user.stripe_customer_id,
        return_url=f"{WEB_URL}/pricing",
    )

    return PortalSessionResponse(portal_url=portal["url"])


@router.post(
    "/webhook",
    status_code=status.HTTP_200_OK,
    summary="Stripe webhook receiver (unauthenticated — verified by signature)",
)
async def stripe_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
    stripe_signature: Annotated[str | None, Header(alias="stripe-signature")] = None,
):
    """
    Handles the following Stripe events:
      - checkout.session.completed     → upgrade user tier
      - customer.subscription.deleted  → downgrade user back to free
      - customer.subscription.updated  → sync tier changes (e.g. upgrade/downgrade within portal)
    """
    if not _stripe_enabled():
        return {"received": True}

    stripe.api_key = settings.stripe_secret_key
    payload = await request.body()

    # Verify signature
    try:
        event = stripe.Webhook.construct_event(
            payload, stripe_signature, settings.stripe_webhook_secret
        )
    except stripe.error.SignatureVerificationError:
        logger.warning("Stripe webhook signature verification failed")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid signature")
    except Exception as exc:
        logger.error(f"Stripe webhook error: {exc}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    event_type = event["type"]
    data = event["data"]["object"]

    if event_type == "checkout.session.completed":
        user_id = data.get("metadata", {}).get("user_id")
        plan = data.get("metadata", {}).get("plan", "pro")
        customer_id = data.get("customer")

        if user_id:
            result = await db.execute(select(User).where(User.id == user_id))
            user = result.scalar_one_or_none()
            if user:
                user.tier = plan
                if customer_id:
                    user.stripe_customer_id = customer_id
                await db.commit()
                logger.info(f"User {user_id} upgraded to {plan}")

    elif event_type == "customer.subscription.deleted":
        customer_id = data.get("customer")
        if customer_id:
            result = await db.execute(
                select(User).where(User.stripe_customer_id == customer_id)
            )
            user = result.scalar_one_or_none()
            if user:
                user.tier = "free"
                await db.commit()
                logger.info(f"Subscription cancelled for customer {customer_id} → tier=free")

    elif event_type == "customer.subscription.updated":
        # Handle plan changes made through the customer portal
        customer_id = data.get("customer")
        sub_status = data.get("status")  # "active", "past_due", "canceled", etc.
        if customer_id and sub_status in ("active", "trialing"):
            # Subscription is still active — keep tier as-is
            pass
        elif customer_id and sub_status in ("past_due", "unpaid", "canceled"):
            result = await db.execute(
                select(User).where(User.stripe_customer_id == customer_id)
            )
            user = result.scalar_one_or_none()
            if user and user.tier != "free":
                user.tier = "free"
                await db.commit()
                logger.info(f"Subscription lapsed for customer {customer_id} → tier=free")
    else:
        logger.debug(f"Unhandled Stripe event: {event_type}")

    return {"received": True}
