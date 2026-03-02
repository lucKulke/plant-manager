from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_setup_complete
from app.database import get_db
from app.models.group import Group
from app.models.plant import Plant
from app.models.pump import Pump
from app.schemas.group import GroupCreate, GroupOut, GroupUpdate

router = APIRouter(
    prefix="/groups",
    tags=["groups"],
    dependencies=[Depends(require_setup_complete), Depends(get_current_user)],
)


def _enrich_group(group: Group, db: Session) -> GroupOut:
    plant_count = db.query(Plant).filter(Plant.group_id == group.id).count()
    pump = db.query(Pump).filter(Pump.group_id == group.id).first()
    return GroupOut(
        id=group.id,
        name=group.name,
        created_at=group.created_at,
        plant_count=plant_count,
        pump_name=pump.name if pump else None,
    )


@router.get("", response_model=list[GroupOut])
def list_groups(db: Session = Depends(get_db)):
    groups = db.query(Group).all()
    return [_enrich_group(g, db) for g in groups]


@router.post("", response_model=GroupOut, status_code=status.HTTP_201_CREATED)
def create_group(body: GroupCreate, db: Session = Depends(get_db)):
    group = Group(**body.model_dump())
    db.add(group)
    db.commit()
    db.refresh(group)
    return _enrich_group(group, db)


@router.get("/{group_id}", response_model=GroupOut)
def get_group(group_id: int, db: Session = Depends(get_db)):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    return _enrich_group(group, db)


@router.put("/{group_id}", response_model=GroupOut)
def update_group(group_id: int, body: GroupUpdate, db: Session = Depends(get_db)):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(group, key, value)

    db.commit()
    db.refresh(group)
    return _enrich_group(group, db)


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_group(group_id: int, db: Session = Depends(get_db)):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    # Nullify FKs on plants and pumps instead of deleting them
    db.query(Plant).filter(Plant.group_id == group_id).update(
        {Plant.group_id: None}
    )
    db.query(Pump).filter(Pump.group_id == group_id).update(
        {Pump.group_id: None}
    )

    db.delete(group)
    db.commit()
