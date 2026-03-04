"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export interface DraftSchedule {
  id?: number;
  cron_expression: string;
  watering_seconds: number;
  enabled: boolean;
}

export function ScheduleForm({
  schedule,
  onDone,
  onCancel,
}: {
  schedule?: DraftSchedule;
  onDone: (draft: DraftSchedule) => void;
  onCancel: () => void;
}) {
  const [cron, setCron] = useState(schedule?.cron_expression ?? "0 7 * * *");
  const [seconds, setSeconds] = useState(schedule?.watering_seconds ?? 10);
  const [enabled, setEnabled] = useState(schedule?.enabled ?? true);

  const isEdit = !!schedule;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onDone({
      id: schedule?.id,
      cron_expression: cron,
      watering_seconds: seconds,
      enabled,
    });
  }

  return (
    <Card>
      <CardContent className="p-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label htmlFor="cron">Cron Expression</Label>
            <Input
              id="cron"
              type="text"
              value={cron}
              onChange={(e) => setCron(e.target.value)}
              placeholder="0 7 * * *"
              className="mt-1 font-mono text-sm"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              minute hour day month weekday (e.g. &quot;0 7 * * *&quot; = daily
              at 07:00)
            </p>
          </div>
          <div>
            <Label htmlFor="sched-duration">Duration (seconds)</Label>
            <Input
              id="sched-duration"
              type="number"
              min={1}
              value={seconds}
              onChange={(e) => setSeconds(Number(e.target.value))}
              className="mt-1"
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="schedule-enabled"
              checked={enabled}
              onCheckedChange={(checked) => setEnabled(checked === true)}
            />
            <Label htmlFor="schedule-enabled" className="cursor-pointer">
              Enabled
            </Label>
          </div>

          <div className="flex gap-2">
            <Button type="submit" size="sm">
              {isEdit ? "Update" : "Add"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
