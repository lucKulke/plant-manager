# Plant Watering Management System (ESPHome + MQTT + FastAPI + Next.js + APScheduler)

This document is a **high-level overview + implementation plan** for a modular plant watering system with **two device types**:

## Device types

### A) Plant Module (per plant)

- **ESP32-C3 SuperMini** flashed with **ESPHome**
- Hardware:
  - magnetic valve (watering)
  - moisture “stemma” sensor
  - programmable LED strip (9 LEDs)

### B) Pump Module (shared infrastructure)

- **ESP32-C3 SuperMini** flashed with **ESPHome**
- **One pump module serves multiple plant modules** — the pump provides water pressure/flow to whichever plant valve is currently open.
- Hardware:
  - water pump controlled via relay
  - **flow sensor** (to measure flow rate / total volume)
  - **pressure sensor** (to detect dry-run, clogged line, leaks, etc.)

## Server (Docker)

- **FastAPI** REST API (CRUD + commands)
- **SQLite** DB managed with **SQLAlchemy + Alembic**
- **Next.js** web app (dashboard + configuration) using **shadcn/ui** component library (Tailwind v4)
- **Worker service** using **APScheduler** (schedules + automatic mode)
- **MQTT broker** (Mosquitto) for device telemetry + commands

---

## 1) System architecture

### 1.1 Data flow (recommended)

**Telemetry (devices → broker → worker → DB):**

- Plant modules publish moisture and basic status
- Pump module publishes flow/pressure and status
- Worker subscribes, stores data in SQLite

**Commands (server/worker → broker → devices):**

- Watering decisions are made by the **worker** (schedule/auto) or **API** (manual).
- Watering is executed by coordinating:
  1. **Open a plant valve** (plant module)
  2. **Start pump** (pump module)
  3. Monitor **flow + pressure** to verify watering is happening safely
  4. Stop pump, close valve, record results

> Key idea: **When the server decides to water a plant, it must also instruct the pump module to pump water.**  
> The pump module becomes the “actuator” that provides water pressure/flow to whichever valve is open.

### 1.2 Services (Docker Compose)

- `mqtt` : Mosquitto broker
- `api` : FastAPI + SQLAlchemy + Alembic migrations
- `worker` : APScheduler runner (single instance) + MQTT client
- `web` : Next.js app
- `db` : **SQLite** file stored on a Docker volume (not a separate container)

> SQLite is a file; you mount a volume (e.g., `./data:/data`) and the API/worker share `/data/app.db`.

---

## 2) MQTT topic conventions

Use a predictable namespace and publish **both telemetry and state** so the server/UI can show the current status (moisture, valve open, LED mode/color, pump on, etc.).

### 2.1 Plant Module telemetry + state (publish)

**Moisture**

- `plants/{plant_device_id}/tele/moisture_percent` → `{"ts":"...","value":42.3}`

**Valve state (important for dashboard + safety)**

- `plants/{plant_device_id}/state/valve` → `{"ts":"...","open":true}`  
  _(publish on change, optionally retained so new subscribers immediately know current state)_

**LED state (so UI can reflect what’s shown)**

- `plants/{plant_device_id}/state/led` → `{"ts":"...","mode":"bar|solid|effect","color":"#00FF88","brightness":0.6,"effect":"rainbow","value":42}`  
  Notes:
  - `mode=bar` can use `value` (0–100) for moisture bar
  - `mode=solid` uses `color` + `brightness`
  - `mode=effect` uses `effect` (device-defined list)

**Device status**

- `plants/{plant_device_id}/tele/status` → `{"online":true,"rssi":-55,"uptime_s":12345}` _(optional)_

**Acknowledgements (optional but recommended)**

- `plants/{plant_device_id}/tele/ack` → `{"cmd_id":"...","type":"valve|led","ok":true,"details":""}`

### 2.2 Plant Module commands (subscribe)

**Valve control**

- `plants/{plant_device_id}/cmd/valve_open` → `{"cmd_id":"uuid","open":true,"max_open_s":30}`

**LED control (extendable)**

- `plants/{plant_device_id}/cmd/led`
  - Solid color: `{"cmd_id":"uuid","mode":"solid","color":"#00FF88","brightness":0.6}`
  - Moisture bar: `{"cmd_id":"uuid","mode":"bar","value":42,"brightness":0.6}`
  - Effect: `{"cmd_id":"uuid","mode":"effect","effect":"rainbow","brightness":0.6}`

