"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface LedControlProps {
  plantId: number;
}

export function LedControl({ plantId }: LedControlProps) {
  const [color, setColor] = useState("#0000ff");
  const [solidBrightness, setSolidBrightness] = useState(100);
  const [effect, setEffect] = useState("rainbow");
  const [effectBrightness, setEffectBrightness] = useState(100);
  const [sending, setSending] = useState(false);

  async function sendLed(payload: Record<string, unknown>) {
    setSending(true);
    try {
      await apiFetch(`/plants/${plantId}/led`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Off */}
      <Button
        variant="outline"
        className="w-full"
        disabled={sending}
        onClick={() => sendLed({ mode: "solid", brightness: 0, color: "#000000" })}
      >
        Turn Off LEDs
      </Button>

      {/* Solid Color */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Solid Color</CardTitle>
          <CardDescription>Set all LEDs to a single color</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Label htmlFor="led-color">Color</Label>
            <input
              id="led-color"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-10 w-16 cursor-pointer rounded border border-border bg-transparent p-1"
            />
            <span className="font-mono text-sm text-muted-foreground">
              {color}
            </span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Brightness</Label>
              <span className="text-sm text-muted-foreground">
                {solidBrightness}%
              </span>
            </div>
            <Slider
              value={[solidBrightness]}
              onValueChange={([v]) => setSolidBrightness(v)}
              min={0}
              max={100}
              step={1}
            />
          </div>
          <Button
            className="w-full bg-blue-600 text-white hover:bg-blue-700"
            disabled={sending}
            onClick={() =>
              sendLed({
                mode: "solid",
                brightness: solidBrightness / 100,
                color,
              })
            }
          >
            Apply Color
          </Button>
        </CardContent>
      </Card>

      {/* Moisture Bar */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Moisture Bar</CardTitle>
          <CardDescription>
            Shows soil moisture level as a blue LED bar. Bottom LED blinks red
            when moisture is critically low.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            className="w-full bg-blue-600 text-white hover:bg-blue-700"
            disabled={sending}
            onClick={() => sendLed({ mode: "bar", brightness: 1.0 })}
          >
            Activate Moisture Bar
          </Button>
        </CardContent>
      </Card>

      {/* Effects */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Effects</CardTitle>
          <CardDescription>Animated LED effects</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Effect</Label>
            <Select value={effect} onValueChange={setEffect}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rainbow">Rainbow</SelectItem>
                <SelectItem value="addressable_color_wipe">
                  Color Wipe
                </SelectItem>
                <SelectItem value="addressable_twinkle">Twinkle</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Brightness</Label>
              <span className="text-sm text-muted-foreground">
                {effectBrightness}%
              </span>
            </div>
            <Slider
              value={[effectBrightness]}
              onValueChange={([v]) => setEffectBrightness(v)}
              min={0}
              max={100}
              step={1}
            />
          </div>
          <Button
            className="w-full bg-blue-600 text-white hover:bg-blue-700"
            disabled={sending}
            onClick={() =>
              sendLed({
                mode: "effect",
                brightness: effectBrightness / 100,
                effect,
              })
            }
          >
            Apply Effect
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
