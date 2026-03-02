"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { Plant, Pump } from "@/lib/types";
import { PlantCard } from "@/components/plant-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function DashboardPage() {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [pumps, setPumps] = useState<Pump[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [p, pu] = await Promise.all([
        apiFetch<Plant[]>("/plants"),
        apiFetch<Pump[]>("/pumps"),
      ]);
      setPlants(p);
      setPumps(pu);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  return (
    <div className="space-y-8">
      {/* Plants */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Plants</h2>
          <Button asChild size="sm">
            <Link href="/plants/new">Add Plant</Link>
          </Button>
        </div>
        {plants.length === 0 ? (
          <p className="text-muted-foreground">
            No plants yet. Add your first plant to get started.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {plants.map((plant) => (
              <PlantCard key={plant.id} plant={plant} />
            ))}
          </div>
        )}
      </section>

      {/* Pumps */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Pumps</h2>
          <Button asChild size="sm">
            <Link href="/pumps/new">Add Pump</Link>
          </Button>
        </div>
        {pumps.length === 0 ? (
          <p className="text-muted-foreground">No pumps configured.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {pumps.map((pump) => (
              <Link key={pump.id} href={`/pumps/${pump.id}`}>
                <Card className="transition-colors hover:border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold">{pump.name}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {pump.device_id}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {pump.group_name && (
                          <Badge
                            variant="outline"
                            className="border-blue-300 bg-blue-500/10 text-blue-600"
                          >
                            {pump.group_name}
                          </Badge>
                        )}
                        <span
                          className={`h-2 w-2 rounded-full ${pump.enabled ? "bg-green-500" : "bg-muted"}`}
                        />
                      </div>
                    </div>
                    <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                      <span>
                        Flow:{" "}
                        {pump.latest_flow_l_min !== null
                          ? `${pump.latest_flow_l_min.toFixed(1)} L/min`
                          : "—"}
                      </span>
                      <span>
                        Pressure:{" "}
                        {pump.latest_pressure_bar !== null
                          ? `${pump.latest_pressure_bar.toFixed(2)} bar`
                          : "—"}
                      </span>
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
