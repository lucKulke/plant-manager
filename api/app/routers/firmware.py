import httpx
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_setup_complete
from app.database import get_db
from app.models.firmware_settings import FirmwareSettings
from app.schemas.firmware import (
    CompileRequest,
    CompileResponse,
    FirmwareSettingsOut,
    FirmwareSettingsUpdate,
)

FIRMWARE_SERVICE_URL = "http://firmware:5000"

router = APIRouter(
    prefix="/firmware",
    tags=["firmware"],
)


def _get_or_create_settings(db: Session) -> FirmwareSettings:
    row = db.query(FirmwareSettings).filter(FirmwareSettings.id == 1).first()
    if not row:
        row = FirmwareSettings(id=1)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def _settings_out(row: FirmwareSettings) -> FirmwareSettingsOut:
    return FirmwareSettingsOut(
        wifi_ssid=row.wifi_ssid,
        mqtt_broker=row.mqtt_broker,
        mqtt_port=row.mqtt_port,
        wifi_password_set=bool(row.wifi_password),
        ota_password_set=bool(row.ota_password),
    )


# ── Settings (authenticated) ─────────────────────────────────────────────────


@router.get(
    "/settings",
    response_model=FirmwareSettingsOut,
    dependencies=[Depends(require_setup_complete), Depends(get_current_user)],
)
def get_firmware_settings(db: Session = Depends(get_db)):
    return _settings_out(_get_or_create_settings(db))


@router.put(
    "/settings",
    response_model=FirmwareSettingsOut,
    dependencies=[Depends(require_setup_complete), Depends(get_current_user)],
)
def update_firmware_settings(
    body: FirmwareSettingsUpdate,
    db: Session = Depends(get_db),
):
    row = _get_or_create_settings(db)
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(row, key, value)
    db.commit()
    db.refresh(row)
    return _settings_out(row)


# ── Compile (authenticated) ──────────────────────────────────────────────────


@router.post(
    "/compile",
    response_model=CompileResponse,
    dependencies=[Depends(require_setup_complete), Depends(get_current_user)],
)
def compile_firmware(body: CompileRequest, db: Session = Depends(get_db)):
    saved = _get_or_create_settings(db)

    wifi_ssid = body.wifi_ssid or saved.wifi_ssid
    wifi_password = body.wifi_password or saved.wifi_password
    mqtt_broker = body.mqtt_broker or saved.mqtt_broker
    mqtt_port = body.mqtt_port or saved.mqtt_port
    ota_password = body.ota_password or saved.ota_password

    missing = [
        f
        for f, v in [
            ("wifi_ssid", wifi_ssid),
            ("wifi_password", wifi_password),
            ("mqtt_broker", mqtt_broker),
            ("ota_password", ota_password),
        ]
        if not v
    ]
    if missing:
        raise HTTPException(
            status_code=422,
            detail=f"Missing required firmware settings: {', '.join(missing)}. "
            "Configure them in Firmware Settings first.",
        )

    try:
        resp = httpx.post(
            f"{FIRMWARE_SERVICE_URL}/compile",
            json={
                "device_type": body.device_type,
                "device_id": body.device_id,
                "wifi_ssid": wifi_ssid,
                "wifi_password": wifi_password,
                "mqtt_broker": mqtt_broker,
                "mqtt_port": mqtt_port,
                "ota_password": ota_password,
            },
            timeout=660.0,
        )
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail="Firmware service unavailable. Is the firmware container running?",
        )

    if resp.status_code != 200:
        detail = resp.json().get("detail", resp.text) if resp.headers.get("content-type", "").startswith("application/json") else resp.text
        raise HTTPException(status_code=500, detail=f"Firmware compilation failed: {detail}")

    build_id = resp.json()["build_id"]
    return CompileResponse(build_id=build_id, manifest_url=f"/api/firmware/manifest/{build_id}")


# ── Manifest + download (unauthenticated — build_id is unguessable UUID) ─────


@router.get("/manifest/{build_id}")
def get_manifest(build_id: str):
    if not build_id.replace("-", "").isalnum():
        raise HTTPException(status_code=400, detail="Invalid build_id")

    return {
        "name": "Plant Manager Firmware",
        "version": build_id[:8],
        "home_assistant_domain": "esphome",
        "builds": [
            {
                "chipFamily": "ESP32-C3",
                "parts": [
                    {
                        "path": f"/api/firmware/download/{build_id}",
                        "offset": 0,
                    }
                ],
            }
        ],
    }


@router.get("/download/{build_id}")
def download_firmware(build_id: str):
    if not build_id.replace("-", "").isalnum():
        raise HTTPException(status_code=400, detail="Invalid build_id")

    try:
        resp = httpx.get(
            f"{FIRMWARE_SERVICE_URL}/download/{build_id}",
            timeout=60.0,
            follow_redirects=True,
        )
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Firmware service unavailable")

    if resp.status_code == 404:
        raise HTTPException(status_code=404, detail="Build not found or expired")

    return Response(
        content=resp.content,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="firmware-{build_id}.bin"'},
    )
