from datetime import datetime

from pydantic import BaseModel


class GroupCreate(BaseModel):
    name: str


class GroupUpdate(BaseModel):
    name: str | None = None


class GroupOut(BaseModel):
    id: int
    name: str
    created_at: datetime
    plant_count: int = 0
    pump_name: str | None = None

    model_config = {"from_attributes": True}
