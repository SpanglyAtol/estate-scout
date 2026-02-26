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

    async def _upsert_to_db(self, listing: ScrapedListing) -> bool:
        from sqlalchemy import text

        try:
            # Look up platform ID
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
                        primary_image_url, image_urls, raw_data
                    ) VALUES (
                        :platform_id, :external_id, :external_url, :title, :description,
                        :category, :condition, :current_price, :start_price, :buy_now_price,
                        :buyers_premium_pct, :final_price, :is_completed, :currency,
                        :pickup_only, :ships_nationally, :shipping_estimate,
                        :city, :state, :zip_code, :country, :latitude, :longitude,
                        :sale_starts_at, :sale_ends_at,
                        :primary_image_url, :image_urls, :raw_data
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
                    "raw_data": json.dumps(listing.raw_data),
                },
            )
            await self.db.commit()
            return True
        except Exception as e:
            logger.error(f"DB upsert failed for {listing.platform_slug}/{listing.external_id}: {e}")
            await self.db.rollback()
            return False

    def _append_to_jsonl(self, listing: ScrapedListing):
        record = asdict(listing)
        # Convert datetimes to ISO strings for JSON serialization
        for key in ("sale_starts_at", "sale_ends_at"):
            if isinstance(record.get(key), datetime):
                record[key] = record[key].isoformat()
        with open(self.jsonl_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(record) + "\n")
