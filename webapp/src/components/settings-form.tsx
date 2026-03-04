"use client";

import { FormEvent, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import type { PlantSettings } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MODES = ["MANUAL", "SCHEDULE", "AUTO"] as const;

export function SettingsForm({
  plantId,
  settings,
  onSaved,
  formId,
}: {
  plantId: number;
  settings: PlantSettings;
  onSaved: (s: PlantSettings) => void;
  formId?: string;
}) {
  const [mode, setMode] = useState(settings.mode);
  const [threshold, setThreshold] = useState(settings.auto_threshold_percent);
  const [interval, setInterval] = useState(settings.auto_min_interval_minutes);
  const [duration, setDuration] = useState(settings.auto_watering_seconds);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const updated = await apiFetch<PlantSettings>(
        `/plants/${plantId}/settings`,
        {
          method: "PUT",
          body: JSON.stringify({
            mode,
            auto_threshold_percent: threshold,
            auto_min_interval_minutes: interval,
            auto_watering_seconds: duration,
          }),
        },
      );
      onSaved(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Mode</Label>
        <div className="mt-1 flex gap-2">
          {MODES.map((m) => (
            <Button
              key={m}
              type="button"
              variant={mode === m ? "default" : "outline"}
              size="sm"
              onClick={() => setMode(m)}
            >
              {m}
            </Button>
          ))}
        </div>
      </div>

      {mode === "AUTO" && (
        <>
          <div>
            <Label htmlFor="threshold">Moisture Threshold (%)</Label>
            <Input
              id="threshold"
              type="number"
              min={0}
              max={100}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="interval">Min Interval (minutes)</Label>
            <Input
              id="interval"
              type="number"
              min={1}
              value={interval}
              onChange={(e) => setInterval(Number(e.target.value))}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="auto-duration">Watering Duration (seconds)</Label>
            <Input
              id="auto-duration"
              type="number"
              min={1}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="mt-1"
            />
          </div>
        </>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!formId && (
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      )}
    </form>
  );
}
