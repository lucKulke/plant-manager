"use client";

function moistureColor(value: number): string {
  if (value < 20) return "bg-red-500";
  if (value < 40) return "bg-orange-400";
  if (value < 60) return "bg-yellow-400";
  return "bg-green-500";
}

export function MoistureBadge({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-2 w-16 rounded-full bg-foreground/10" />
        <span className="text-xs text-foreground/30">—</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="relative h-2 w-16 overflow-hidden rounded-full bg-foreground/10">
        <div
          className={`absolute left-0 top-0 h-full rounded-full ${moistureColor(value)}`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      <span className="text-xs font-medium">{value.toFixed(0)}%</span>
    </div>
  );
}
