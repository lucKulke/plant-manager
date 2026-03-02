"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { Group, Pump, PumpReading } from "@/lib/types";
import { FlashDialog } from "@/components/flash-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

export default function PumpDetailPage() {
  const params = useParams();
  const router = useRouter();
  const pumpId = Number(params.id);

  const [pump, setPump] = useState<Pump | null>(null);
  const [readings, setReadings] = useState<PumpReading[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [flashOpen, setFlashOpen] = useState(false);

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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{pump.name}</h1>
          <p className="mt-1 font-mono text-sm text-muted-foreground">
            {pump.device_id}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={pump.enabled ? "secondary" : "ghost"}
            size="sm"
            onClick={toggleEnabled}
            className={pump.enabled ? "bg-green-500/10 text-green-600 hover:bg-green-500/20" : ""}
          >
            {pump.enabled ? "Enabled" : "Disabled"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFlashOpen(true)}
          >
            Flash Firmware
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
      </div>

      <FlashDialog
        open={flashOpen}
        onOpenChange={setFlashOpen}
        deviceType="pump"
        deviceId={pump.device_id}
        deviceName={pump.name}
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
      <section>
        <h2 className="mb-4 text-lg font-semibold">Current Status</h2>
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Flow Rate</p>
              <p className="mt-1 text-2xl font-bold">
                {pump.latest_flow_l_min !== null
                  ? `${pump.latest_flow_l_min.toFixed(1)}`
                  : "—"}
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  L/min
                </span>
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Pressure</p>
              <p className="mt-1 text-2xl font-bold">
                {pump.latest_pressure_bar !== null
                  ? `${pump.latest_pressure_bar.toFixed(2)}`
                  : "—"}
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  bar
                </span>
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Readings History */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">Recent Readings</h2>
        {readings.length === 0 ? (
          <p className="text-muted-foreground">
            No readings yet. Data will appear once the pump module is connected.
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
    </div>
  );
}
