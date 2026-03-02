import asyncio
import json
import logging

import aiomqtt
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models.plant import Plant
from app.models.pump import Pump

logger = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/plants/{plant_id}/ws")
async def plant_live(websocket: WebSocket, plant_id: int):
    # Look up plant device_id
    db: Session = SessionLocal()
    try:
        plant = db.query(Plant).filter(Plant.id == plant_id).first()
        if not plant:
            await websocket.close(code=4004, reason="Plant not found")
            return
        device_id = plant.device_id
    finally:
        db.close()

    await websocket.accept()

    topics = [
        f"plants/{device_id}/tele/moisture_percent",
        f"plants/{device_id}/state/valve",
        f"plants/{device_id}/availability",
    ]

    try:
        async with aiomqtt.Client(
            hostname=settings.mqtt_host,
            port=settings.mqtt_port,
        ) as mqtt:
            for t in topics:
                await mqtt.subscribe(t)

            async for message in mqtt.messages:
                topic = str(message.topic)
                raw = message.payload
                if isinstance(raw, (bytes, bytearray)):
                    raw = raw.decode()

                # Determine message type and build payload
                if "moisture_percent" in topic:
                    try:
                        data = json.loads(raw)
                        await websocket.send_json({"topic": "moisture", "data": data})
                    except (json.JSONDecodeError, ValueError):
                        pass
                elif "state/valve" in topic:
                    try:
                        data = json.loads(raw)
                        await websocket.send_json({"topic": "valve", "data": data})
                    except (json.JSONDecodeError, ValueError):
                        pass
                elif "availability" in topic:
                    await websocket.send_json({"topic": "availability", "data": {"status": raw}})

    except WebSocketDisconnect:
        logger.debug("WebSocket disconnected for plant %s", plant_id)
    except asyncio.CancelledError:
        pass
    except Exception:
        logger.exception("WebSocket error for plant %s", plant_id)


@router.websocket("/pumps/{pump_id}/ws")
async def pump_live(websocket: WebSocket, pump_id: int):
    db: Session = SessionLocal()
    try:
        pump = db.query(Pump).filter(Pump.id == pump_id).first()
        if not pump:
            await websocket.close(code=4004, reason="Pump not found")
            return
        device_id = pump.device_id
    finally:
        db.close()

    await websocket.accept()

    topics = [
        f"pump/{device_id}/tele/flow",
        f"pump/{device_id}/tele/pressure",
        f"pump/{device_id}/state/pump",
        f"pump/{device_id}/availability",
    ]

    try:
        async with aiomqtt.Client(
            hostname=settings.mqtt_host,
            port=settings.mqtt_port,
        ) as mqtt:
            for t in topics:
                await mqtt.subscribe(t)

            async for message in mqtt.messages:
                topic = str(message.topic)
                raw = message.payload
                if isinstance(raw, (bytes, bytearray)):
                    raw = raw.decode()

                if "tele/flow" in topic:
                    try:
                        data = json.loads(raw)
                        await websocket.send_json({"topic": "flow", "data": data})
                    except (json.JSONDecodeError, ValueError):
                        pass
                elif "tele/pressure" in topic:
                    try:
                        data = json.loads(raw)
                        await websocket.send_json({"topic": "pressure", "data": data})
                    except (json.JSONDecodeError, ValueError):
                        pass
                elif "state/pump" in topic:
                    try:
                        data = json.loads(raw)
                        await websocket.send_json({"topic": "pump", "data": data})
                    except (json.JSONDecodeError, ValueError):
                        pass
                elif "availability" in topic:
                    await websocket.send_json({"topic": "availability", "data": {"status": raw}})

    except WebSocketDisconnect:
        logger.debug("WebSocket disconnected for pump %s", pump_id)
    except asyncio.CancelledError:
        pass
    except Exception:
        logger.exception("WebSocket error for pump %s", pump_id)


@router.websocket("/dashboard/ws")
async def dashboard_live(websocket: WebSocket):
    # Build device_id → name maps for all plants and pumps
    db: Session = SessionLocal()
    try:
        plants = {p.device_id: {"id": p.id, "name": p.name} for p in db.query(Plant).all()}
        pumps = {p.device_id: {"id": p.id, "name": p.name} for p in db.query(Pump).all()}
    finally:
        db.close()

    await websocket.accept()

    topics = [
        "plants/+/tele/moisture_percent",
        "plants/+/state/valve",
        "plants/+/availability",
        "pump/+/tele/flow",
        "pump/+/tele/pressure",
        "pump/+/state/pump",
        "pump/+/availability",
    ]

    try:
        async with aiomqtt.Client(
            hostname=settings.mqtt_host,
            port=settings.mqtt_port,
        ) as mqtt:
            for t in topics:
                await mqtt.subscribe(t)

            async for message in mqtt.messages:
                topic = str(message.topic)
                parts = topic.split("/")
                # parts: ["plants"|"pump", device_id, ...]
                if len(parts) < 3:
                    continue

                device_id = parts[1]
                raw = message.payload
                if isinstance(raw, (bytes, bytearray)):
                    raw = raw.decode()

                # Plant topics
                if parts[0] == "plants":
                    info = plants.get(device_id)
                    if not info:
                        continue
                    if "moisture_percent" in topic:
                        try:
                            data = json.loads(raw)
                            await websocket.send_json({
                                "type": "plant",
                                "device_id": device_id,
                                "name": info["name"],
                                "topic": "moisture",
                                "data": data,
                            })
                        except (json.JSONDecodeError, ValueError):
                            pass
                    elif "state/valve" in topic:
                        try:
                            data = json.loads(raw)
                            await websocket.send_json({
                                "type": "plant",
                                "device_id": device_id,
                                "name": info["name"],
                                "topic": "valve",
                                "data": data,
                            })
                        except (json.JSONDecodeError, ValueError):
                            pass
                    elif "availability" in topic:
                        await websocket.send_json({
                            "type": "plant",
                            "device_id": device_id,
                            "name": info["name"],
                            "topic": "availability",
                            "data": {"status": raw},
                        })

                # Pump topics
                elif parts[0] == "pump":
                    info = pumps.get(device_id)
                    if not info:
                        continue
                    if "tele/flow" in topic:
                        try:
                            data = json.loads(raw)
                            await websocket.send_json({
                                "type": "pump",
                                "device_id": device_id,
                                "name": info["name"],
                                "topic": "flow",
                                "data": data,
                            })
                        except (json.JSONDecodeError, ValueError):
                            pass
                    elif "tele/pressure" in topic:
                        try:
                            data = json.loads(raw)
                            await websocket.send_json({
                                "type": "pump",
                                "device_id": device_id,
                                "name": info["name"],
                                "topic": "pressure",
                                "data": data,
                            })
                        except (json.JSONDecodeError, ValueError):
                            pass
                    elif "state/pump" in topic:
                        try:
                            data = json.loads(raw)
                            await websocket.send_json({
                                "type": "pump",
                                "device_id": device_id,
                                "name": info["name"],
                                "topic": "pump",
                                "data": data,
                            })
                        except (json.JSONDecodeError, ValueError):
                            pass
                    elif "availability" in topic:
                        await websocket.send_json({
                            "type": "pump",
                            "device_id": device_id,
                            "name": info["name"],
                            "topic": "availability",
                            "data": {"status": raw},
                        })

    except WebSocketDisconnect:
        logger.debug("Dashboard WebSocket disconnected")
    except asyncio.CancelledError:
        pass
    except Exception:
        logger.exception("Dashboard WebSocket error")
