"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { BuildStatus, FirmwareBuild, Group, Pump, PumpReading } from "@/lib/types";
import { FlashDialog } from "@/components/flash-dialog";
import type { FlashPhase } from "@/components/flash-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { usePumpLive } from "@/hooks/use-pump-live";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

export default function PumpDetailPage() {
  const params = useParams();
  const router = useRouter();
  const pumpId = Number(params.id);
  const live = usePumpLive(pumpId);

  const [pump, setPump] = useState<Pump | null>(null);
  const [readings, setReadings] = useState<PumpReading[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    async function load() {
      const [p, r, g] = await Promise.all([
        apiFetch<Pump>(`/pumps/${pumpId}`),
        apiFetch<PumpReading[]>(`/pumps/${pumpId}/readings`),
        apiFetch<Group[]>("/groups"),
      ]);
      setPump(p);
      setReadings(r);
      setGroups(g);
      setLoading(false);

      // Check for active firmware builds
      try {
        const builds = await apiFetch<FirmwareBuild[]>(
          `/firmware/builds/active?device_type=pump&device_id=${p.device_id}`,
        );
        if (builds.length > 0) {
          const b = builds[0];
          startPolling(b.build_id, b.manifest_url);
        }
      } catch {
        // Non-fatal
      }
    }
    load();
  }, [pumpId]);

  async function handleDelete() {
    if (!confirm("Delete this pump? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await apiFetch(`/pumps/${pumpId}`, { method: "DELETE" });
      router.push("/dashboard");
    } catch {
      setDeleting(false);
    }
  }

  async function toggleEnabled() {
    if (!pump) return;
    const updated = await apiFetch<Pump>(`/pumps/${pumpId}`, {
      method: "PUT",
      body: JSON.stringify({ enabled: !pump.enabled }),
    });
    setPump(updated);
  }

  if (loading || !pump) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{pump.name}</CardTitle>
        <CardDescription>{pump.device_id}</CardDescription>
        <CardAction>
          <div className="flex items-center gap-2">
            <Badge
              variant={pump.enabled ? "outline" : "secondary"}
              className={
                pump.enabled
                  ? "border-green-300 bg-green-500/10 text-green-600"
                  : ""
              }
            >
              {pump.enabled ? "Enabled" : "Disabled"}
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
          deviceType="pump"
          deviceId={pump.device_id}
          deviceName={pump.name}
          onCompileStarted={handleCompileStarted}
          initialPhase={flashPhase}
          initialError={compileError}
          initialManifestUrl={manifestUrl}
        />

        {/* Group */}
        <section>
          <h2 className="mb-4 text-lg font-semibold">Group</h2>
          <Select
            value={pump.group_id ? String(pump.group_id) : "none"}
            onValueChange={async (value) => {
              const newGroupId = value !== "none" ? Number(value) : null;
              const updated = await apiFetch<Pump>(`/pumps/${pumpId}`, {
                method: "PUT",
                body: JSON.stringify({ group_id: newGroupId }),
              });
              setPump(updated);
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

        {/* Latest Values */}
        <section className="mt-6">
          <h2 className="mb-4 text-lg font-semibold">Current Status</h2>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">
                  Flow Rate
                  {live.flowLMin !== null && (
                    <span className="ml-2 inline-block h-2 w-2 rounded-full bg-green-500" title="Live" />
                  )}
                </p>
                <p className="mt-1 text-2xl font-bold">
                  {(live.flowLMin ?? pump.latest_flow_l_min) !== null
                    ? `${(live.flowLMin ?? pump.latest_flow_l_min!).toFixed(1)}`
                    : "—"}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">
                    L/min
                  </span>
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">
                  Pressure
                  {live.pressureBar !== null && (
                    <span className="ml-2 inline-block h-2 w-2 rounded-full bg-green-500" title="Live" />
                  )}
                </p>
                <p className="mt-1 text-2xl font-bold">
                  {(live.pressureBar ?? pump.latest_pressure_bar) !== null
                    ? `${(live.pressureBar ?? pump.latest_pressure_bar!).toFixed(2)}`
                    : "—"}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">
                    bar
                  </span>
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">
                  Pump
                  {live.pumpOn !== null && (
                    <span className="ml-2 inline-block h-2 w-2 rounded-full bg-green-500" title="Live" />
                  )}
                </p>
                <p className="mt-1 text-2xl font-bold">
                  {live.pumpOn === true ? (
                    <span className="text-green-600">Running</span>
                  ) : live.pumpOn === false ? (
                    "Off"
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
          </div>
        </section>

        {/* Readings History */}
        <section className="mt-6">
          <h2 className="mb-4 text-lg font-semibold">Recent Readings</h2>
          {readings.length === 0 ? (
            <p className="text-muted-foreground">
              No readings yet. Data will appear once the pump module is
              connected.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Flow (L/min)</TableHead>
                  <TableHead>Total (L)</TableHead>
                  <TableHead>Pressure (bar)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {readings.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-muted-foreground">
                      {formatTime(r.ts)}
                    </TableCell>
                    <TableCell>
                      {r.flow_l_min !== null ? r.flow_l_min.toFixed(2) : "—"}
                    </TableCell>
                    <TableCell>
                      {r.total_l !== null ? r.total_l.toFixed(2) : "—"}
                    </TableCell>
                    <TableCell>
                      {r.pressure_bar !== null
                        ? r.pressure_bar.toFixed(2)
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
