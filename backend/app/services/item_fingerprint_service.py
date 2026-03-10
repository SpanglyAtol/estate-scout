"""
Item fingerprint service.

Identifies whether a newly-scraped listing is the same specific item seen
before — across platforms, across time — and maintains a provenance record
with a running price history for that item.

Primary use cases:
  - Limited-edition prints ("1/500"): Was this exact print sold before? At what price?
  - Watches by reference number: "116610LN" Rolex Submariner price trajectory
  - Signed sculptures / unique pieces: track by normalized title + maker + edition

Fingerprint hash = SHA-256 of (maker|title_normalized|edition_string|reference_number)
All fields lowercased, whitespace-normalized before hashing.
"""

from __future__ import annotations

import hashlib
import re
import unicodedata
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.item_fingerprint import FingerprintListing, ItemFingerprint


# ── Text normalization ─────────────────────────────────────────────────────────

def _normalize_text(s: str) -> str:
    """Lowercase, strip accents, collapse whitespace, remove punctuation."""
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.lower()
    s = re.sub(r"[^\w\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


# ── Edition parsing ────────────────────────────────────────────────────────────

_EDITION_RE = re.compile(
    r"""
    \b
    (?:
        (\d+)\s*/\s*(\d+)          # 1/500 or 3 / 25
        | (AP|A\.P\.)\s*(\d+)?(?:\s*/\s*(\d+))?   # AP 3/25 or just AP
        | (HC|H\.C\.)               # Hors commerce
        | (PP|P\.P\.)               # Printer's proof
        | (?:ed(?:ition)?\.?\s+(?:of\s+)?(\d+))   # "edition of 50"
    )
    \b
    """,
    re.IGNORECASE | re.VERBOSE,
)

_REF_RE = re.compile(
    # Common watch reference patterns: 116610LN, 126710BLNR, 5513, etc.
    r"\b([A-Z]?\d{4,6}[A-Z]{0,4})\b"
)


def parse_edition(text: str) -> dict[str, Any]:
    """Extract edition info from a title or description string."""
    result: dict[str, Any] = {
        "edition_string": None,
        "edition_number": None,
        "edition_size": None,
        "edition_type": None,
        "is_limited_edition": False,
    }

    m = _EDITION_RE.search(text)
    if not m:
        return result

    raw = m.group(0).strip()
    result["edition_string"] = raw
    result["is_limited_edition"] = True

    groups = m.groups()
    if groups[0] and groups[1]:           # n/total
        result["edition_number"] = int(groups[0])
        result["edition_size"]   = int(groups[1])
        result["edition_type"]   = "numbered"
    elif groups[2]:                        # AP ...
        result["edition_type"]   = "AP"
        if groups[3]:
            result["edition_number"] = int(groups[3])
        if groups[4]:
            result["edition_size"]   = int(groups[4])
    elif groups[5]:                        # HC
        result["edition_type"] = "HC"
    elif groups[6]:                        # PP
        result["edition_type"] = "PP"
    elif groups[7]:                        # "edition of N"
        result["edition_size"] = int(groups[7])
        result["edition_type"] = "numbered"

    return result


def extract_reference_number(title: str, attributes: dict | None) -> str | None:
    """
    Try to extract a watch reference number.
    First checks enriched attributes.model, then regex on title.
    """
    if attributes:
        ref = attributes.get("reference_number") or attributes.get("ref")
        if ref:
            return str(ref)

    # Regex fallback — only reliable for watches (too noisy for other categories)
    m = _REF_RE.search(title)
    if m:
        candidate = m.group(1)
        # Must be at least 4 chars and contain digits
        if len(candidate) >= 4 and any(c.isdigit() for c in candidate):
            return candidate
    return None


# ── Fingerprint computation ────────────────────────────────────────────────────

def compute_fingerprint_hash(
    *,
    maker: str | None,
    title_normalized: str,
    edition_string: str | None,
    reference_number: str | None,
) -> str:
    """
    Stable SHA-256 hash over the key identity fields.
    Empty / None values are replaced with empty string before hashing.
    """
    parts = [
        (maker or "").lower().strip(),
        title_normalized,
        (edition_string or "").lower().strip(),
        (reference_number or "").upper().strip(),
    ]
    raw = "|".join(parts)
    return hashlib.sha256(raw.encode()).hexdigest()


# ── Eligibility check ──────────────────────────────────────────────────────────

_FINGERPRINT_CATEGORIES = {
    "art", "ceramics", "silver", "jewelry", "watches",
    "coins", "books", "collectibles",
}


def is_fingerprintable(category: str | None, attributes: dict | None, title: str) -> bool:
    """
    Returns True if this listing is worth fingerprinting.
    We fingerprint:
      - Items in supported categories
      - AND has a maker, OR is a limited edition, OR has a reference number
    """
    if category not in _FINGERPRINT_CATEGORIES:
        return False
    if attributes and attributes.get("reference_number"):
        return True
    edition = parse_edition(title)
    if edition["is_limited_edition"]:
        return True
    return False


# ── Main upsert ────────────────────────────────────────────────────────────────

async def upsert_fingerprint(
    *,
    db: AsyncSession,
    listing_id: int,
    platform_id: int | None,
    title: str,
    maker: str | None,
    category: str | None,
    sub_category: str | None,
    model: str | None,
    material: str | None,
    year_approx: int | None,
    attributes: dict | None,
    final_price: float | None,
    condition: str | None,
    sale_date: datetime | None,
) -> str | None:
    """
    Compute the fingerprint for this listing and upsert the identity record.
    Returns the fingerprint_hash if the item was fingerprinted, else None.

    Steps:
      1. Check eligibility
      2. Parse edition + reference number from title / attributes
      3. Compute fingerprint hash
      4. INSERT OR UPDATE item_fingerprints (update price stats + last_seen)
      5. INSERT fingerprint_listings row (the specific auction appearance)
    """
    if not is_fingerprintable(category, attributes, title):
        return None

    attrs = attributes or {}
    title_norm = _normalize_text(title)
    edition    = parse_edition(title)
    ref_num    = extract_reference_number(title, attrs)

    fp_hash = compute_fingerprint_hash(
        maker=maker,
        title_normalized=title_norm,
        edition_string=edition["edition_string"],
        reference_number=ref_num,
    )

    # --- Upsert item_fingerprints ---
    existing = await db.execute(
        select(ItemFingerprint).where(ItemFingerprint.fingerprint_hash == fp_hash)
    )
    fp: ItemFingerprint | None = existing.scalar_one_or_none()

    if fp is None:
        fp = ItemFingerprint(
            id=uuid.uuid4(),
            title_normalized=title_norm,
            maker=maker,
            category=category,
            sub_category=sub_category,
            edition_string=edition["edition_string"],
            edition_number=edition["edition_number"],
            edition_size=edition["edition_size"],
            edition_type=edition["edition_type"],
            is_limited_edition=edition["is_limited_edition"],
            reference_number=ref_num,
            model=model or attrs.get("model"),
            material=material or attrs.get("case_material"),
            year_approx=year_approx or attrs.get("year_approx"),
            fingerprint_hash=fp_hash,
            appearance_count=1,
            first_seen_at=datetime.now(timezone.utc),
            last_seen_at=datetime.now(timezone.utc),
            first_sale_price=final_price,
            last_sale_price=final_price,
            min_sale_price=final_price,
            max_sale_price=final_price,
            avg_sale_price=final_price,
        )
        db.add(fp)
    else:
        # Update running stats
        fp.appearance_count += 1
        fp.last_seen_at      = datetime.now(timezone.utc)

        if final_price is not None:
            if fp.first_sale_price is None:
                fp.first_sale_price = final_price
            fp.last_sale_price = final_price
            prices_seen = [
                p for p in [fp.min_sale_price, fp.max_sale_price, final_price]
                if p is not None
            ]
            fp.min_sale_price = min(prices_seen)
            fp.max_sale_price = max(prices_seen)
            # Rolling average: (old_avg * (n-1) + new) / n
            n = fp.appearance_count
            old_avg = float(fp.avg_sale_price or final_price)
            fp.avg_sale_price = round((old_avg * (n - 1) + final_price) / n, 2)
            # Trend %
            if fp.first_sale_price and float(fp.first_sale_price) > 0:
                fp.price_trend_pct = round(
                    (final_price - float(fp.first_sale_price))
                    / float(fp.first_sale_price)
                    * 100,
                    4,
                )

    # --- Insert fingerprint_listings appearance ---
    # Use INSERT ... ON CONFLICT DO NOTHING — same listing shouldn't appear twice.
    stmt = pg_insert(FingerprintListing).values(
        fingerprint_id=fp.id,
        listing_id=listing_id,
        platform_id=platform_id,
        final_price=final_price,
        condition=condition,
        sale_date=sale_date,
        seen_at=datetime.now(timezone.utc),
    ).on_conflict_do_nothing()
    await db.execute(stmt)

    return fp_hash
