"""
Alert notification service.

Runs periodically to check all active alerts against recently-scraped listings
and sends email notifications when matches are found.

Usage (called by the scheduler or manually):
    from app.services.alert_service import run_alert_checks
    await run_alert_checks(db_session)
"""

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.models.alert import Alert
from app.models.listing import Listing
from app.models.user import User

logger = logging.getLogger(__name__)


# ── Email sending ─────────────────────────────────────────────────────────────

def _build_alert_html(alert_name: str, matches: list[dict]) -> tuple[str, str]:
    """Return (subject, html) for an alert notification email."""
    count = len(matches)
    subject = f"Estate Scout: {count} new match{'es' if count != 1 else ''} for '{alert_name}'"

    items_html = "\n".join(
        f"""
        <tr>
          <td style="padding:10px 0; border-bottom:1px solid #DDD0B8;">
            <a href="{m['url']}" style="color:#8B6914; font-weight:600; text-decoration:none; font-family:Georgia,serif;">
              {m['title']}
            </a><br>
            <small style="color:#6B4F3A; font-size:12px;">
              {m['platform']}
              {' · <strong>${:,.0f}</strong>'.format(m['price']) if m['price'] else ' · No bids yet'}
              {' · +{}% buyer&rsquo;s premium'.format(m['buyers_premium']) if m.get('buyers_premium') else ''}
            </small>
          </td>
        </tr>
        """
        for m in matches[:5]
    )

    html = f"""
    <div style="font-family:Georgia,serif; max-width:560px; margin:0 auto; background:#FDFAF4; padding:32px; border-radius:8px; color:#2C1810;">
      <h2 style="margin:0 0 8px; color:#8B6914; font-size:22px; letter-spacing:0.02em;">
        Estate Scout Alert
      </h2>
      <p style="margin:0 0 20px; color:#6B4F3A; font-size:14px; border-bottom:1px solid #DDD0B8; padding-bottom:16px;">
        <strong>{alert_name}</strong> &mdash;
        {count} new listing{'s' if count != 1 else ''} found
      </p>
      <table style="width:100%; border-collapse:collapse;">
        {items_html}
      </table>
      <p style="margin:24px 0 0;">
        <a href="https://estatescout.app/search?q={alert_name}"
           style="display:inline-block; background:#8B6914; color:#FDFAF4; padding:12px 24px; border-radius:6px;
                  text-decoration:none; font-weight:600; font-size:14px; letter-spacing:0.03em;">
          View All Matches &rarr;
        </a>
      </p>
      <p style="color:#9ca3af; font-size:11px; margin-top:32px; border-top:1px solid #DDD0B8; padding-top:16px;">
        You&apos;re receiving this because you set up an alert on Estate Scout. &nbsp;
        <a href="https://estatescout.app/saved" style="color:#8B6914;">Manage alerts</a>
      </p>
    </div>
    """
    return subject, html


async def send_alert_email(
    to_email: str,
    alert_name: str,
    matches: list[dict],
) -> bool:
    """
    Send alert notification email.
    Tries Resend first (if configured), then falls back to SendGrid.
    Returns True on success, False if neither provider is configured or send fails.
    """
    subject, html = _build_alert_html(alert_name, matches)

    # ── Resend (preferred) ────────────────────────────────────────────────────
    if settings.resend_api_key:
        try:
            import resend  # type: ignore[import-untyped]

            resend.api_key = settings.resend_api_key
            params: resend.Emails.SendParams = {
                "from": f"Estate Scout <{settings.from_email}>",
                "to": [to_email],
                "subject": subject,
                "html": html,
            }
            resp = resend.Emails.send(params)
            logger.info(f"Alert email sent via Resend to {to_email} (id={resp.get('id')})")
            return True
        except Exception as e:
            logger.error(f"Resend send failed for {to_email}: {e}")
            return False

    # ── SendGrid (fallback) ───────────────────────────────────────────────────
    if settings.sendgrid_api_key:
        try:
            import sendgrid  # type: ignore[import-untyped]
            from sendgrid.helpers.mail import Mail

            sg = sendgrid.SendGridAPIClient(api_key=settings.sendgrid_api_key)
            message = Mail(
                from_email=settings.from_email,
                to_emails=to_email,
                subject=subject,
                html_content=html,
            )
            response = sg.send(message)
            logger.info(f"Alert email sent via SendGrid to {to_email} (status {response.status_code})")
            return response.status_code < 300
        except Exception as e:
            logger.error(f"SendGrid send failed for {to_email}: {e}")
            return False

    logger.debug("No email provider configured (RESEND_API_KEY / SENDGRID_API_KEY not set) — skipping alert email")
    return False


