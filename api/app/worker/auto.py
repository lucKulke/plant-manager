import logging
from datetime import datetime, timedelta, timezone

import aiomqtt
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.plant import MoistureReading, Plant, PlantSettings
from app.models.watering import WateringEvent
from app.worker.orchestrator import water_plant

logger = logging.getLogger(__name__)


async def run_auto_check(mqtt_client: aiomqtt.Client) -> None:
    """Check all AUTO-mode plants and trigger watering if moisture is below threshold."""

    db: Session = SessionLocal()
    try:
        settings_list = (
            db.query(PlantSettings)
            .filter(PlantSettings.mode == "AUTO")
            .all()
        )

        for settings in settings_list:
            plant = db.query(Plant).filter(Plant.id == settings.plant_id).first()
            if not plant or not plant.enabled:
                continue

            # Get latest moisture reading
            latest_reading = (
                db.query(MoistureReading)
                .filter(MoistureReading.plant_id == plant.id)
                .order_by(MoistureReading.ts.desc())
                .first()
            )

            if not latest_reading:
                logger.debug("No moisture data for plant %s, skipping auto check", plant.device_id)
                continue

            # Check if moisture is below threshold
            if latest_reading.moisture_percent >= settings.auto_threshold_percent:
                continue

            # Check minimum interval
            last_event = (
                db.query(WateringEvent)
                .filter(
                    WateringEvent.plant_id == plant.id,
                    WateringEvent.status.in_(["PENDING", "OK"]),
                )
                .order_by(WateringEvent.ts_start.desc())
                .first()
            )

            if last_event:
                min_next = last_event.ts_start + timedelta(
                    minutes=settings.auto_min_interval_minutes
                )
                if datetime.now(timezone.utc) < min_next.replace(tzinfo=timezone.utc):
                    logger.debug(
                        "Plant %s: min interval not met, skipping",
                        plant.device_id,
                    )
                    continue

            logger.info(
                "Auto watering plant %s: moisture=%.1f%% < threshold=%.1f%%",
                plant.device_id,
                latest_reading.moisture_percent,
                settings.auto_threshold_percent,
            )

            await water_plant(
                plant_id=plant.id,
                duration_s=settings.auto_watering_seconds,
                reason="AUTO",
                mqtt_client=mqtt_client,
            )

    finally:
        db.close()
