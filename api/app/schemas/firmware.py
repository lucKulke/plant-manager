from datetime import datetime

from pydantic import BaseModel


class FirmwareSettingsOut(BaseModel):
    wifi_ssid: str
    mqtt_broker: str
    mqtt_port: str
    wifi_password_set: bool
    ota_password_set: bool

    model_config = {"from_attributes": True}


class FirmwareSettingsUpdate(BaseModel):
    wifi_ssid: str | None = None
    wifi_password: str | None = None
    mqtt_broker: str | None = None
    mqtt_port: str | None = None
    ota_password: str | None = None


class CompileRequest(BaseModel):
    device_type: str
    device_id: str
    wifi_ssid: str | None = None
    wifi_password: str | None = None
    mqtt_broker: str | None = None
    mqtt_port: str | None = None
    ota_password: str | None = None


class CompileResponse(BaseModel):
    build_id: str
    manifest_url: str


class BuildStatusResponse(BaseModel):
    build_id: str
    status: str  # "compiling" | "done" | "failed"
    error: str | None = None


class FirmwareBuildOut(BaseModel):
    build_id: str
    device_type: str
    device_id: str
    status: str
    error: str | None = None
    manifest_url: str
    created_at: datetime

    model_config = {"from_attributes": True}
