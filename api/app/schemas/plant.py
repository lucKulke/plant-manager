from datetime import datetime

from pydantic import BaseModel


class PlantCreate(BaseModel):
    name: str
    device_id: str
    enabled: bool = True
    group_id: int | None = None


class PlantUpdate(BaseModel):
    name: str | None = None
    device_id: str | None = None
    enabled: bool | None = None
    group_id: int | None = None


class PlantSettingsOut(BaseModel):
    plant_id: int
    mode: str
    auto_threshold_percent: float
    auto_min_interval_minutes: int
    auto_watering_seconds: int
    updated_at: datetime

    model_config = {"from_attributes": True}


class PlantSettingsUpdate(BaseModel):
    mode: str | None = None
    auto_threshold_percent: float | None = None
    auto_min_interval_minutes: int | None = None
    auto_watering_seconds: int | None = None


class PlantOut(BaseModel):
    id: int
    name: str
    device_id: str
    enabled: bool
    created_at: datetime
    group_id: int | None = None
    group_name: str | None = None
    settings: PlantSettingsOut | None = None
    latest_moisture: float | None = None
    last_watered_at: datetime | None = None

    model_config = {"from_attributes": True}
