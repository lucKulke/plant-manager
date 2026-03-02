from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_setup_complete
from app.database import get_db
from app.models.plant import MoistureReading, Plant, PlantSettings
from app.models.watering import WateringEvent
from app.mqtt import publish
from app.schemas.plant import (
    LedCommandRequest,
    PlantCreate,
    PlantOut,
    PlantSettingsOut,
    PlantSettingsUpdate,
    PlantUpdate,
)

router = APIRouter(
    prefix="/plants",
    tags=["plants"],
    dependencies=[Depends(require_setup_complete), Depends(get_current_user)],
)


def _enrich_plant(plant: Plant, db: Session) -> PlantOut:
    """Add latest_moisture, last_watered_at, and group_name to a plant."""
    out = PlantOut.model_validate(plant)

    if plant.group_id and plant.group:
        out.group_name = plant.group.name

    latest_reading = (
        db.query(MoistureReading)
        .filter(MoistureReading.plant_id == plant.id)
        .order_by(MoistureReading.ts.desc())
        .first()
    )
    if latest_reading:
        out.latest_moisture = latest_reading.moisture_percent

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
        out.last_watered_at = last_event.ts_start

    return out


@router.get("", response_model=list[PlantOut])
def list_plants(db: Session = Depends(get_db)):
    plants = db.query(Plant).all()
    return [_enrich_plant(p, db) for p in plants]


@router.post("", response_model=PlantOut, status_code=status.HTTP_201_CREATED)
def create_plant(body: PlantCreate, db: Session = Depends(get_db)):
    existing = db.query(Plant).filter(Plant.device_id == body.device_id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A plant with this device_id already exists",
        )

    plant = Plant(**body.model_dump())
    db.add(plant)
    db.flush()

    settings = PlantSettings(plant_id=plant.id)
    db.add(settings)
    db.commit()
    db.refresh(plant)
    return plant


@router.get("/{plant_id}", response_model=PlantOut)
def get_plant(plant_id: int, db: Session = Depends(get_db)):
    plant = db.query(Plant).filter(Plant.id == plant_id).first()
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")
    return _enrich_plant(plant, db)


@router.put("/{plant_id}", response_model=PlantOut)
def update_plant(plant_id: int, body: PlantUpdate, db: Session = Depends(get_db)):
    plant = db.query(Plant).filter(Plant.id == plant_id).first()
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")

    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(plant, key, value)

    db.commit()
    db.refresh(plant)
    return plant


@router.delete("/{plant_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_plant(plant_id: int, db: Session = Depends(get_db)):
    plant = db.query(Plant).filter(Plant.id == plant_id).first()
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")

    db.delete(plant)
    db.commit()


@router.get("/{plant_id}/settings", response_model=PlantSettingsOut)
def get_plant_settings(plant_id: int, db: Session = Depends(get_db)):
    settings = db.query(PlantSettings).filter(PlantSettings.plant_id == plant_id).first()
    if not settings:
        raise HTTPException(status_code=404, detail="Plant settings not found")
    return settings


@router.put("/{plant_id}/settings", response_model=PlantSettingsOut)
def update_plant_settings(
    plant_id: int, body: PlantSettingsUpdate, db: Session = Depends(get_db)
):
    settings = db.query(PlantSettings).filter(PlantSettings.plant_id == plant_id).first()
    if not settings:
        raise HTTPException(status_code=404, detail="Plant settings not found")

    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(settings, key, value)

    db.commit()
    db.refresh(settings)
    return settings


@router.post("/{plant_id}/led", status_code=status.HTTP_204_NO_CONTENT)
async def send_led_command(
    plant_id: int, body: LedCommandRequest, db: Session = Depends(get_db)
):
    plant = db.query(Plant).filter(Plant.id == plant_id).first()
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")

    payload: dict = {"mode": body.mode, "brightness": body.brightness}
    if body.mode == "solid" and body.color:
        payload["color"] = body.color
    elif body.mode == "effect" and body.effect:
        payload["effect"] = body.effect

    await publish(f"plants/{plant.device_id}/cmd/led", payload)
