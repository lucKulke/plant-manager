from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_setup_complete
from app.database import get_db
from app.models.pump import Pump, PumpReading
from app.schemas.pump import PumpCreate, PumpOut, PumpReadingOut, PumpUpdate

router = APIRouter(
    prefix="/pumps",
    tags=["pumps"],
    dependencies=[Depends(require_setup_complete), Depends(get_current_user)],
)


def _enrich_pump(pump: Pump, db: Session) -> PumpOut:
    out = PumpOut.model_validate(pump)

    if pump.group_id and pump.group:
        out.group_name = pump.group.name

    latest_flow = (
        db.query(PumpReading)
        .filter(PumpReading.pump_id == pump.id, PumpReading.flow_l_min.isnot(None))
        .order_by(PumpReading.ts.desc())
        .first()
    )
    if latest_flow:
        out.latest_flow_l_min = latest_flow.flow_l_min

    latest_pressure = (
        db.query(PumpReading)
        .filter(PumpReading.pump_id == pump.id, PumpReading.pressure_bar.isnot(None))
        .order_by(PumpReading.ts.desc())
        .first()
    )
    if latest_pressure:
        out.latest_pressure_bar = latest_pressure.pressure_bar

    return out


@router.get("", response_model=list[PumpOut])
def list_pumps(db: Session = Depends(get_db)):
    pumps = db.query(Pump).all()
    return [_enrich_pump(p, db) for p in pumps]


@router.post("", response_model=PumpOut, status_code=status.HTTP_201_CREATED)
def create_pump(body: PumpCreate, db: Session = Depends(get_db)):
    existing = db.query(Pump).filter(Pump.device_id == body.device_id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A pump with this device_id already exists",
        )

    # Enforce max 1 pump per group
    if body.group_id:
        existing_pump = (
            db.query(Pump).filter(Pump.group_id == body.group_id).first()
        )
        if existing_pump:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This group already has a pump assigned",
            )

    pump = Pump(**body.model_dump())
    db.add(pump)
    db.commit()
    db.refresh(pump)
    return _enrich_pump(pump, db)


@router.get("/{pump_id}", response_model=PumpOut)
def get_pump(pump_id: int, db: Session = Depends(get_db)):
    pump = db.query(Pump).filter(Pump.id == pump_id).first()
    if not pump:
        raise HTTPException(status_code=404, detail="Pump not found")
    return _enrich_pump(pump, db)


@router.put("/{pump_id}", response_model=PumpOut)
def update_pump(pump_id: int, body: PumpUpdate, db: Session = Depends(get_db)):
    pump = db.query(Pump).filter(Pump.id == pump_id).first()
    if not pump:
        raise HTTPException(status_code=404, detail="Pump not found")

    # Enforce max 1 pump per group on group change
    if body.group_id is not None and body.group_id != pump.group_id:
        existing_pump = (
            db.query(Pump)
            .filter(Pump.group_id == body.group_id, Pump.id != pump_id)
            .first()
        )
        if existing_pump:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This group already has a pump assigned",
            )

    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(pump, key, value)

    db.commit()
    db.refresh(pump)
    return _enrich_pump(pump, db)


@router.delete("/{pump_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_pump(pump_id: int, db: Session = Depends(get_db)):
    pump = db.query(Pump).filter(Pump.id == pump_id).first()
    if not pump:
        raise HTTPException(status_code=404, detail="Pump not found")

    db.delete(pump)
    db.commit()


@router.get("/{pump_id}/readings", response_model=list[PumpReadingOut])
def list_pump_readings(pump_id: int, limit: int = 50, db: Session = Depends(get_db)):
    pump = db.query(Pump).filter(Pump.id == pump_id).first()
    if not pump:
        raise HTTPException(status_code=404, detail="Pump not found")

    return (
        db.query(PumpReading)
        .filter(PumpReading.pump_id == pump_id)
        .order_by(PumpReading.ts.desc())
        .limit(limit)
        .all()
    )
