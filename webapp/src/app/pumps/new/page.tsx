"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import type { Group, Pump } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function NewPumpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [groupId, setGroupId] = useState<string>("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiFetch<Group[]>("/groups").then(setGroups);
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const pump = await apiFetch<Pump>("/pumps", {
        method: "POST",
        body: JSON.stringify({
          name,
          device_id: deviceId,
          group_id: groupId && groupId !== "none" ? Number(groupId) : null,
        }),
      });
      router.push(`/pumps/${pump.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Failed to create pump");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-md">
      <h1 className="mb-6 text-2xl font-bold">Add Pump</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Main Pump"
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="device_id">Device ID</Label>
          <Input
            id="device_id"
            type="text"
            required
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            placeholder="e.g. pump-01"
            className="mt-1 font-mono text-sm"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Used in MQTT topics: pump/&#123;device_id&#125;/...
          </p>
        </div>

        <div>
          <Label>Group</Label>
          <Select value={groupId} onValueChange={setGroupId}>
            <SelectTrigger className="mt-1 w-full">
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
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-2">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating..." : "Create Pump"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
