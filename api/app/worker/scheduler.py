import logging
from datetime import datetime, timezone

import aiomqtt
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.plant import Schedule
from app.worker.orchestrator import water_plant

logger = logging.getLogger(__name__)

_last_reload: datetime | None = None


def _parse_cron(expr: str) -> CronTrigger:
    """Parse a 5-field cron expression into an APScheduler CronTrigger."""
    parts = expr.strip().split()
    if len(parts) != 5:
        raise ValueError(f"Invalid cron expression: {expr}")

    minute, hour, day, month, day_of_week = parts
    return CronTrigger(
        minute=minute,
        hour=hour,
        day=day,
        month=month,
        day_of_week=day_of_week,
    )


def load_schedules(scheduler: AsyncIOScheduler, mqtt_client: aiomqtt.Client) -> None:
    """Load all enabled schedules from the DB and add them as APScheduler jobs."""
    global _last_reload

    db: Session = SessionLocal()
    try:
        schedules = (
            db.query(Schedule)
            .filter(Schedule.enabled.is_(True))
            .all()
        )

        # Remove existing schedule jobs
        existing_jobs = [j for j in scheduler.get_jobs() if j.id.startswith("schedule_")]
        for job in existing_jobs:
            job.remove()

        for sched in schedules:
            job_id = f"schedule_{sched.id}"
            try:
                trigger = _parse_cron(sched.cron_expression)
                scheduler.add_job(
                    water_plant,
                    trigger=trigger,
                    id=job_id,
                    kwargs={
                        "plant_id": sched.plant_id,
                        "duration_s": sched.watering_seconds,
                        "reason": "SCHEDULE",
                        "mqtt_client": mqtt_client,
                    },
                    replace_existing=True,
                )
                logger.info(
                    "Loaded schedule %s: plant_id=%s cron='%s' duration=%ss",
                    sched.id,
                    sched.plant_id,
                    sched.cron_expression,
                    sched.watering_seconds,
                )
            except Exception:
                logger.exception("Failed to load schedule %s", sched.id)

        _last_reload = datetime.now(timezone.utc)
        logger.info("Loaded %d schedule(s)", len(schedules))

    finally:
        db.close()


def reload_if_changed(scheduler: AsyncIOScheduler, mqtt_client: aiomqtt.Client) -> None:
    """Reload schedules if any have been updated since last reload."""
    global _last_reload

    db: Session = SessionLocal()
    try:
        latest_update = (
            db.query(Schedule.updated_at)
            .order_by(Schedule.updated_at.desc())
            .first()
        )

        if latest_update and _last_reload:
            updated_at = latest_update[0]
            if updated_at.replace(tzinfo=timezone.utc) <= _last_reload:
                return

        load_schedules(scheduler, mqtt_client)

    finally:
        db.close()
