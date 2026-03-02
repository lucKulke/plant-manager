import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_setup_complete
from app.database import get_db
from app.models.plant import Plant
from app.models.pump import Pump
from app.models.watering import WateringEvent
from app.mqtt import publish
from app.schemas.watering import WaterRequest, WateringEventOut

router = APIRouter(
    tags=["watering"],
    dependencies=[Depends(require_setup_complete), Depends(get_current_user)],
)


@router.post(
    "/plants/{plant_id}/water",
    response_model=WateringEventOut,
    status_code=status.HTTP_201_CREATED,
)
async def water_plant(
    plant_id: int,
    body: WaterRequest,
    db: Session = Depends(get_db),
):
    plant = db.query(Plant).filter(Plant.id == plant_id).first()
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")
    if not plant.enabled:
        raise HTTPException(status_code=400, detail="Plant is disabled")

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
        duration_s=body.duration_s,
        reason="MANUAL",
        status="PENDING",
        cmd_id=cmd_id,
    )
    db.add(event)
    db.commit()
    db.refresh(event)

    # Publish MQTT commands
    await publish(
        f"plants/{plant.device_id}/cmd/valve_open",
        {"cmd_id": cmd_id, "open": True, "max_open_s": body.duration_s},
    )

    if pump:
        await publish(
            f"pump/{pump.device_id}/cmd/pump",
            {"cmd_id": cmd_id, "on": True},
        )

    return event


@router.get(
    "/plants/{plant_id}/watering-events",
    response_model=list[WateringEventOut],
)
def list_watering_events(
    plant_id: int,
    limit: int = 20,
    db: Session = Depends(get_db),
):
    plant = db.query(Plant).filter(Plant.id == plant_id).first()
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")

    return (
        db.query(WateringEvent)
        .filter(WateringEvent.plant_id == plant_id)
        .order_by(WateringEvent.ts_start.desc())
        .limit(limit)
        .all()
    )
