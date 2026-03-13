import json
import logging
from dataclasses import asdict
from datetime import datetime
from pathlib import Path

from scrapers.base import ScrapedListing

logger = logging.getLogger(__name__)


def _try_import_market_services():
    """Lazy import so storage.py works even without the full app context."""
    try:
        from app.services.price_history_service import snapshot_listing
        from app.services.item_fingerprint_service import upsert_fingerprint
        return snapshot_listing, upsert_fingerprint
    except Exception:
        return None, None


def _lot_params(listing_db_id: int, item) -> dict:
    """Build the parameter dict for a listing_lots INSERT/UPSERT."""
    return {
        "listing_id":       listing_db_id,
        "lot_number":       item.lot_number,
        "title":            item.title,
        "description":      item.description,
        "category":         item.category,
        "condition":        item.condition,
        "current_price":    item.current_price,
        "hammer_price":     item.hammer_price,
        "estimate_low":     item.estimate_low,
        "estimate_high":    item.estimate_high,
        "is_completed":     item.is_completed,
        "bid_count":        item.bid_count,
        "sale_ends_at":     item.sale_ends_at,
        "primary_image_url": item.primary_image_url,
        "image_urls":       item.image_urls or [],
        "external_url":     item.external_url,
    }



class ScraperStorage:
    """
    Writes ScrapedListing objects to the database (upsert) and/or JSONL staging file.
    Use JSONL mode for offline development before the DB is set up.
    """

    def __init__(self, db_session=None, jsonl_path: str | None = None):
        self.db = db_session
        self.jsonl_path = jsonl_path
        if jsonl_path:
            Path(jsonl_path).parent.mkdir(parents=True, exist_ok=True)

    async def upsert(self, listing: ScrapedListing) -> bool:
        success = False
        if self.db:
            success = await self._upsert_to_db(listing)
        if self.jsonl_path:
            self._append_to_jsonl(listing)
            success = True
        return success

    async def batch_upsert(self, listings: list[ScrapedListing]) -> int:
        """
        Upsert a batch of listings with a single commit at the end.
        Much faster than calling upsert() per-record over a remote connection.
        Returns count of successfully staged records.
        """
        if not self.db or not listings:
            return 0
        ok = 0
        for listing in listings:
            if await self._upsert_to_db(listing, commit=False):
                ok += 1
        try:
            await self.db.commit()
        except Exception as e:
            logger.error(f"Batch commit failed: {e}")
            await self.db.rollback()
            return 0
        return ok

    async def _upsert_to_db(self, listing: ScrapedListing, commit: bool = True) -> bool:
        from sqlalchemy import text

        try:
            result = await self.db.execute(
                text("SELECT id FROM platforms WHERE name = :slug"),
                {"slug": listing.platform_slug},
            )
            platform_id = result.scalar_one_or_none()
            if not platform_id:
                logger.warning(f"Unknown platform slug: {listing.platform_slug}")
                return False

            id_result = await self.db.execute(
                text("""
                    INSERT INTO listings (
                        platform_id, external_id, external_url, title, description,
                        category, condition,
                        listing_type, item_type, auction_status,
                        current_price, start_price, buy_now_price,
                        buyers_premium_pct, final_price, is_completed, currency,
                        estimate_low, estimate_high,
                        pickup_only, ships_nationally, shipping_estimate,
                        city, state, zip_code, country, latitude, longitude,
                        sale_starts_at, sale_ends_at,
                        primary_image_url, image_urls,
                        maker, brand, collaboration_brands, period, country_of_origin,
                        attributes, raw_data
                    ) VALUES (
                        :platform_id, :external_id, :external_url, :title, :description,
                        :category, :condition,
                        :listing_type, :item_type, :auction_status,
                        :current_price, :start_price, :buy_now_price,
                        :buyers_premium_pct, :final_price, :is_completed, :currency,
                        :estimate_low, :estimate_high,
                        :pickup_only, :ships_nationally, :shipping_estimate,
                        :city, :state, :zip_code, :country, :latitude, :longitude,
                        :sale_starts_at, :sale_ends_at,
                        :primary_image_url, :image_urls,
                        :maker, :brand, :collaboration_brands, :period, :country_of_origin,
                        CAST(:attributes AS jsonb), CAST(:raw_data AS jsonb)
                    )
                    ON CONFLICT (platform_id, external_id)
                    DO UPDATE SET
                        title = EXCLUDED.title,
                        description = EXCLUDED.description,
                        category = EXCLUDED.category,
                        condition = EXCLUDED.condition,
                        listing_type = EXCLUDED.listing_type,
                        auction_status = EXCLUDED.auction_status,
                        current_price = EXCLUDED.current_price,
                        start_price = EXCLUDED.start_price,
                        buy_now_price = EXCLUDED.buy_now_price,
                        buyers_premium_pct = EXCLUDED.buyers_premium_pct,
                        final_price = EXCLUDED.final_price,
                        is_completed = EXCLUDED.is_completed,
                        estimate_low = EXCLUDED.estimate_low,
                        estimate_high = EXCLUDED.estimate_high,
                        pickup_only = EXCLUDED.pickup_only,
                        ships_nationally = EXCLUDED.ships_nationally,
                        shipping_estimate = EXCLUDED.shipping_estimate,
                        city = EXCLUDED.city,
                        state = EXCLUDED.state,
                        zip_code = EXCLUDED.zip_code,
                        latitude = EXCLUDED.latitude,
                        longitude = EXCLUDED.longitude,
                        sale_starts_at = EXCLUDED.sale_starts_at,
                        sale_ends_at = EXCLUDED.sale_ends_at,
                        primary_image_url = EXCLUDED.primary_image_url,
                        image_urls = EXCLUDED.image_urls,
                        maker = EXCLUDED.maker,
                        brand = EXCLUDED.brand,
                        collaboration_brands = EXCLUDED.collaboration_brands,
                        period = EXCLUDED.period,
                        country_of_origin = EXCLUDED.country_of_origin,
                        attributes = EXCLUDED.attributes,
                        raw_data = EXCLUDED.raw_data,
                        updated_at = NOW()
                    RETURNING id
                """),
                {
                    "platform_id": platform_id,
                    "external_id": listing.external_id,
                    "external_url": listing.external_url,
                    "title": listing.title,
                    "description": listing.description,
                    "category": listing.category,
                    "condition": listing.condition,
                    "listing_type": listing.listing_type or "auction",
                    "item_type": listing.item_type or "individual_item",
                    "auction_status": listing.auction_status or "upcoming",
                    "current_price": listing.current_price,
                    "start_price": listing.start_price,
                    "buy_now_price": listing.buy_now_price,
                    "buyers_premium_pct": listing.buyers_premium_pct,
                    "final_price": listing.final_price,
                    "is_completed": listing.is_completed,
                    "currency": listing.currency,
                    "estimate_low": listing.estimate_low,
                    "estimate_high": listing.estimate_high,
                    "pickup_only": listing.pickup_only,
                    "ships_nationally": listing.ships_nationally,
                    "shipping_estimate": listing.shipping_estimate,
                    "city": listing.city,
                    "state": listing.state,
                    "zip_code": listing.zip_code,
                    "country": listing.country,
                    "latitude": listing.latitude,
                    "longitude": listing.longitude,
                    "sale_starts_at": listing.sale_starts_at,
                    "sale_ends_at": listing.sale_ends_at,
                    "primary_image_url": listing.primary_image_url,
                    "image_urls": listing.image_urls,
                    "maker": listing.maker,
                    "brand": listing.brand,
                    "collaboration_brands": listing.collaboration_brands or [],
                    "period": listing.period,
                    "country_of_origin": listing.country_of_origin,
                    "attributes": json.dumps(listing.attributes or {}),
                    "raw_data": json.dumps(listing.raw_data or {}),
                },
            )
            # ── Market price hooks ───────────────────────────────────────────
            # RETURNING id from the upsert avoids a second SELECT round-trip.
            listing_db_id = id_result.scalar_one_or_none()

            if listing_db_id:
                await self._write_market_hooks(listing, listing_db_id, platform_id)
                if listing.items:
                    await self._upsert_lots(listing.items, listing_db_id)

            if commit:
                await self.db.commit()
            return True
        except Exception as e:
            logger.error(f"DB upsert failed for {listing.platform_slug}/{listing.external_id}: {e}")
            await self.db.rollback()
            return False

    async def _upsert_lots(self, items: list, listing_db_id: int) -> None:
        """Write individual lot items to listing_lots table.

        Strategy:
        - Lots WITH a lot_number: ON CONFLICT (listing_id, lot_number) DO UPDATE
          against the partial unique index from migration 0006.
        - Lots WITHOUT a lot_number: delete all unnumbered lots for this listing
          first, then insert fresh — avoids duplicates on re-scrape.

        Failures are logged but never propagate — lot data is supplementary.
        """
        from sqlalchemy import text

        numbered   = [i for i in items if i.lot_number]
        unnumbered = [i for i in items if not i.lot_number]

        # ── delete stale unnumbered lots before re-inserting ─────────────────
        if unnumbered:
            try:
                await self.db.execute(
                    text(
                        "DELETE FROM listing_lots "
                        "WHERE listing_id = :lid AND lot_number IS NULL"
                    ),
                    {"lid": listing_db_id},
                )
            except Exception as exc:
                logger.debug(
                    "delete unnumbered lots failed for listing %s: %s", listing_db_id, exc
                )

        _UPSERT = text("""
            INSERT INTO listing_lots (
                listing_id, lot_number, title, description,
                category, condition,
                current_price, hammer_price, estimate_low, estimate_high,
                is_completed, bid_count, sale_ends_at,
                primary_image_url, image_urls, external_url
            ) VALUES (
                :listing_id, :lot_number, :title, :description,
                :category, :condition,
                :current_price, :hammer_price, :estimate_low, :estimate_high,
                :is_completed, :bid_count, :sale_ends_at,
                :primary_image_url, :image_urls, :external_url
            )
            ON CONFLICT (listing_id, lot_number)
            WHERE lot_number IS NOT NULL
            DO UPDATE SET
                title             = EXCLUDED.title,
                description       = EXCLUDED.description,
                category          = EXCLUDED.category,
                condition         = EXCLUDED.condition,
                current_price     = EXCLUDED.current_price,
                hammer_price      = EXCLUDED.hammer_price,
                estimate_low      = EXCLUDED.estimate_low,
                estimate_high     = EXCLUDED.estimate_high,
                is_completed      = EXCLUDED.is_completed,
                bid_count         = EXCLUDED.bid_count,
                sale_ends_at      = EXCLUDED.sale_ends_at,
                primary_image_url = EXCLUDED.primary_image_url,
                image_urls        = EXCLUDED.image_urls,
                external_url      = EXCLUDED.external_url,
                scraped_at        = NOW()
        """)

        _INSERT = text("""
            INSERT INTO listing_lots (
                listing_id, lot_number, title, description,
                category, condition,
                current_price, hammer_price, estimate_low, estimate_high,
                is_completed, bid_count, sale_ends_at,
                primary_image_url, image_urls, external_url
            ) VALUES (
                :listing_id, :lot_number, :title, :description,
                :category, :condition,
                :current_price, :hammer_price, :estimate_low, :estimate_high,
                :is_completed, :bid_count, :sale_ends_at,
                :primary_image_url, :image_urls, :external_url
            )
        """)

        for item in numbered:
            try:
                await self.db.execute(_UPSERT, _lot_params(listing_db_id, item))
            except Exception as exc:
                logger.debug(
                    "lot upsert failed for listing %s lot %s: %s",
                    listing_db_id, item.lot_number, exc,
                )

        for item in unnumbered:
            try:
                await self.db.execute(_INSERT, _lot_params(listing_db_id, item))
            except Exception as exc:
                logger.debug(
                    "lot insert failed for listing %s: %s", listing_db_id, exc
                )

    async def _write_market_hooks(
        self,
        listing: ScrapedListing,
        listing_db_id: int,
        platform_id: int,
    ) -> None:
        """
        Write price snapshot and (if eligible) item fingerprint for this listing.
        Failures here are logged but never propagate — we don't want a market-hook
        bug to break the core scraping pipeline.
        """
        snapshot_fn, fingerprint_fn = _try_import_market_services()
        if snapshot_fn is None:
            return

        event = (
            "completed" if listing.is_completed and listing.final_price
            else "expired"  if listing.is_completed
            else "created"
        )

        listing_data = {
            "current_price":  listing.current_price,
            "is_completed":   listing.is_completed,
            "final_price":    listing.final_price,
            "estimate_low":   listing.estimate_low,
            "estimate_high":  listing.estimate_high,
            "platform_id":    platform_id,
            "category":       listing.category,
            "sub_category":   listing.attributes.get("sub_category") if listing.attributes else None,
            "maker":          listing.maker,
            "brand":          listing.brand,
            "period":         listing.period,
            "condition":      listing.condition,
        }

        try:
            await snapshot_fn(
                db=self.db,
                listing_id=listing_db_id,
                event_type=event,
                listing_data=listing_data,
            )
        except Exception as exc:
            logger.warning("price snapshot failed for listing %s: %s", listing_db_id, exc)

        if listing.is_completed and listing.final_price and fingerprint_fn:
            try:
                attrs = listing.attributes or {}
                await fingerprint_fn(
                    db=self.db,
                    listing_id=listing_db_id,
                    platform_id=platform_id,
                    title=listing.title,
                    maker=listing.maker,
                    category=listing.category,
                    sub_category=attrs.get("sub_category"),
                    model=attrs.get("model"),
                    material=attrs.get("case_material"),
                    year_approx=attrs.get("year_approx"),
                    attributes=attrs,
                    final_price=listing.final_price,
                    condition=listing.condition,
                    sale_date=listing.sale_ends_at,
                )
            except Exception as exc:
                logger.warning("fingerprint upsert failed for listing %s: %s", listing_db_id, exc)

    # ── Archive methods ───────────────────────────────────────────────────────

    async def batch_archive_ended(self, cutoff_days: int = 2) -> int:
        """
        Find completed/ended public.listings older than ``cutoff_days`` that
        haven't been archived yet, copy them to archive.listings, then set
        archived_at on the public row so the website stops serving them.

        Called by the hourly archive scheduler job.  Returns count archived.
        """
        if not self.db:
            return 0
        from sqlalchemy import text

        try:
            # Fetch rows that need archiving — JOIN platforms for denormalization.
            rows = (await self.db.execute(text("""
                SELECT
                    l.id,
                    l.external_id,       l.external_url,
                    l.title,             l.description,
                    l.category,          l.condition,
                    l.listing_type,      l.item_type,
                    l.final_price,       l.current_price,
                    l.estimate_low,      l.estimate_high,
                    l.buyers_premium_pct, l.currency,
                    l.maker,             l.brand,
                    l.collaboration_brands,
                    l.period,            l.country_of_origin,
                    l.attributes,
                    l.city,              l.state,
                    l.zip_code,          l.latitude,   l.longitude,
                    l.sale_starts_at,    l.sale_ends_at,
                    l.primary_image_url, l.scraped_at,
                    p.name              AS platform_slug,
                    p.display_name      AS platform_display_name,
                    p.base_url          AS platform_base_url
                FROM listings l
                JOIN platforms p ON p.id = l.platform_id
                WHERE l.archived_at IS NULL
                  AND (
                    l.is_completed = true
                    OR (
                      l.sale_ends_at IS NOT NULL
                      AND l.sale_ends_at < NOW() - make_interval(days => :cutoff_days)
                    )
                  )
                LIMIT 2000
            """), {"cutoff_days": cutoff_days})).mappings().all()

            if not rows:
                return 0

            archived_ids: list[int] = []
            for row in rows:
                try:
                    await self.db.execute(text("""
                        INSERT INTO archive.listings (
                            source_listing_id,
                            platform_slug, platform_display_name, platform_base_url,
                            external_id, external_url, title, description,
                            category, condition, listing_type, item_type,
                            final_price, current_price, estimate_low, estimate_high,
                            buyers_premium_pct, currency,
                            maker, brand, collaboration_brands, period,
                            country_of_origin, attributes,
                            city, state, zip_code, latitude, longitude,
                            sale_starts_at, sale_ends_at,
                            primary_image_url, scraped_at
                        ) VALUES (
                            :source_id,
                            :platform_slug, :platform_display_name, :platform_base_url,
                            :external_id, :external_url, :title, :description,
                            :category, :condition, :listing_type, :item_type,
                            :final_price, :current_price, :estimate_low, :estimate_high,
                            :buyers_premium_pct, :currency,
                            :maker, :brand, :collaboration_brands, :period,
                            :country_of_origin, CAST(:attributes AS jsonb),
                            :city, :state, :zip_code, :latitude, :longitude,
                            :sale_starts_at, :sale_ends_at,
                            :primary_image_url, :scraped_at
                        )
                        ON CONFLICT (platform_slug, external_id) DO UPDATE SET
                            final_price   = EXCLUDED.final_price,
                            current_price = EXCLUDED.current_price,
                            maker         = EXCLUDED.maker,
                            attributes    = EXCLUDED.attributes,
                            archived_at   = NOW()
                    """), {
                        "source_id":              row["id"],
                        "platform_slug":          row["platform_slug"],
                        "platform_display_name":  row["platform_display_name"],
                        "platform_base_url":      row["platform_base_url"],
                        "external_id":            row["external_id"],
                        "external_url":           row["external_url"],
                        "title":                  row["title"],
                        "description":            row["description"],
                        "category":               row["category"],
                        "condition":              row["condition"],
                        "listing_type":           row.get("listing_type") or "auction",
                        "item_type":              row.get("item_type") or "individual_item",
                        "final_price":            row["final_price"],
                        "current_price":          row["current_price"],
                        "estimate_low":           row.get("estimate_low"),
                        "estimate_high":          row.get("estimate_high"),
                        "buyers_premium_pct":     row["buyers_premium_pct"],
                        "currency":               row["currency"] or "USD",
                        "maker":                  row.get("maker"),
                        "brand":                  row.get("brand"),
                        "collaboration_brands":   list(row.get("collaboration_brands") or []),
                        "period":                 row.get("period"),
                        "country_of_origin":      row.get("country_of_origin"),
                        "attributes":             json.dumps(
                                                      dict(row["attributes"])
                                                      if row.get("attributes") else {}
                                                  ),
                        "city":                   row["city"],
                        "state":                  row["state"],
                        "zip_code":               row["zip_code"],
                        "latitude":               row["latitude"],
                        "longitude":              row["longitude"],
                        "sale_starts_at":         row["sale_starts_at"],
                        "sale_ends_at":           row["sale_ends_at"],
                        "primary_image_url":      row["primary_image_url"],
                        "scraped_at":             row.get("scraped_at"),
                    })
                    archived_ids.append(row["id"])
                except Exception as row_exc:
                    logger.warning(
                        f"Archive failed for listing {row['id']} "
                        f"({row['platform_slug']}/{row['external_id']}): {row_exc}"
                    )

            if archived_ids:
                await self.db.execute(
                    text("UPDATE listings SET archived_at = NOW() WHERE id = ANY(:ids)"),
                    {"ids": archived_ids},
                )
            await self.db.commit()
            logger.info(f"Archive: moved {len(archived_ids)} ended listings to archive.listings")
            return len(archived_ids)

        except Exception as exc:
            logger.error(f"batch_archive_ended failed: {exc}")
            await self.db.rollback()
            return 0

    def _append_to_jsonl(self, listing: ScrapedListing):
        record = asdict(listing)
        for key in ("sale_starts_at", "sale_ends_at"):
            if isinstance(record.get(key), datetime):
                record[key] = record[key].isoformat()
        with open(self.jsonl_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(record) + "\n")