# ── Alert matching ────────────────────────────────────────────────────────────

async def _find_matches_for_alert(
    alert: Alert,
    db: AsyncSession,
    since: datetime,
) -> list[dict]:
    """
    Find listings scraped since `since` that match the alert criteria.
    Uses full-text search when query_text is set; price ceiling applied.
    """
    stmt = (
        select(Listing)
        .options(selectinload(Listing.platform))
        .where(
            Listing.is_active == True,  # noqa: E712
            Listing.is_completed == False,  # noqa: E712
            Listing.scraped_at >= since,
        )
    )

    # Full-text match
    if alert.query_text:
        from sqlalchemy import func, text as sqla_text
        tsquery = func.plainto_tsquery("english", alert.query_text)
        stmt = stmt.where(
            Listing.search_vector.op("@@")(tsquery)
        )

    # Price ceiling
    if alert.max_price is not None:
        stmt = stmt.where(Listing.current_price <= alert.max_price)

    # Apply any extra filters stored in the alert's filters JSON
    filters = alert.filters or {}
    if filters.get("pickup_only"):
        stmt = stmt.where(Listing.pickup_only == True)  # noqa: E712
    if filters.get("category"):
        stmt = stmt.where(Listing.category == filters["category"])

    stmt = stmt.limit(20)  # don't send huge batches
    result = await db.execute(stmt)
    listings = result.scalars().all()

    return [
        {
            "id": l.id,
            "title": l.title,
            "url": l.external_url,
            "price": l.current_price,
            "buyers_premium": l.buyers_premium_pct,
            "platform": l.platform.display_name,
        }
        for l in listings
    ]


# ── Main runner ───────────────────────────────────────────────────────────────

async def run_alert_checks(db: AsyncSession) -> int:
    """
    Check all active alerts and send emails where matches are found.
    Returns the number of notifications sent.
    """
    # Look at listings scraped in the last 2 hours (prevents duplicate alerts)
    since = datetime.now(timezone.utc) - timedelta(hours=2)

    # Fetch all active alerts with email notification enabled, joined with user email
    result = await db.execute(
        select(Alert, User.email)
        .join(User, Alert.user_id == User.id)
        .where(
            Alert.is_active == True,  # noqa: E712
            Alert.notify_email == True,
        )
    )
    rows = result.all()
    logger.info(f"Alert check: {len(rows)} active email alerts to check")

    sent_count = 0

    for alert, user_email in rows:
        matches = await _find_matches_for_alert(alert, db, since)
        if not matches:
            continue

        logger.info(f"Alert '{alert.name}' (id={alert.id}): {len(matches)} matches → {user_email}")

        ok = await send_alert_email(
            to_email=user_email,
            alert_name=alert.name,
            matches=matches,
        )

        if ok:
            # Increment trigger count
            await db.execute(
                update(Alert)
                .where(Alert.id == alert.id)
                .values(trigger_count=Alert.trigger_count + len(matches))
            )
            await db.commit()
            sent_count += 1

    logger.info(f"Alert check complete: {sent_count} notifications sent")
    return sent_count
