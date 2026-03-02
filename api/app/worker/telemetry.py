import json
import logging
import re
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.plant import MoistureReading, Plant
from app.models.pump import Pump, PumpReading

logger = logging.getLogger(__name__)

# Topic patterns
MOISTURE_RE = re.compile(r"^plants/([^/]+)/tele/moisture_percent$")
FLOW_RE = re.compile(r"^pump/([^/]+)/tele/flow$")
PRESSURE_RE = re.compile(r"^pump/([^/]+)/tele/pressure$")


def handle_message(topic: str, payload: bytes) -> None:
    try:
        data = json.loads(payload)
    except (json.JSONDecodeError, UnicodeDecodeError):
        logger.warning("Invalid JSON on topic %s", topic)
        return

    m = MOISTURE_RE.match(topic)
    if m:
        _handle_moisture(m.group(1), data)
        return

    m = FLOW_RE.match(topic)
    if m:
        _handle_flow(m.group(1), data)
        return

    m = PRESSURE_RE.match(topic)
    if m:
        _handle_pressure(m.group(1), data)
        return


def _handle_moisture(device_id: str, data: dict) -> None:
    value = data.get("value")
    if value is None:
        return

    db: Session = SessionLocal()
    try:
        plant = db.query(Plant).filter(Plant.device_id == device_id).first()
        if not plant:
            logger.warning("Unknown plant device_id: %s", device_id)
            return

        reading = MoistureReading(
            plant_id=plant.id,
            moisture_percent=float(value),
            ts=datetime.now(timezone.utc),
        )
        db.add(reading)
        db.commit()
        logger.debug("Stored moisture reading: plant=%s value=%.1f%%", device_id, value)
    finally:
        db.close()


def _handle_flow(device_id: str, data: dict) -> None:
    db: Session = SessionLocal()
    try:
        pump = db.query(Pump).filter(Pump.device_id == device_id).first()
        if not pump:
            logger.warning("Unknown pump device_id: %s", device_id)
            return

        reading = PumpReading(
            pump_id=pump.id,
            flow_l_min=data.get("l_min"),
            total_l=data.get("total_l"),
            ts=datetime.now(timezone.utc),
        )
        db.add(reading)
        db.commit()
        logger.debug("Stored flow reading: pump=%s", device_id)
    finally:
        db.close()


def _handle_pressure(device_id: str, data: dict) -> None:
    db: Session = SessionLocal()
    try:
        pump = db.query(Pump).filter(Pump.device_id == device_id).first()
        if not pump:
            logger.warning("Unknown pump device_id: %s", device_id)
            return

        reading = PumpReading(
            pump_id=pump.id,
            pressure_bar=data.get("bar"),
            ts=datetime.now(timezone.utc),
        )
        db.add(reading)
        db.commit()
        logger.debug("Stored pressure reading: pump=%s", device_id)
    finally:
        db.close()
