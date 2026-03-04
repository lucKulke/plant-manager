"use client";

import { FormEvent, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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

type LedMode = "off" | "solid" | "bar" | "effect";

interface LedControlProps {
  plantId: number;
  formId?: string;
}

export function LedControl({ plantId, formId }: LedControlProps) {
  const [mode, setMode] = useState<LedMode>("off");
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

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    switch (mode) {
      case "off":
        sendLed({ mode: "solid", brightness: 0, color: "#000000" });
        break;
      case "solid":
        sendLed({
          mode: "solid",
          brightness: solidBrightness / 100,
          color,
        });
        break;
      case "bar":
        sendLed({ mode: "bar", brightness: 1.0 });
        break;
      case "effect":
        sendLed({
          mode: "effect",
          brightness: effectBrightness / 100,
          effect,
        });
        break;
    }
  }

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>LED Mode</Label>
        <Select value={mode} onValueChange={(v) => setMode(v as LedMode)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="off">Off</SelectItem>
            <SelectItem value="solid">Solid Color</SelectItem>
            <SelectItem value="bar">Moisture Bar</SelectItem>
            <SelectItem value="effect">Effect</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {mode === "solid" && (
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
          </CardContent>
        </Card>
      )}

      {mode === "bar" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Moisture Bar</CardTitle>
            <CardDescription>
              Shows soil moisture level as a blue LED bar. Bottom LED blinks red
              when moisture is critically low.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {mode === "effect" && (
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
          </CardContent>
        </Card>
      )}

      {!formId && (
        <Button
          type="submit"
          className="w-full bg-blue-600 text-white hover:bg-blue-700"
          disabled={sending}
        >
          {mode === "off" ? "Turn Off LEDs" : "Apply"}
        </Button>
      )}
    </form>
  );
}
