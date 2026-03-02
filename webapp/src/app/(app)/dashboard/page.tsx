"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { DashboardStats } from "@/lib/types";
import { Droplets, Flower2, Gauge, Sprout } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<DashboardStats>("/dashboard/stats").then((s) => {
      setStats(s);
      setLoading(false);
    });
  }, []);

  if (loading || !stats) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  // Build unique plant names for moisture chart config
  const plantNames = [
    ...new Set(stats.moisture_history.map((m) => m.plant_name)),
  ];
  const moistureConfig: ChartConfig = Object.fromEntries(
    plantNames.map((name, i) => [
      name,
      {
        label: name,
        color: `var(--chart-${(i % 5) + 1})`,
      },
    ]),
  );

  // Transform moisture data: group by timestamp, one key per plant
  const moistureByTs = new Map<string, Record<string, number | string>>();
  for (const point of stats.moisture_history) {
    const key = point.ts.slice(0, 16); // group to minute
    if (!moistureByTs.has(key)) {
      moistureByTs.set(key, { ts: new Date(point.ts).toLocaleTimeString() });
    }
    moistureByTs.get(key)![point.plant_name] = point.value;
  }
  const moistureData = [...moistureByTs.values()];

  // Watering totals chart config
  const wateringConfig: ChartConfig = {
    total_duration_s: {
      label: "Duration (s)",
      color: "var(--chart-1)",
    },
  };

  // Pump flow chart config
  const pumpNames = [
    ...new Set(stats.pump_flow_history.map((p) => p.pump_name)),
  ];
  const flowConfig: ChartConfig = Object.fromEntries(
    pumpNames.map((name, i) => [
      name,
      {
        label: name,
        color: `var(--chart-${(i % 5) + 1})`,
      },
    ]),
  );
  const flowByTs = new Map<string, Record<string, number | string>>();
  for (const point of stats.pump_flow_history) {
    const key = point.ts.slice(0, 16);
    if (!flowByTs.has(key)) {
      flowByTs.set(key, { ts: new Date(point.ts).toLocaleTimeString() });
    }
    flowByTs.get(key)![point.pump_name] = point.flow_l_min;
  }
  const flowData = [...flowByTs.values()];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-green-500/10">
              <Sprout className="size-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Plants</p>
              <p className="text-2xl font-bold">{stats.total_plants}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-blue-500/10">
              <Flower2 className="size-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Groups</p>
              <p className="text-2xl font-bold">{stats.total_groups}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-purple-500/10">
              <Gauge className="size-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pumps</p>
              <p className="text-2xl font-bold">{stats.total_pumps}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Moisture history chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Droplets className="size-4" />
            Moisture History (24h)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {moistureData.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No moisture data yet.
            </p>
          ) : (
            <ChartContainer config={moistureConfig} className="h-[250px] w-full">
              <LineChart data={moistureData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="ts" fontSize={12} />
                <YAxis domain={[0, 100]} fontSize={12} />
                <ChartTooltip content={<ChartTooltipContent />} />
                {plantNames.map((name) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={moistureConfig[name]?.color}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Watering totals chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Droplets className="size-4" />
            Watering Duration by Plant (7 days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.watering_totals.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No watering events yet.
            </p>
          ) : (
            <ChartContainer config={wateringConfig} className="h-[250px] w-full">
              <BarChart data={stats.watering_totals}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="plant_name" fontSize={12} />
                <YAxis fontSize={12} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="total_duration_s"
                  fill="var(--chart-1)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Pump flow chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="size-4" />
            Pump Flow Rate (24h)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {flowData.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No pump flow data yet.
            </p>
          ) : (
            <ChartContainer config={flowConfig} className="h-[250px] w-full">
              <LineChart data={flowData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="ts" fontSize={12} />
                <YAxis fontSize={12} />
                <ChartTooltip content={<ChartTooltipContent />} />
                {pumpNames.map((name) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={flowConfig[name]?.color}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