> Recommendation: make the LED protocol **generic** (mode + parameters) so you can add new effects later without changing the server.

### 2.3 Pump Module telemetry + state (publish)

**Pump state**

- `pump/{pump_device_id}/state/pump` → `{"ts":"...","on":true}` _(publish on change; optionally retained)_

**Flow**

- `pump/{pump_device_id}/tele/flow` → `{"ts":"...","l_min":1.8,"total_l":12.34}`

**Pressure**

- `pump/{pump_device_id}/tele/pressure` → `{"ts":"...","bar":1.6}`

**Device status**

- `pump/{pump_device_id}/tele/status` → `{"online":true,"rssi":-60,"uptime_s":9999}`

**Acknowledgements (optional)**

- `pump/{pump_device_id}/tele/ack` → `{"cmd_id":"...","type":"pump","ok":true,"details":""}`

### 2.4 Pump Module commands (subscribe)

- `pump/{pump_device_id}/cmd/pump` → `{"cmd_id":"uuid","on":true}`
- `pump/{pump_device_id}/cmd/pump_run` → `{"cmd_id":"uuid","duration_s":10,"target_l":0.25,"max_duration_s":20}` _(optional: volume-based)_

### 2.5 Availability (optional, retained)

- `plants/{plant_device_id}/availability` = `online/offline`
- `pump/{pump_device_id}/availability` = `online/offline`

---

## 3) Firmware (ESPHome) high-level requirements

## 3.1 Plant Module (valve + moisture + LEDs)

**Components**

- Moisture sensor → compute **percent** (0–100)
- Valve control:
  - subscribe to `cmd/valve_open`
  - set valve open/close
  - publish `state/valve` on changes (optionally retained)
- LED strip (9 LEDs):
  - moisture bar + status (watering, error, offline)
  - support additional modes: solid color, effects
  - subscribe to `cmd/led` and publish `state/led` (optionally retained)
  - recommended: device can still show moisture bar locally when server is down

**Safety constraints (must-have)**

- **Max valve open time** per command (`max_open_s`)
- **Fail-closed** on boot: valve default OFF
- Optional: ignore commands if sensor error / low battery (if applicable)

## 3.2 Pump Module (relay + flow + pressure)

**Components**

- Pump relay:
  - subscribe to `cmd/pump` or `cmd/pump_run`
  - start/stop pump
- Flow sensor:
  - publish flow rate and/or total volume
- Pressure sensor:
  - publish pressure
  - use pressure to detect abnormal conditions

**Safety constraints (must-have)**

- **Max pump run time** (hard cap in firmware)
- **Dry-run / no-flow detection**:
  - if pump ON but flow < threshold for N seconds → stop and publish error
- **Over-pressure detection**:
  - if pressure > threshold → stop and publish error
- **Fail-safe OFF** on boot and on MQTT disconnect (as appropriate)

---

## 4) Server-side watering orchestration

When the system waters a plant (manual/schedule/auto), the worker/API should coordinate **valve + pump**.

### 4.1 Recommended watering sequence (state machine)

1. **Pre-checks**
   - plant enabled, pump enabled
   - pump selection: use the enabled pump from the plant's group; fall back to first enabled pump globally if no group or no pump in group
   - pump module online (optional but recommended)
   - last watering interval constraints satisfied

2. **Open valve**
   - publish `plants/{plant_device_id}/cmd/valve_open` with `open=true`
   - optionally wait for ack (short timeout)

3. **Start pump**
   - publish `pump/{pump_device_id}/cmd/pump` with `on=true`
   - start a timer

4. **Monitor**
   - verify **flow** is present (flow > threshold) within a grace period
   - verify **pressure** is within safe range
   - if monitoring fails → stop pump, close valve, mark event FAILED

5. **Stop**
   - after duration OR after target volume reached:
     - publish `pump/.../cmd/pump` on=false
     - publish `plants/.../cmd/valve_open` open=false
   - mark event OK

> For MVP you can run “duration-based watering” only.  
> Later you can add **volume-based watering** using the flow sensor totalizer.

### 4.2 Concurrency rules (important)

- If the system uses **one pump** feeding multiple valves, enforce:
  - **Only one watering session at a time** (global lock), OR
  - allow multiple valves intentionally (advanced) with flow allocation logic  
    For MVP: **single active watering session**.

---

