"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Save } from "lucide-react";
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
import { ScheduleForm, type DraftSchedule } from "@/components/schedule-form";
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

function SaveButton({ form, disabled }: { form: string; disabled?: boolean }) {
  return (
    <Button type="submit" form={form} size="sm" disabled={disabled}>
      <Save className="mr-2 h-4 w-4" />
      Save
    </Button>
  );
}

export default function PlantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const plantId = Number(params.id);
  const live = usePlantLive(plantId);

  const [plant, setPlant] = useState<Plant | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [draftSchedules, setDraftSchedules] = useState<DraftSchedule[]>([]);
  const [schedulesDirty, setSchedulesDirty] = useState(false);
  const [events, setEvents] = useState<WateringEvent[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [editingScheduleIndex, setEditingScheduleIndex] = useState<number | null>(null);
  const [savingSchedules, setSavingSchedules] = useState(false);
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
    setDraftSchedules(
      s.map((sc) => ({
        id: sc.id,
        cron_expression: sc.cron_expression,
        watering_seconds: sc.watering_seconds,
        enabled: sc.enabled,
      })),
    );
    setSchedulesDirty(false);
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

  async function handleSaveSchedules(e: React.FormEvent) {
    e.preventDefault();
    setSavingSchedules(true);
    try {
      // Delete removed schedules
      const draftIds = new Set(draftSchedules.map((d) => d.id).filter(Boolean));
      for (const s of schedules) {
        if (!draftIds.has(s.id)) {
          await apiFetch(`/schedules/${s.id}`, { method: "DELETE" });
        }
      }

      // Create or update schedules
      const saved: Schedule[] = [];
      for (const draft of draftSchedules) {
        const body = JSON.stringify({
          cron_expression: draft.cron_expression,
          watering_seconds: draft.watering_seconds,
          enabled: draft.enabled,
        });
        if (draft.id) {
          const updated = await apiFetch<Schedule>(
            `/schedules/${draft.id}`,
            { method: "PUT", body },
          );
          saved.push(updated);
        } else {
          const created = await apiFetch<Schedule>(
            `/plants/${plantId}/schedules`,
            { method: "POST", body },
          );
          saved.push(created);
        }
      }

      setSchedules(saved);
      setDraftSchedules(
        saved.map((sc) => ({
          id: sc.id,
          cron_expression: sc.cron_expression,
          watering_seconds: sc.watering_seconds,
          enabled: sc.enabled,
        })),
      );
      setSchedulesDirty(false);
    } finally {
      setSavingSchedules(false);
    }
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

      <CardContent className="flex flex-1 flex-col">
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

        <Tabs defaultValue="overview" className="flex-1">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="schedules">Schedules</TabsTrigger>
            <TabsTrigger value="leds">LEDs</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="flex flex-col pt-4">
            <Card className="flex-1">
              <CardHeader>
                <CardTitle>Overview</CardTitle>
                <CardDescription>Live status and quick actions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Status Cards */}
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">
                        Soil Moisture
                        {live.moisture !== null && (
                          <span
                            className="ml-2 inline-block h-2 w-2 rounded-full bg-green-500"
                            title="Live"
                          />
                        )}
                      </p>
                      <p className="mt-1 text-2xl font-bold">
                        {(live.moisture ?? plant.latest_moisture) !== null
                          ? `${(live.moisture ?? plant.latest_moisture!).toFixed(0)}`
                          : "\u2014"}
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
                          <span
                            className="ml-2 inline-block h-2 w-2 rounded-full bg-green-500"
                            title="Live"
                          />
                        )}
                      </p>
                      <p className="mt-1 text-2xl font-bold">
                        {live.valveOpen === true ? (
                          <span className="text-green-600">Open</span>
                        ) : live.valveOpen === false ? (
                          "Closed"
                        ) : (
                          "\u2014"
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
                        {live.online === true ? (
                          "Online"
                        ) : live.online === false ? (
                          <span className="text-red-500">Offline</span>
                        ) : (
                          "\u2014"
                        )}
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
                          ? new Date(plant.last_watered_at).toLocaleDateString()
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
                  <h2 className="mb-4 text-lg font-semibold">
                    Manual Watering
                  </h2>
                  <WaterButton
                    plantId={plantId}
                    onWatered={(e) => setEvents((prev) => [e, ...prev])}
                  />
                </section>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="flex flex-col pt-4">
            <Card className="flex-1">
              <CardHeader>
                <CardTitle>Settings</CardTitle>
                <CardDescription>
                  Configure watering mode and thresholds
                </CardDescription>
                {plant.settings && (
                  <CardAction>
                    <SaveButton form="settings-form" />
                  </CardAction>
                )}
              </CardHeader>
              <CardContent>
                {plant.settings ? (
                  <SettingsForm
                    plantId={plantId}
                    settings={plant.settings}
                    formId="settings-form"
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
              </CardContent>
            </Card>
          </TabsContent>

          {/* Schedules Tab */}
          <TabsContent value="schedules" className="flex flex-col pt-4">
            <Card className="flex-1">
              <CardHeader>
                <CardTitle>Schedules</CardTitle>
                <CardDescription>Automated watering schedules</CardDescription>
                <CardAction>
                  <SaveButton
                    form="schedules-form"
                    disabled={!schedulesDirty || savingSchedules}
                  />
                </CardAction>
              </CardHeader>
              <CardContent className="space-y-4">
                <form id="schedules-form" onSubmit={handleSaveSchedules} />

                {(showScheduleForm || editingScheduleIndex !== null) && (
                  <ScheduleForm
                    schedule={
                      editingScheduleIndex !== null
                        ? draftSchedules[editingScheduleIndex]
                        : undefined
                    }
                    onDone={(draft) => {
                      if (editingScheduleIndex !== null) {
                        setDraftSchedules((prev) =>
                          prev.map((x, i) =>
                            i === editingScheduleIndex ? draft : x,
                          ),
                        );
                      } else {
                        setDraftSchedules((prev) => [...prev, draft]);
                      }
                      setSchedulesDirty(true);
                      setShowScheduleForm(false);
                      setEditingScheduleIndex(null);
                    }}
                    onCancel={() => {
                      setShowScheduleForm(false);
                      setEditingScheduleIndex(null);
                    }}
                  />
                )}

                {draftSchedules.length === 0 && !showScheduleForm ? (
                  <p className="text-muted-foreground">
                    No schedules configured.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {draftSchedules.map((s, i) => (
                      <div
                        key={s.id ?? `new-${i}`}
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
                          {!s.id && (
                            <Badge variant="outline" className="ml-2 border-blue-300 bg-blue-500/10 text-blue-600">
                              new
                            </Badge>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingScheduleIndex(i)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              setDraftSchedules((prev) =>
                                prev.filter((_, idx) => idx !== i),
                              );
                              setSchedulesDirty(true);
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!showScheduleForm && editingScheduleIndex === null && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowScheduleForm(true)}
                  >
                    Add Schedule
                  </Button>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* LEDs Tab */}
          <TabsContent value="leds" className="flex flex-col pt-4">
            <Card className="flex-1">
              <CardHeader>
                <CardTitle>LEDs</CardTitle>
                <CardDescription>Control LED mode and effects</CardDescription>
                <CardAction>
                  <SaveButton form="led-form" />
                </CardAction>
              </CardHeader>
              <CardContent>
                <LedControl plantId={plantId} formId="led-form" />
              </CardContent>
            </Card>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="flex flex-col pt-4">
            <Card className="flex-1">
              <CardHeader>
                <CardTitle>History</CardTitle>
                <CardDescription>Past watering events</CardDescription>
              </CardHeader>
              <CardContent>
                <WateringHistory events={events} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
