from datetime import datetime

from pydantic import BaseModel


class WaterRequest(BaseModel):
    duration_s: int = 10


class WateringEventOut(BaseModel):
    id: int
    plant_id: int
    pump_id: int | None
    ts_start: datetime
    duration_s: int
    target_l: float | None
    reason: str
    status: str
    cmd_id: str
    details: str | None

    model_config = {"from_attributes": True}
