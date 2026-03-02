"use client";

import Link from "next/link";
import type { Plant } from "@/lib/types";
import { MoistureBadge } from "@/components/moisture-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function PlantCard({ plant }: { plant: Plant }) {
  const mode = plant.settings?.mode ?? "MANUAL";

  return (
    <Link href={`/plants/${plant.id}`}>
      <Card className="transition-colors hover:border-border/50">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold">{plant.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {plant.device_id}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {plant.group_name && (
                <Badge
                  variant="outline"
                  className="border-blue-300 bg-blue-500/10 text-blue-600"
                >
                  {plant.group_name}
                </Badge>
              )}
              <Badge variant="secondary">{mode}</Badge>
              <span
                className={`h-2 w-2 rounded-full ${plant.enabled ? "bg-green-500" : "bg-muted"}`}
              />
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <MoistureBadge value={plant.latest_moisture} />
            <span className="text-xs text-muted-foreground">
              {plant.last_watered_at
                ? `Watered ${timeAgo(plant.last_watered_at)}`
                : "Never watered"}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
