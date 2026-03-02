from datetime import datetime

from pydantic import BaseModel


class ScheduleCreate(BaseModel):
    cron_expression: str
    watering_seconds: int = 10
    enabled: bool = True


class ScheduleUpdate(BaseModel):
    cron_expression: str | None = None
    watering_seconds: int | None = None
    enabled: bool | None = None


class ScheduleOut(BaseModel):
    id: int
    plant_id: int
    cron_expression: str
    watering_seconds: int
    enabled: bool
    updated_at: datetime

    model_config = {"from_attributes": True}
