"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import type { Group, Plant } from "@/lib/types";
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

export default function NewPlantPage() {
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
      const plant = await apiFetch<Plant>("/plants", {
        method: "POST",
        body: JSON.stringify({
          name,
          device_id: deviceId,
          group_id: groupId ? Number(groupId) : null,
        }),
      });
      router.push(`/plants/${plant.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Failed to create plant");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-md">
      <h1 className="mb-6 text-2xl font-bold">Add Plant</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Monstera"
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
            placeholder="e.g. plant-01"
            className="mt-1 font-mono text-sm"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Used in MQTT topics: plants/&#123;device_id&#125;/...
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
            {submitting ? "Creating..." : "Create Plant"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
