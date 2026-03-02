from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_setup_complete
from app.database import get_db
from app.models.group import Group
from app.models.plant import MoistureReading, Plant
from app.models.pump import Pump, PumpReading
from app.models.watering import WateringEvent
from app.schemas.dashboard import (
    DashboardStats,
    MoisturePoint,
    PumpFlowPoint,
    WateringTotal,
)

router = APIRouter(
    prefix="/dashboard",
    tags=["dashboard"],
    dependencies=[Depends(require_setup_complete), Depends(get_current_user)],
)


@router.get("/stats", response_model=DashboardStats)
def get_dashboard_stats(db: Session = Depends(get_db)):
    total_plants = db.query(Plant).count()
    total_groups = db.query(Group).count()
    total_pumps = db.query(Pump).count()

    now = datetime.now(timezone.utc)
    last_24h = now - timedelta(hours=24)
    last_7d = now - timedelta(days=7)

    # Moisture history (last 24h, sampled — latest 200 readings across all plants)
    moisture_rows = (
        db.query(MoistureReading, Plant.name)
        .join(Plant, MoistureReading.plant_id == Plant.id)
        .filter(MoistureReading.ts >= last_24h)
        .order_by(MoistureReading.ts.asc())
        .limit(200)
        .all()
    )
    moisture_history = [
        MoisturePoint(
            ts=reading.ts.isoformat(),
            plant_name=plant_name,
            value=reading.moisture_percent,
        )
        for reading, plant_name in moisture_rows
    ]

    # Watering totals per plant (last 7 days)
    watering_rows = (
        db.query(
            Plant.name,
            func.sum(WateringEvent.duration_s).label("total_duration_s"),
            func.count(WateringEvent.id).label("count"),
        )
        .join(Plant, WateringEvent.plant_id == Plant.id)
        .filter(
            WateringEvent.ts_start >= last_7d,
            WateringEvent.status.in_(["OK", "PENDING"]),
        )
        .group_by(Plant.name)
        .all()
    )
    watering_totals = [
        WateringTotal(
            plant_name=name,
            total_duration_s=total or 0,
            count=count or 0,
        )
        for name, total, count in watering_rows
    ]

    # Pump flow history (last 24h, latest 200 readings)
    flow_rows = (
        db.query(PumpReading, Pump.name)
        .join(Pump, PumpReading.pump_id == Pump.id)
        .filter(
            PumpReading.ts >= last_24h,
            PumpReading.flow_l_min.isnot(None),
        )
        .order_by(PumpReading.ts.asc())
        .limit(200)
        .all()
    )
    pump_flow_history = [
        PumpFlowPoint(
            ts=reading.ts.isoformat(),
            pump_name=pump_name,
            flow_l_min=reading.flow_l_min,
        )
        for reading, pump_name in flow_rows
    ]

    return DashboardStats(
        total_plants=total_plants,
        total_groups=total_groups,
        total_pumps=total_pumps,
        moisture_history=moisture_history,
        watering_totals=watering_totals,
        pump_flow_history=pump_flow_history,
    )
