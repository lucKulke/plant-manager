"use client";

import { useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import type { WateringEvent } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function WaterButton({
  plantId,
  onWatered,
}: {
  plantId: number;
  onWatered: (event: WateringEvent) => void;
}) {
  const [duration, setDuration] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleWater() {
    setLoading(true);
    setError("");
    setSuccess(false);
    try {
      const event = await apiFetch<WateringEvent>(
        `/plants/${plantId}/water`,
        {
          method: "POST",
          body: JSON.stringify({ duration_s: duration }),
        },
      );
      setSuccess(true);
      onWatered(event);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Watering failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-end gap-3">
      <div>
        <Label htmlFor="water-duration">Duration (seconds)</Label>
        <Input
          id="water-duration"
          type="number"
          min={1}
          max={300}
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          className="mt-1 w-24"
        />
      </div>
      <Button
        onClick={handleWater}
        disabled={loading}
        className="bg-blue-600 text-white hover:bg-blue-700"
      >
        {loading ? "Watering..." : "Water Now"}
      </Button>
      {success && (
        <span className="text-sm text-green-600">Watering started</span>
      )}
      {error && <span className="text-sm text-destructive">{error}</span>}
    </div>
  );
}
