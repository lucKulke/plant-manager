export interface Group {
  id: number;
  name: string;
  created_at: string;
  plant_count: number;
  pump_name: string | null;
}

export interface Plant {
  id: number;
  name: string;
  device_id: string;
  enabled: boolean;
  created_at: string;
  group_id: number | null;
  group_name: string | null;
  settings: PlantSettings | null;
  latest_moisture: number | null;
  last_watered_at: string | null;
}

export interface PlantSettings {
  plant_id: number;
  mode: "MANUAL" | "SCHEDULE" | "AUTO";
  auto_threshold_percent: number;
  auto_min_interval_minutes: number;
  auto_watering_seconds: number;
  updated_at: string;
}

export interface Pump {
  id: number;
  name: string;
  device_id: string;
  enabled: boolean;
  created_at: string;
  group_id: number | null;
  group_name: string | null;
  latest_flow_l_min: number | null;
  latest_pressure_bar: number | null;
}

export interface PumpReading {
  id: number;
  pump_id: number;
  ts: string;
  flow_l_min: number | null;
  total_l: number | null;
  pressure_bar: number | null;
}

export interface Schedule {
  id: number;
  plant_id: number;
  cron_expression: string;
  watering_seconds: number;
  enabled: boolean;
  updated_at: string;
}

export interface WateringEvent {
  id: number;
  plant_id: number;
  pump_id: number | null;
  ts_start: string;
  duration_s: number;
  target_l: number | null;
  reason: "MANUAL" | "SCHEDULE" | "AUTO";
  status: "PENDING" | "OK" | "FAILED";
  cmd_id: string;
  details: string | null;
}
