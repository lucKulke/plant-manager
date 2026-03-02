from datetime import datetime

from pydantic import BaseModel


class PumpCreate(BaseModel):
    name: str
    device_id: str
    enabled: bool = True
    group_id: int | None = None


class PumpUpdate(BaseModel):
    name: str | None = None
    device_id: str | None = None
    enabled: bool | None = None
    group_id: int | None = None


class PumpReadingOut(BaseModel):
    id: int
    pump_id: int
    ts: datetime
    flow_l_min: float | None
    total_l: float | None
    pressure_bar: float | None

    model_config = {"from_attributes": True}


class PumpOut(BaseModel):
    id: int
    name: str
    device_id: str
    enabled: bool
    created_at: datetime
    group_id: int | None = None
    group_name: str | None = None
    latest_flow_l_min: float | None = None
    latest_pressure_bar: float | None = None

    model_config = {"from_attributes": True}
