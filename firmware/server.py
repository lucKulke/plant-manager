import logging
import shutil
import subprocess
import tempfile
import threading
import uuid
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("firmware")

app = FastAPI()

TEMPLATES_DIR = Path("/templates")
OUTPUT_DIR = Path("/output")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# In-memory build status tracking
# status: "compiling" | "done" | "failed"
builds: dict[str, dict] = {}


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


class BuildStatus(BaseModel):
    build_id: str
    status: str
    error: str | None = None


def _do_compile(build_id: str, req: CompileRequest):
    """Run ESPHome compile in a background thread. Updates builds dict."""
    logger.info("Build %s: starting compilation for %s-%s", build_id, req.device_type, req.device_id)

    template_path = TEMPLATES_DIR / f"{req.device_type}.yaml"
    work_dir = Path(tempfile.mkdtemp(prefix=f"esphome-{build_id}-"))

    try:
        # Copy template YAML into work dir
        yaml_dest = work_dir / f"{req.device_type}.yaml"
        shutil.copy(template_path, yaml_dest)
        logger.info("Build %s: copied template %s", build_id, template_path.name)

        # Copy custom_components if present
        custom_src = TEMPLATES_DIR / "custom_components"
        if custom_src.is_dir():
            shutil.copytree(custom_src, work_dir / "custom_components")
            logger.info("Build %s: copied custom_components", build_id)

        # Write secrets.yaml next to the YAML
        secrets_path = work_dir / "secrets.yaml"
        secrets_path.write_text(
            f'wifi_ssid: "{req.wifi_ssid}"\n'
            f'wifi_password: "{req.wifi_password}"\n'
            f'mqtt_broker: "{req.mqtt_broker}"\n'
            f'mqtt_port: "{req.mqtt_port}"\n'
            f'ota_password: "{req.ota_password}"\n'
        )
        logger.info("Build %s: wrote secrets.yaml", build_id)

        # Run esphome compile
        logger.info("Build %s: running esphome compile...", build_id)
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
            logger.error("Build %s: compile failed:\n%s", build_id, detail)
            builds[build_id] = {"status": "failed", "error": f"ESPHome compile failed:\n{detail}"}
            return

        logger.info("Build %s: compile succeeded, locating binary...", build_id)

        # Locate the .bin output
        # ESPHome uses ESPHOME_DATA_DIR (/cache/esphome) for build output
        device_name = f"{req.device_type}-{req.device_id}"
        cache_build_dir = Path("/cache/esphome/build") / device_name / ".pioenvs" / device_name

        # Prefer firmware.factory.bin (full flash image), fall back to firmware.bin
        bin_path = cache_build_dir / "firmware.factory.bin"
        if not bin_path.exists():
            bin_path = cache_build_dir / "firmware.bin"

        if not bin_path.exists():
            # Last resort: search both work dir and cache
            matches = list(Path("/cache/esphome").rglob("firmware.factory.bin"))
            if not matches:
                matches = list(Path("/cache/esphome").rglob("firmware.bin"))
            if not matches:
                logger.error("Build %s: no firmware binary found", build_id)
                builds[build_id] = {"status": "failed", "error": "No firmware binary found after compile"}
                return
            bin_path = matches[0]

        logger.info("Build %s: found binary at %s", build_id, bin_path)

        # Copy to shared output volume
        output_path = OUTPUT_DIR / f"{build_id}.bin"
        shutil.copy(bin_path, output_path)
        logger.info("Build %s: firmware saved to %s", build_id, output_path)

        builds[build_id] = {"status": "done", "error": None}

    except subprocess.TimeoutExpired:
        logger.error("Build %s: compile timed out after 600s", build_id)
        builds[build_id] = {"status": "failed", "error": "Compilation timed out (600s)"}
    except Exception as exc:
        logger.exception("Build %s: unexpected error", build_id)
        builds[build_id] = {"status": "failed", "error": str(exc)}
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)
        logger.info("Build %s: cleaned up work directory", build_id)


@app.post("/compile", response_model=CompileResponse)
def compile_firmware(req: CompileRequest):
    if req.device_type not in ("plant", "pump"):
        raise HTTPException(status_code=400, detail="device_type must be 'plant' or 'pump'")

    template_path = TEMPLATES_DIR / f"{req.device_type}.yaml"
    if not template_path.exists():
        raise HTTPException(status_code=404, detail=f"Template {req.device_type}.yaml not found")

    build_id = uuid.uuid4().hex
    builds[build_id] = {"status": "compiling", "error": None}

    thread = threading.Thread(target=_do_compile, args=(build_id, req), daemon=True)
    thread.start()

    logger.info("Build %s: accepted, compiling in background", build_id)
    return CompileResponse(build_id=build_id)


@app.get("/status/{build_id}", response_model=BuildStatus)
def get_build_status(build_id: str):
    if not build_id.replace("-", "").isalnum():
        raise HTTPException(status_code=400, detail="Invalid build_id")
    if build_id not in builds:
        raise HTTPException(status_code=404, detail="Build not found")
    entry = builds[build_id]
    return BuildStatus(build_id=build_id, status=entry["status"], error=entry["error"])


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
