"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import type { Group, Plant, Pump } from "@/lib/types";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function GroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = Number(params.id);

  const [group, setGroup] = useState<Group | null>(null);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [pumps, setPumps] = useState<Pump[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editError, setEditError] = useState("");

  const load = useCallback(async () => {
    const [g, allPlants, allPumps] = await Promise.all([
      apiFetch<Group>(`/groups/${groupId}`),
      apiFetch<Plant[]>("/plants"),
      apiFetch<Pump[]>("/pumps"),
    ]);
    setGroup(g);
    setPlants(allPlants.filter((p) => p.group_id === groupId));
    setPumps(allPumps.filter((p) => p.group_id === groupId));
    setEditName(g.name);
    setLoading(false);
  }, [groupId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete() {
    if (!confirm("Delete this group? Plants and pumps will be unassigned."))
      return;
    setDeleting(true);
    try {
      await apiFetch(`/groups/${groupId}`, { method: "DELETE" });
      router.push("/groups");
    } catch {
      setDeleting(false);
    }
  }

  async function handleSaveName() {
    setEditError("");
    try {
      const updated = await apiFetch<Group>(`/groups/${groupId}`, {
        method: "PUT",
        body: JSON.stringify({ name: editName }),
      });
      setGroup(updated);
      setEditing(false);
    } catch (err) {
      setEditError(
        err instanceof ApiError ? err.detail : "Failed to update group",
      );
    }
  }

  if (loading || !group) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          {editing ? (
            <div className="flex items-center gap-2">
              <Input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="text-2xl font-bold"
              />
              <Button size="sm" onClick={handleSaveName}>
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditing(false);
                  setEditName(group.name);
                  setEditError("");
                }}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <h1
              className="cursor-pointer text-2xl font-bold hover:text-muted-foreground"
              onClick={() => setEditing(true)}
            >
              {group.name}
            </h1>
          )}
          {editError && (
            <p className="mt-1 text-sm text-destructive">{editError}</p>
          )}
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDelete}
          disabled={deleting}
        >
          Delete
        </Button>
      </div>

      {/* Assigned Plants */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Plants</h2>
          <Button asChild size="sm">
            <Link href={`/plants/new?group_id=${groupId}`}>Add Plant</Link>
          </Button>
        </div>
        {plants.length === 0 ? (
          <p className="text-muted-foreground">
            No plants in this group yet. Add your first plant.
          </p>
        ) : (
          <div className="space-y-2">
            {plants.map((plant) => (
              <Link
                key={plant.id}
                href={`/plants/${plant.id}`}
                className="flex items-center justify-between rounded-lg border border-border px-4 py-3 transition-colors hover:bg-accent"
              >
                <div>
                  <span className="font-medium">{plant.name}</span>
                  <span className="ml-3 text-sm text-muted-foreground">
                    {plant.device_id}
                  </span>
                </div>
                <span
                  className={`h-2 w-2 rounded-full ${plant.enabled ? "bg-green-500" : "bg-muted"}`}
                />
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Assigned Pump */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Pump</h2>
          {pumps.length === 0 && (
            <Button asChild size="sm">
              <Link href={`/pumps/new?group_id=${groupId}`}>Add Pump</Link>
            </Button>
          )}
        </div>
        {pumps.length === 0 ? (
          <p className="text-muted-foreground">
            No pump in this group yet. Add a pump to enable watering.
          </p>
        ) : (
          <div className="space-y-2">
            {pumps.map((pump) => (
              <Link
                key={pump.id}
                href={`/pumps/${pump.id}`}
                className="flex items-center justify-between rounded-lg border border-border px-4 py-3 transition-colors hover:bg-accent"
              >
                <div>
                  <span className="font-medium">{pump.name}</span>
                  <span className="ml-3 text-sm text-muted-foreground">
                    {pump.device_id}
                  </span>
                </div>
                <span
                  className={`h-2 w-2 rounded-full ${pump.enabled ? "bg-green-500" : "bg-muted"}`}
                />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
