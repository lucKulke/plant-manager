import asyncio
import json
import logging
import uuid

import aiomqtt
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.plant import Plant
from app.models.pump import Pump
from app.models.watering import WateringEvent

logger = logging.getLogger(__name__)

_lock = asyncio.Lock()


async def water_plant(
    plant_id: int,
    duration_s: int,
    reason: str,
    mqtt_client: aiomqtt.Client,
) -> WateringEvent | None:
    """Execute a full watering sequence: open valve → start pump → wait → stop pump → close valve."""

    if _lock.locked():
        logger.warning("Watering already in progress, skipping plant_id=%s", plant_id)
        return None

    async with _lock:
        db: Session = SessionLocal()
        try:
            plant = db.query(Plant).filter(Plant.id == plant_id).first()
            if not plant or not plant.enabled:
                logger.warning("Plant %s not found or disabled", plant_id)
                return None

            # Use the pump assigned to the plant's group, fall back to first enabled pump
            pump = None
            if plant.group_id:
                pump = (
                    db.query(Pump)
                    .filter(Pump.group_id == plant.group_id, Pump.enabled.is_(True))
                    .first()
                )
            if not pump:
                pump = db.query(Pump).filter(Pump.enabled.is_(True)).first()
            pump_id = pump.id if pump else None
            cmd_id = str(uuid.uuid4())

            event = WateringEvent(
                plant_id=plant_id,
                pump_id=pump_id,
                duration_s=duration_s,
                reason=reason,
                status="PENDING",
                cmd_id=cmd_id,
            )
            db.add(event)
            db.commit()
            db.refresh(event)

            logger.info(
                "Starting watering: plant=%s pump=%s duration=%ss reason=%s cmd=%s",
                plant.device_id,
                pump.device_id if pump else "none",
                duration_s,
                reason,
                cmd_id,
            )

            # 1. Open valve
            await mqtt_client.publish(
                f"plants/{plant.device_id}/cmd/valve_open",
                json.dumps({"cmd_id": cmd_id, "open": True, "max_open_s": duration_s}),
            )

            # 2. Start pump
            if pump:
                await mqtt_client.publish(
                    f"pump/{pump.device_id}/cmd/pump",
                    json.dumps({"cmd_id": cmd_id, "on": True}),
                )

            # 3. Wait for duration
            await asyncio.sleep(duration_s)

            # 4. Stop pump
            if pump:
                await mqtt_client.publish(
                    f"pump/{pump.device_id}/cmd/pump",
                    json.dumps({"cmd_id": cmd_id, "on": False}),
                )

            # 5. Close valve
            await mqtt_client.publish(
                f"plants/{plant.device_id}/cmd/valve_open",
                json.dumps({"cmd_id": cmd_id, "open": False}),
            )

            # 6. Mark event OK
            event.status = "OK"
            db.commit()
            db.refresh(event)

            logger.info("Watering complete: plant=%s cmd=%s", plant.device_id, cmd_id)
            return event

        except Exception:
            logger.exception("Watering failed for plant_id=%s", plant_id)
            try:
                if event:
                    event.status = "FAILED"
                    event.details = "Exception during watering sequence"
                    db.commit()
            except Exception:
                pass
            return None
        finally:
            db.close()
