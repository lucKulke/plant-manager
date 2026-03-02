"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import type {
  BuildStatus,
  FirmwareBuild,
  Group,
  Plant,
  PlantSettings,
  Schedule,
  WateringEvent,
} from "@/lib/types";
import type { FlashPhase } from "@/components/flash-dialog";
import { SettingsForm } from "@/components/settings-form";
import { ScheduleForm } from "@/components/schedule-form";
import { WaterButton } from "@/components/water-button";
import { WateringHistory } from "@/components/watering-history";
import { FlashDialog } from "@/components/flash-dialog";
import { LedControl } from "@/components/led-control";
import { usePlantLive } from "@/hooks/use-plant-live";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function PlantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const plantId = Number(params.id);
  const live = usePlantLive(plantId);

  const [plant, setPlant] = useState<Plant | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [events, setEvents] = useState<WateringEvent[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [flashOpen, setFlashOpen] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [flashPhase, setFlashPhase] = useState<FlashPhase>("form");
  const [compileError, setCompileError] = useState("");
  const [manifestUrl, setManifestUrl] = useState("");
  const compileAbortRef = useRef<AbortController | null>(null);

  function startPolling(buildId: string, mUrl: string) {
    setCompiling(true);
    setManifestUrl(mUrl);
    setCompileError("");

    const controller = new AbortController();
    compileAbortRef.current = controller;

    (async () => {
      try {
        while (!controller.signal.aborted) {
          await new Promise((r) => setTimeout(r, 3000));
          if (controller.signal.aborted) return;

          const status = await apiFetch<BuildStatus>(
            `/firmware/status/${buildId}`,
          );
          if (status.status === "done") {
            setCompiling(false);
            setFlashPhase("ready");
            setFlashOpen(true);
            return;
          }
          if (status.status === "failed") {
            setCompiling(false);
            setCompileError(status.error ?? "Compilation failed");
            setFlashPhase("error");
            setFlashOpen(true);
            return;
          }
        }
      } catch {
        if (controller.signal.aborted) return;
        setCompiling(false);
        setCompileError("Compilation failed");
        setFlashPhase("error");
        setFlashOpen(true);
      }
    })();
  }

  function handleCompileStarted(buildId: string, mUrl: string) {
    startPolling(buildId, mUrl);
  }

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

    // Check for active firmware builds
    try {
      const builds = await apiFetch<FirmwareBuild[]>(
        `/firmware/builds/active?device_type=plant&device_id=${p.device_id}`,
      );
      if (builds.length > 0 && !compiling) {
        const b = builds[0];
        startPolling(b.build_id, b.manifest_url);
      }
    } catch {
      // Non-fatal
    }
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
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{plant.name}</CardTitle>
        <CardDescription>{plant.device_id}</CardDescription>
        <CardAction>
          <div className="flex items-center gap-2">
            <Badge
              variant={plant.enabled ? "outline" : "secondary"}
              className={
                plant.enabled
                  ? "border-green-300 bg-green-500/10 text-green-600"
                  : ""
              }
            >
              {plant.enabled ? "Enabled" : "Disabled"}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFlashPhase("form");
                setFlashOpen(true);
              }}
              disabled={compiling}
            >
              {compiling && (
                <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              )}
              {compiling ? "Compiling..." : "Flash Firmware"}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
            >
              Delete
            </Button>
          </div>
        </CardAction>
      </CardHeader>

      <CardContent>
        <FlashDialog
          open={flashOpen}
          onOpenChange={setFlashOpen}
          deviceType="plant"
          deviceId={plant.device_id}
          deviceName={plant.name}
          onCompileStarted={handleCompileStarted}
          initialPhase={flashPhase}
          initialError={compileError}
          initialManifestUrl={manifestUrl}
        />

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="schedules">Schedules</TabsTrigger>
            <TabsTrigger value="leds">LEDs</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6 pt-4">
            {/* Status Cards */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">
                    Soil Moisture
                    {live.moisture !== null && (
                      <span className="ml-2 inline-block h-2 w-2 rounded-full bg-green-500" title="Live" />
                    )}
                  </p>
                  <p className="mt-1 text-2xl font-bold">
                    {(live.moisture ?? plant.latest_moisture) !== null
                      ? `${(live.moisture ?? plant.latest_moisture!).toFixed(0)}`
                      : "—"}
                    <span className="ml-1 text-sm font-normal text-muted-foreground">
                      %
                    </span>
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">
                    Valve
                    {live.valveOpen !== null && (
                      <span className="ml-2 inline-block h-2 w-2 rounded-full bg-green-500" title="Live" />
                    )}
                  </p>
                  <p className="mt-1 text-2xl font-bold">
                    {live.valveOpen === true ? (
                      <span className="text-green-600">Open</span>
                    ) : live.valveOpen === false ? (
                      "Closed"
                    ) : (
                      "—"
                    )}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">
                    Device
                    {live.online !== null && (
                      <span
                        className={`ml-2 inline-block h-2 w-2 rounded-full ${live.online ? "bg-green-500" : "bg-red-500"}`}
                        title={live.online ? "Online" : "Offline"}
                      />
                    )}
                  </p>
                  <p className="mt-1 text-2xl font-bold">
                    {live.online === true
                      ? "Online"
                      : live.online === false
                        ? <span className="text-red-500">Offline</span>
                        : "—"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">
                    Last Watered
                  </p>
                  <p className="mt-1 text-lg font-bold">
                    {plant.last_watered_at
                      ? new Date(
                          plant.last_watered_at,
                        ).toLocaleDateString()
                      : "Never"}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Group */}
            <section>
              <h2 className="mb-4 text-lg font-semibold">Group</h2>
              <Select
                value={plant.group_id ? String(plant.group_id) : "none"}
                onValueChange={async (value) => {
                  const newGroupId =
                    value !== "none" ? Number(value) : null;
                  const updated = await apiFetch<Plant>(
                    `/plants/${plantId}`,
                    {
                      method: "PUT",
                      body: JSON.stringify({ group_id: newGroupId }),
                    },
                  );
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
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="pt-4">
            {plant.settings ? (
              <SettingsForm
                plantId={plantId}
                settings={plant.settings}
                onSaved={(s: PlantSettings) =>
                  setPlant((prev) =>
                    prev ? { ...prev, settings: s } : prev,
                  )
                }
              />
            ) : (
              <p className="text-muted-foreground">
                No settings available.
              </p>
            )}
          </TabsContent>

          {/* Schedules Tab */}
          <TabsContent value="schedules" className="pt-4">
            <div className="mb-4 flex items-center justify-between">
              {!showScheduleForm && !editingSchedule && (
                <Button
                  size="sm"
                  onClick={() => setShowScheduleForm(true)}
                >
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
              <p className="text-muted-foreground">
                No schedules configured.
              </p>
            ) : (
              <div className="space-y-2">
                {schedules.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
                  >
                    <div>
                      <span className="font-mono text-sm">
                        {s.cron_expression}
                      </span>
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
          </TabsContent>

          {/* LEDs Tab */}
          <TabsContent value="leds" className="pt-4">
            <LedControl plantId={plantId} />
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="pt-4">
            <WateringHistory events={events} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
