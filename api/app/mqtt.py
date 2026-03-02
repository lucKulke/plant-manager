import json
import logging
from contextlib import asynccontextmanager
from typing import Any

import aiomqtt

from app.config import settings

logger = logging.getLogger(__name__)

_client: aiomqtt.Client | None = None


@asynccontextmanager
async def mqtt_lifespan():
    global _client
    try:
        async with aiomqtt.Client(
            hostname=settings.mqtt_host,
            port=settings.mqtt_port,
        ) as client:
            _client = client
            logger.info("MQTT connected to %s:%s", settings.mqtt_host, settings.mqtt_port)
            yield
    except Exception:
        logger.warning("MQTT broker not available — running without MQTT")
        _client = None
        yield
    finally:
        _client = None


async def publish(topic: str, payload: dict[str, Any]) -> None:
    if _client is None:
        logger.warning("MQTT not connected, skipping publish to %s", topic)
        return
    message = json.dumps(payload)
    await _client.publish(topic, message)
    logger.info("MQTT published to %s: %s", topic, message)
