import shutil
import subprocess
import tempfile
import uuid
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

app = FastAPI()

TEMPLATES_DIR = Path("/templates")
OUTPUT_DIR = Path("/output")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


class CompileRequest(BaseModel):
    device_type: str
    device_id: str
    wifi_ssid: str
    wifi_password: str
    mqtt_broker: str
    mqtt_port: str = "1883"
    ota_password: str


class CompileResponse(BaseModel):
    build_id: str


@app.post("/compile", response_model=CompileResponse)
def compile_firmware(req: CompileRequest):
    if req.device_type not in ("plant", "pump"):
        raise HTTPException(status_code=400, detail="device_type must be 'plant' or 'pump'")

    template_path = TEMPLATES_DIR / f"{req.device_type}.yaml"
    if not template_path.exists():
        raise HTTPException(status_code=404, detail=f"Template {req.device_type}.yaml not found")

    build_id = uuid.uuid4().hex
    work_dir = Path(tempfile.mkdtemp(prefix=f"esphome-{build_id}-"))

    try:
        # Copy template YAML into work dir
        yaml_dest = work_dir / f"{req.device_type}.yaml"
        shutil.copy(template_path, yaml_dest)

        # Write secrets.yaml next to the YAML
        secrets_path = work_dir / "secrets.yaml"
        secrets_path.write_text(
            f'wifi_ssid: "{req.wifi_ssid}"\n'
            f'wifi_password: "{req.wifi_password}"\n'
            f'mqtt_broker: "{req.mqtt_broker}"\n'
            f'mqtt_port: "{req.mqtt_port}"\n'
            f'ota_password: "{req.ota_password}"\n'
        )

        # Run esphome compile with device_id substitution
        result = subprocess.run(
            [
                "esphome",
                "-s", "device_id", req.device_id,
                "compile",
                str(yaml_dest),
            ],
            cwd=str(work_dir),
            capture_output=True,
            text=True,
            timeout=600,
        )

        if result.returncode != 0:
            detail = result.stderr[-2000:] if result.stderr else result.stdout[-2000:]
            raise HTTPException(status_code=500, detail=f"ESPHome compile failed:\n{detail}")

        # Locate the .bin output
        device_name = f"{req.device_type}-{req.device_id}"
        bin_path = (
            work_dir
            / ".esphome"
            / "build"
            / device_name
            / ".pioenvs"
            / device_name
            / "firmware.bin"
        )

        if not bin_path.exists():
            # Fallback: search recursively
            matches = list(work_dir.rglob("firmware.bin"))
            if not matches:
                raise HTTPException(status_code=500, detail="firmware.bin not found after compile")
            bin_path = matches[0]

        # Copy to shared output volume
        output_path = OUTPUT_DIR / f"{build_id}.bin"
        shutil.copy(bin_path, output_path)

        return CompileResponse(build_id=build_id)

    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


@app.get("/download/{build_id}")
def download_firmware(build_id: str):
    if not build_id.replace("-", "").isalnum():
        raise HTTPException(status_code=400, detail="Invalid build_id")
    bin_path = OUTPUT_DIR / f"{build_id}.bin"
    if not bin_path.exists():
        raise HTTPException(status_code=404, detail="Build not found")
    return FileResponse(
        path=str(bin_path),
        media_type="application/octet-stream",
        filename=f"firmware-{build_id}.bin",
    )


@app.delete("/builds/{build_id}")
def delete_build(build_id: str):
    if not build_id.replace("-", "").isalnum():
        raise HTTPException(status_code=400, detail="Invalid build_id")
    bin_path = OUTPUT_DIR / f"{build_id}.bin"
    if bin_path.exists():
        bin_path.unlink()
    return {"deleted": True}
