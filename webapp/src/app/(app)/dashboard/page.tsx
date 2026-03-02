"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { DashboardStats } from "@/lib/types";
import { useDashboardLive } from "@/hooks/use-dashboard-live";
import { Droplets, Flower2, Gauge, Sprout, Zap } from "lucide-react";
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
  const live = useDashboardLive();

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

      {/* Live device status */}
      {(Object.keys(live.plants).length > 0 || Object.keys(live.pumps).length > 0) && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Zap className="size-4" />
            Live Status
            <span className="inline-block h-2 w-2 rounded-full bg-green-500" title="Connected" />
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(live.plants).map(([deviceId, p]) => (
              <Card key={`plant-${deviceId}`}>
                <CardContent className="p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sprout className="size-4 text-green-600" />
                      <span className="font-medium">{p.name}</span>
                    </div>
                    <span
                      className={`inline-block h-2.5 w-2.5 rounded-full ${p.online ? "bg-green-500" : p.online === false ? "bg-red-500" : "bg-gray-300"}`}
                      title={p.online ? "Online" : p.online === false ? "Offline" : "Unknown"}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Moisture</span>
                      <p className="text-lg font-bold">
                        {p.moisture !== null ? `${p.moisture.toFixed(0)}%` : "—"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Valve</span>
                      <p className="text-lg font-bold">
                        {p.valveOpen === true ? (
                          <span className="text-green-600">Open</span>
                        ) : p.valveOpen === false ? (
                          "Closed"
                        ) : (
                          "—"
                        )}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {Object.entries(live.pumps).map(([deviceId, p]) => (
              <Card key={`pump-${deviceId}`}>
                <CardContent className="p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Gauge className="size-4 text-purple-600" />
                      <span className="font-medium">{p.name}</span>
                    </div>
                    <span
                      className={`inline-block h-2.5 w-2.5 rounded-full ${p.online ? "bg-green-500" : p.online === false ? "bg-red-500" : "bg-gray-300"}`}
                      title={p.online ? "Online" : p.online === false ? "Offline" : "Unknown"}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Flow</span>
                      <p className="text-lg font-bold">
                        {p.flowLMin !== null ? `${p.flowLMin.toFixed(1)}` : "—"}
                        <span className="ml-0.5 text-xs font-normal text-muted-foreground">L/min</span>
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Pressure</span>
                      <p className="text-lg font-bold">
                        {p.pressureBar !== null ? `${p.pressureBar.toFixed(1)}` : "—"}
                        <span className="ml-0.5 text-xs font-normal text-muted-foreground">bar</span>
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Pump</span>
                      <p className="text-lg font-bold">
                        {p.pumpOn === true ? (
                          <span className="text-green-600">On</span>
                        ) : p.pumpOn === false ? (
                          "Off"
                        ) : (
                          "—"
                        )}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

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
