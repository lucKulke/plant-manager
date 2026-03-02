"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { Group } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const data = await apiFetch<Group[]>("/groups");
      setGroups(data);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Groups</h2>
          <Button asChild size="sm">
            <Link href="/groups/new">Add Group</Link>
          </Button>
        </div>
        {groups.length === 0 ? (
          <p className="text-muted-foreground">
            No groups yet. Create a group to organize plants and pumps.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {groups.map((group) => (
              <Link key={group.id} href={`/groups/${group.id}`}>
                <Card className="transition-colors hover:border-border/50">
                  <CardContent className="p-4">
                    <h3 className="font-semibold">{group.name}</h3>
                    <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                      <span>
                        {group.plant_count}{" "}
                        {group.plant_count === 1 ? "plant" : "plants"}
                      </span>
                      <span>Pump: {group.pump_name ?? "none"}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
