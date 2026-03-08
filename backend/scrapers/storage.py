import json
import logging
from dataclasses import asdict
from datetime import datetime
from pathlib import Path

from scrapers.base import ScrapedListing

logger = logging.getLogger(__name__)


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

            await self.db.execute(
                text("""
                    INSERT INTO listings (
                        platform_id, external_id, external_url, title, description,
                        category, condition, current_price, start_price, buy_now_price,
                        buyers_premium_pct, final_price, is_completed, currency,
                        pickup_only, ships_nationally, shipping_estimate,
                        city, state, zip_code, country, latitude, longitude,
                        sale_starts_at, sale_ends_at,
                        primary_image_url, image_urls,
                        maker, brand, collaboration_brands, period, country_of_origin,
                        attributes, raw_data
                    ) VALUES (
                        :platform_id, :external_id, :external_url, :title, :description,
                        :category, :condition, :current_price, :start_price, :buy_now_price,
                        :buyers_premium_pct, :final_price, :is_completed, :currency,
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
                        current_price = EXCLUDED.current_price,
                        final_price = EXCLUDED.final_price,
                        is_completed = EXCLUDED.is_completed,
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
                """),
                {
                    "platform_id": platform_id,
                    "external_id": listing.external_id,
                    "external_url": listing.external_url,
                    "title": listing.title,
                    "description": listing.description,
                    "category": listing.category,
                    "condition": listing.condition,
                    "current_price": listing.current_price,
                    "start_price": listing.start_price,
                    "buy_now_price": listing.buy_now_price,
                    "buyers_premium_pct": listing.buyers_premium_pct,
                    "final_price": listing.final_price,
                    "is_completed": listing.is_completed,
                    "currency": listing.currency,
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
            if commit:
                await self.db.commit()
            return True
        except Exception as e:
            logger.error(f"DB upsert failed for {listing.platform_slug}/{listing.external_id}: {e}")
            await self.db.rollback()
            return False

    def _append_to_jsonl(self, listing: ScrapedListing):
        record = asdict(listing)
        for key in ("sale_starts_at", "sale_ends_at"):
            if isinstance(record.get(key), datetime):
                record[key] = record[key].isoformat()
        with open(self.jsonl_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(record) + "\n")