## 5) Database design (SQLite via SQLAlchemy)

Suggested minimal schema:

### 5.1 `users`

- `id` (PK)
- `username` (unique)
- `password_hash`
- `is_admin` (bool)
- `created_at`

### 5.2 `groups`

- `id` (PK)
- `name`
- `created_at`

> Groups organize plants and pumps together (e.g. "Living Room Shelf"). Each group can have multiple plants and a pump. When watering, the system uses the pump from the plant's group, falling back to the first enabled pump if no group or no pump in the group.

### 5.3 `plants`

- `id` (PK)
- `name`
- `device_id` (unique; used in MQTT topics)
- `enabled` (bool)
- `group_id` (FK → groups.id, nullable)

### 5.4 `pumps`

- `id` (PK)
- `name`
- `device_id` (unique; used in MQTT topics)
- `enabled` (bool)
- `group_id` (FK → groups.id, nullable)

> One pump module serves multiple plant modules. Plants and pumps are assigned to groups. When watering a plant, the system first looks for an enabled pump in the same group, then falls back to the first enabled pump globally. The `watering_events` table records which pump was used for each watering session.

### 5.5 `plant_settings`

- `plant_id` (PK/FK)
- `mode` enum: `MANUAL | SCHEDULE | AUTO`
- `auto_threshold_percent`
- `auto_min_interval_minutes`
- `auto_watering_seconds`
- `updated_at`

### 5.6 `schedules`

- `id` (PK)
- `plant_id` (FK)
- cron expression (e.g., `0 7 * * *`)
- `watering_seconds`
- `enabled` (bool)
- `updated_at`

### 5.7 `moisture_readings`

- `id` (PK)
- `plant_id` (FK)
- `ts`
- `moisture_percent`

### 5.x `device_states` (optional, for dashboard convenience)

If you want a fast dashboard without scanning “latest reading” queries each time, store current states:

- `id` (PK)
- `device_type` (`PLANT|PUMP`)
- `device_id` (string)
- `ts`
- `valve_open` (nullable)
- `pump_on` (nullable)
- `led_mode` / `led_color` / `led_brightness` / `led_effect` / `led_value` (nullable)

> Alternative: compute state on the fly from retained MQTT messages and/or latest DB rows. For MVP, you can skip this table.

### 5.8 `pump_readings` (optional but recommended)

- `id` (PK)
- `pump_id` (FK)
- `ts`
- `flow_l_min` (nullable)
- `total_l` (nullable)
- `pressure_bar` (nullable)

### 5.9 `watering_events`

- `id` (PK)
- `plant_id` (FK)
- `pump_id` (FK, nullable if you only have one pump)
- `ts_start`
- `duration_s`
- `target_l` (nullable; future volume mode)
- `reason` enum: `MANUAL | SCHEDULE | AUTO`
- `status` enum: `PENDING | OK | FAILED`
- `cmd_id` (uuid/string)
- `details` (text)

---

## 6) FastAPI API surface (high level)

### 6.1 Setup / Auth

**First startup rule**: until an admin exists, everything is blocked except setup + health.

- `GET /health`
- `GET /setup/status` → `{setup_required: true|false}`
- `POST /setup` → create admin (only if no users exist)
- `POST /auth/login` → token (JWT or opaque token)

### 6.2 CRUD endpoints

**Groups**

- `GET /groups` — list all groups (includes plant count and assigned pump name)
- `POST /groups` — create group
- `GET /groups/{id}` — get group detail
- `PUT /groups/{id}` — update group
- `DELETE /groups/{id}` — delete group (nullifies FKs on plants/pumps)

**Plants**

- `GET /plants`
- `POST /plants`
- `GET /plants/{id}`
- `PUT /plants/{id}`
- `DELETE /plants/{id}`

**Pumps**

- `GET /pumps`
- `POST /pumps`
- `GET /pumps/{id}`
- `PUT /pumps/{id}`
- `DELETE /pumps/{id}`

**Settings**

- `GET /plants/{id}/settings`
- `PUT /plants/{id}/settings`

**Schedules**

- `GET /plants/{id}/schedules`
- `POST /plants/{id}/schedules`
- `PUT /schedules/{schedule_id}`
- `DELETE /schedules/{schedule_id}`

**Actions**

- `POST /plants/{id}/water` body: `{duration_s}`
  - API triggers orchestration (open valve + start pump)
  - reason = `MANUAL`

