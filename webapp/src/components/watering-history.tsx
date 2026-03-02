"use client";

import type { WateringEvent } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUS_CLASSES: Record<string, string> = {
  PENDING: "border-yellow-300 bg-yellow-500/10 text-yellow-600",
  OK: "border-green-300 bg-green-500/10 text-green-600",
  FAILED: "border-red-300 bg-red-500/10 text-red-600",
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function WateringHistory({ events }: { events: WateringEvent[] }) {
  if (events.length === 0) {
    return <p className="text-muted-foreground">No watering events yet.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Status</TableHead>
          <TableHead>Reason</TableHead>
          <TableHead>Time</TableHead>
          <TableHead className="text-right">Duration</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {events.map((e) => (
          <TableRow key={e.id}>
            <TableCell>
              <Badge
                variant="outline"
                className={STATUS_CLASSES[e.status] ?? ""}
              >
                {e.status}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge variant="secondary">{e.reason}</Badge>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {formatTime(e.ts_start)}
            </TableCell>
            <TableCell className="text-right">
              <span className="font-medium">{e.duration_s}s</span>
              {e.details && (
                <p className="text-xs text-muted-foreground">{e.details}</p>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
