import asyncio
import logging

import aiomqtt
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.config import settings
from app.worker.auto import run_auto_check
from app.worker.scheduler import load_schedules, reload_if_changed
from app.worker.telemetry import handle_message

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s [%(name)s] %(message)s",
)
logger = logging.getLogger(__name__)

SUBSCRIBE_TOPICS = [
    "plants/+/tele/moisture_percent",
    "plants/+/state/valve",
    "plants/+/state/led",
    "pump/+/state/pump",
    "pump/+/tele/flow",
    "pump/+/tele/pressure",
]

SCHEDULE_RELOAD_SECONDS = 30
AUTO_CHECK_SECONDS = 60


async def _mqtt_listener(client: aiomqtt.Client) -> None:
    """Subscribe to telemetry topics and dispatch messages."""
    for topic in SUBSCRIBE_TOPICS:
        await client.subscribe(topic)
        logger.info("Subscribed to %s", topic)

    async for message in client.messages:
        topic = str(message.topic)
        payload = message.payload
        if isinstance(payload, (bytes, bytearray)):
            handle_message(topic, bytes(payload))


async def run() -> None:
    logger.info("Worker starting...")

    while True:
        try:
            async with aiomqtt.Client(
                hostname=settings.mqtt_host,
                port=settings.mqtt_port,
            ) as client:
                logger.info("Connected to MQTT broker %s:%s", settings.mqtt_host, settings.mqtt_port)

                # Set up APScheduler
                scheduler = AsyncIOScheduler()

                # Load schedules from DB
                load_schedules(scheduler, client)

                # Periodic schedule reload
                scheduler.add_job(
                    reload_if_changed,
                    "interval",
                    seconds=SCHEDULE_RELOAD_SECONDS,
                    id="schedule_reload",
                    kwargs={"scheduler": scheduler, "mqtt_client": client},
                )

                # Auto-watering check
                scheduler.add_job(
                    run_auto_check,
                    "interval",
                    seconds=AUTO_CHECK_SECONDS,
                    id="auto_check",
                    kwargs={"mqtt_client": client},
                )

                scheduler.start()
                logger.info("APScheduler started")

                try:
                    await _mqtt_listener(client)
                finally:
                    scheduler.shutdown(wait=False)

        except aiomqtt.MqttError as e:
            logger.warning("MQTT connection lost: %s — reconnecting in 5s", e)
            await asyncio.sleep(5)
        except Exception:
            logger.exception("Worker error — restarting in 5s")
            await asyncio.sleep(5)


def main() -> None:
    asyncio.run(run())


if __name__ == "__main__":
    main()
