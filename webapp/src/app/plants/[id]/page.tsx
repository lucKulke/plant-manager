"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { Group, Plant, PlantSettings, Schedule, WateringEvent } from "@/lib/types";
import { SettingsForm } from "@/components/settings-form";
import { ScheduleForm } from "@/components/schedule-form";
import { WaterButton } from "@/components/water-button";
import { WateringHistory } from "@/components/watering-history";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function PlantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const plantId = Number(params.id);

  const [plant, setPlant] = useState<Plant | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [events, setEvents] = useState<WateringEvent[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    const [p, s, e, g] = await Promise.all([
      apiFetch<Plant>(`/plants/${plantId}`),
      apiFetch<Schedule[]>(`/plants/${plantId}/schedules`),
      apiFetch<WateringEvent[]>(`/plants/${plantId}/watering-events`),
      apiFetch<Group[]>("/groups"),
    ]);
    setPlant(p);
    setSchedules(s);
    setEvents(e);
    setGroups(g);
    setLoading(false);
  }, [plantId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete() {
    if (!confirm("Delete this plant? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await apiFetch(`/plants/${plantId}`, { method: "DELETE" });
      router.push("/dashboard");
    } catch {
      setDeleting(false);
    }
  }

  async function handleDeleteSchedule(scheduleId: number) {
    await apiFetch(`/schedules/${scheduleId}`, { method: "DELETE" });
    setSchedules((prev) => prev.filter((s) => s.id !== scheduleId));
  }

  if (loading || !plant) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{plant.name}</h1>
          <p className="mt-1 font-mono text-sm text-muted-foreground">
            {plant.device_id}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={plant.enabled ? "outline" : "secondary"} className={plant.enabled ? "border-green-300 bg-green-500/10 text-green-600" : ""}>
            {plant.enabled ? "Enabled" : "Disabled"}
          </Badge>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
          >
            Delete
          </Button>
        </div>
      </div>

      {/* Group */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">Group</h2>
        <Select
          value={plant.group_id ? String(plant.group_id) : "none"}
          onValueChange={async (value) => {
            const newGroupId = value !== "none" ? Number(value) : null;
            const updated = await apiFetch<Plant>(`/plants/${plantId}`, {
              method: "PUT",
              body: JSON.stringify({ group_id: newGroupId }),
            });
            setPlant(updated);
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="None" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {groups.map((g) => (
              <SelectItem key={g.id} value={String(g.id)}>
                {g.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      {/* Manual Watering */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">Manual Watering</h2>
        <WaterButton
          plantId={plantId}
          onWatered={(e) => setEvents((prev) => [e, ...prev])}
        />
      </section>

      {/* Settings */}
      {plant.settings && (
        <section>
          <h2 className="mb-4 text-lg font-semibold">Settings</h2>
          <SettingsForm
            plantId={plantId}
            settings={plant.settings}
            onSaved={(s: PlantSettings) =>
              setPlant((prev) => (prev ? { ...prev, settings: s } : prev))
            }
          />
        </section>
      )}

      {/* Schedules */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Schedules</h2>
          {!showScheduleForm && !editingSchedule && (
            <Button size="sm" onClick={() => setShowScheduleForm(true)}>
              Add Schedule
            </Button>
          )}
        </div>

        {(showScheduleForm || editingSchedule) && (
          <div className="mb-4">
            <ScheduleForm
              plantId={plantId}
              schedule={editingSchedule ?? undefined}
              onSaved={(s) => {
                if (editingSchedule) {
                  setSchedules((prev) =>
                    prev.map((x) => (x.id === s.id ? s : x)),
                  );
                } else {
                  setSchedules((prev) => [...prev, s]);
                }
                setShowScheduleForm(false);
                setEditingSchedule(null);
              }}
              onCancel={() => {
                setShowScheduleForm(false);
                setEditingSchedule(null);
              }}
            />
          </div>
        )}

        {schedules.length === 0 && !showScheduleForm ? (
          <p className="text-muted-foreground">No schedules configured.</p>
        ) : (
          <div className="space-y-2">
            {schedules.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
              >
                <div>
                  <span className="font-mono text-sm">{s.cron_expression}</span>
                  <span className="ml-3 text-sm text-muted-foreground">
                    {s.watering_seconds}s
                  </span>
                  {!s.enabled && (
                    <Badge variant="secondary" className="ml-2">
                      disabled
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingSchedule(s)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDeleteSchedule(s.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Watering History */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">Watering History</h2>
        <WateringHistory events={events} />
      </section>
    </div>
  );
}