> Pump selection uses the plant's group: if the plant belongs to a group with an enabled pump, that pump is used. Otherwise, falls back to the first enabled pump globally.

---

## 7) Scheduling and automation with APScheduler

### 7.1 Key rule

Run APScheduler in **exactly one** process: the `worker` container.

### 7.2 Responsibilities

1. Load enabled schedules and create APScheduler jobs
2. Execute scheduled watering via **orchestration** (valve + pump)
3. Run auto-watering loop periodically (every 1 minute)

### 7.3 Keeping schedules in sync

MVP approach:

- Worker polls DB every 30–60 seconds
- If schedules changed (`updated_at`) → rebuild jobs (remove + re-add)

---

## 8) Telemetry ingestion (worker)

Worker subscribes to:

- `plants/+/tele/moisture_percent`
- `plants/+/state/valve`
- `plants/+/state/led`
- `pump/+/state/pump`
- `pump/+/tele/flow`
- `pump/+/tele/pressure`
- optional acks

On message:

- map `device_id` to plant/pump record
- insert reading record to DB
- optionally update a “latest\_\*” field for faster dashboard queries

---

## 9) Next.js web app (high level)

### UI Framework

The web app uses **shadcn/ui** components built on **Radix UI** primitives and **Tailwind CSS v4**. Key components used: Button, Input, Label, Card, Badge, Select, Table, Checkbox.

Dark mode is driven by `prefers-color-scheme` (OS-level), not a class toggle.

### Screens

- Setup wizard (admin creation)
- Login
- Dashboard:
  - plants list with latest moisture + last watering
  - pump status (online, pressure, flow)
- Groups:
  - group list with plant count + pump assignment
  - group detail with assigned plants/pump
- Plant detail:
  - group assignment
  - mode selection + auto threshold
  - schedules CRUD
  - manual “water now”
- Pump detail:
  - group assignment
  - pressure/flow status cards
  - readings history table

---

## 10) Docker Compose blueprint (high level)

Services:

- `mqtt` (mosquitto)
- `api` (FastAPI)
- `worker` (APScheduler + MQTT client + telemetry ingestion)
- `web` (Next.js)

Volumes:

- `./data:/data` shared by api + worker (SQLite DB)

Environment variables:

- `DATABASE_URL=sqlite:////data/app.db`
- `MQTT_HOST=mqtt`
- `MQTT_PORT=1883`
- `JWT_SECRET=...`

---

## 11) Implementation steps (ordered)

### Step 1 — Project skeleton

- Monorepo folders: `backend/`, `worker/`, `web/`, `infra/`
- Shared Python package imported by both `api` and `worker`

### Step 2 — Models + migrations

- Add `pumps` + `pump_readings` + `watering_events.pump_id`
- Generate Alembic migrations
- Run `alembic upgrade head` on startup

### Step 3 — Setup gate + auth

- `/setup/status`, `/setup`, `/auth/login`
- dependency/middleware blocks endpoints until admin exists

### Step 4 — MQTT client layer

- One reusable MQTT helper module:
  - publish JSON
  - subscribe callbacks
  - reconnect
- Use it in worker for telemetry + orchestration; API uses it for manual watering

### Step 5 — Orchestrator (core logic)

- Implement a watering **state machine**:
  - open valve → start pump → monitor flow/pressure → stop pump → close valve
- Implement a **global lock** to enforce one active watering session (MVP)

### Step 6 — Worker jobs

- APScheduler:
  - cron jobs from DB schedules
  - interval job for auto loop
  - interval job for schedule reload

### Step 7 — Next.js UI

- Add pump overview (status + sensor values)
- Plant UI unchanged, but watering calls now trigger orchestration

### Step 8 — ESPHome firmware

- Plant module: valve + moisture + LEDs, subscribe to `cmd/valve_open`
- Pump module: relay + flow + pressure, subscribe to `cmd/pump`

---

## 12) MVP scope checklist (with pump module)

Must-have:

- admin setup gate
- plant CRUD + pump CRUD
- telemetry ingestion (moisture + flow + pressure)
- orchestration (open valve + pump) for manual/schedule/auto
- schedule CRUD + execution (via worker)
- auto mode threshold + min interval
- firmware safety: pump & valve hard caps and no-flow/over-pressure detection

Nice-to-have:

- device acknowledgements
- calibration UI
- volume-based watering using `total_l`
- charts for pump readings
