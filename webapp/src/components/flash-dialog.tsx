"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import type { BuildStatus, CompileResponse, FirmwareSettings } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type FlashPhase = "form" | "compiling" | "ready" | "error";

interface FlashDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deviceType: "plant" | "pump";
  deviceId: string;
  deviceName: string;
  /** Called after compile is kicked off — parent handles polling & inline status */
  onCompileStarted?: (buildId: string, manifestUrl: string) => void;
  /** Open dialog directly in this phase (e.g. "ready" or "error" after polling completes) */
  initialPhase?: FlashPhase;
  initialError?: string;
  initialManifestUrl?: string;
}

export function FlashDialog({
  open,
  onOpenChange,
  deviceType,
  deviceId,
  deviceName,
  onCompileStarted,
  initialPhase,
  initialError,
  initialManifestUrl,
}: FlashDialogProps) {
  const [phase, setPhase] = useState<FlashPhase>(initialPhase ?? "form");
  const [error, setError] = useState(initialError ?? "");

  const [wifiSsid, setWifiSsid] = useState("");
  const [wifiPassword, setWifiPassword] = useState("");
  const [mqttBroker, setMqttBroker] = useState("");
  const [mqttPort, setMqttPort] = useState("1883");
  const [otaPassword, setOtaPassword] = useState("");
  const [savedSettings, setSavedSettings] = useState<FirmwareSettings | null>(
    null,
  );
  const [saveForNext, setSaveForNext] = useState(true);

  const [manifestUrl, setManifestUrl] = useState(initialManifestUrl ?? "");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      return;
    }
    setPhase(initialPhase ?? "form");
    setError(initialError ?? "");
    setManifestUrl(initialManifestUrl ?? "");

    if ((initialPhase ?? "form") === "form") {
      apiFetch<FirmwareSettings>("/firmware/settings")
        .then((s) => {
          setSavedSettings(s);
          setWifiSsid(s.wifi_ssid);
          setMqttBroker(s.mqtt_broker);
          setMqttPort(s.mqtt_port);
        })
        .catch(() => {});
    }
  }, [open, initialPhase, initialError, initialManifestUrl]);

  // Load ESP Web Tools script when ready
  useEffect(() => {
    if (phase !== "ready") return;
    if (document.querySelector('script[src*="esp-web-tools"]')) return;
    const script = document.createElement("script");
    script.type = "module";
    script.src =
      "https://unpkg.com/esp-web-tools@10/dist/web/install-button.js?module";
    document.head.appendChild(script);
  }, [phase]);

  async function handleCompile() {
    setPhase("compiling");
    setError("");

    if (saveForNext) {
      const update: Record<string, string> = {};
      if (wifiSsid) update.wifi_ssid = wifiSsid;
      if (wifiPassword) update.wifi_password = wifiPassword;
      if (mqttBroker) update.mqtt_broker = mqttBroker;
      if (mqttPort) update.mqtt_port = mqttPort;
      if (otaPassword) update.ota_password = otaPassword;
      if (Object.keys(update).length > 0) {
        try {
          await apiFetch("/firmware/settings", {
            method: "PUT",
            body: JSON.stringify(update),
          });
        } catch {
          // Non-fatal
        }
      }
    }

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // Kick off compilation (returns immediately)
      const result = await apiFetch<CompileResponse>("/firmware/compile", {
        method: "POST",
        body: JSON.stringify({
          device_type: deviceType,
          device_id: deviceId,
          wifi_ssid: wifiSsid || undefined,
          wifi_password: wifiPassword || undefined,
          mqtt_broker: mqttBroker || undefined,
          mqtt_port: mqttPort || undefined,
          ota_password: otaPassword || undefined,
        }),
      });

      // If parent handles polling, delegate to it and close dialog
      if (onCompileStarted) {
        onCompileStarted(result.build_id, result.manifest_url);
        onOpenChange(false);
        return;
      }

      // Otherwise poll inline (fallback)
      setManifestUrl(result.manifest_url);
      const buildId = result.build_id;
      while (!controller.signal.aborted) {
        await new Promise((r) => setTimeout(r, 3000));
        if (controller.signal.aborted) return;

        const status = await apiFetch<BuildStatus>(
          `/firmware/status/${buildId}`,
        );
        if (status.status === "done") {
          setPhase("ready");
          return;
        }
        if (status.status === "failed") {
          setError(status.error ?? "Compilation failed");
          setPhase("error");
          return;
        }
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof ApiError ? err.detail : "Compilation failed");
      setPhase("error");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Flash Firmware — {deviceName}</DialogTitle>
        </DialogHeader>

        {phase === "form" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter WiFi and MQTT credentials to embed in the firmware. Leave
              password fields blank to use saved values.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label htmlFor="fw-ssid">WiFi SSID</Label>
                <Input
                  id="fw-ssid"
                  value={wifiSsid}
                  onChange={(e) => setWifiSsid(e.target.value)}
                  placeholder="MyNetwork"
                  className="mt-1"
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="fw-wpass">
                  WiFi Password
                  {savedSettings?.wifi_password_set && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (saved)
                    </span>
                  )}
                </Label>
                <Input
                  id="fw-wpass"
                  type="password"
                  value={wifiPassword}
                  onChange={(e) => setWifiPassword(e.target.value)}
                  placeholder={
                    savedSettings?.wifi_password_set
                      ? "leave blank to use saved"
                      : "required"
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="fw-broker">MQTT Broker IP</Label>
                <Input
                  id="fw-broker"
                  value={mqttBroker}
                  onChange={(e) => setMqttBroker(e.target.value)}
                  placeholder="192.168.1.100"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="fw-port">MQTT Port</Label>
                <Input
                  id="fw-port"
                  value={mqttPort}
                  onChange={(e) => setMqttPort(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="fw-ota">
                  OTA Password
                  {savedSettings?.ota_password_set && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (saved)
                    </span>
                  )}
                </Label>
                <Input
                  id="fw-ota"
                  type="password"
                  value={otaPassword}
                  onChange={(e) => setOtaPassword(e.target.value)}
                  placeholder={
                    savedSettings?.ota_password_set
                      ? "leave blank to use saved"
                      : "required"
                  }
                  className="mt-1"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="fw-save"
                checked={saveForNext}
                onCheckedChange={(checked) => setSaveForNext(checked === true)}
              />
              <Label htmlFor="fw-save" className="cursor-pointer text-sm">
                Save credentials for next time
              </Label>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCompile}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                Compile Firmware
              </Button>
            </DialogFooter>
          </div>
        )}

        {phase === "compiling" && (
          <div className="space-y-4 py-8 text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
            <p className="font-medium">Compiling firmware...</p>
            <p className="text-sm text-muted-foreground">
              This takes 2-5 minutes. Please keep this window open.
            </p>
          </div>
        )}

        {phase === "ready" && (
          <div className="space-y-6 py-4">
            <div className="rounded-lg border border-green-300 bg-green-500/10 p-4">
              <p className="font-medium text-green-700">
                Firmware compiled successfully
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Connect your ESP32-C3 via USB, then click the button below to
                flash.
              </p>
            </div>

            <div className="rounded-lg border border-amber-300 bg-amber-500/10 p-3 text-sm text-amber-700">
              Requires Chrome or Edge with Web Serial API support.
            </div>

            {/* @ts-expect-error — esp-web-install-button is a web component */}
            <esp-web-install-button manifest={manifestUrl}>
              <Button
                slot="activate"
                className="w-full bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => onOpenChange(false)}
              >
                Connect and Flash ESP32
              </Button>
              <span slot="unsupported">
                Your browser does not support Web Serial. Use Chrome or Edge.
              </span>
              {/* @ts-expect-error — closing web component */}
            </esp-web-install-button>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </DialogFooter>
          </div>
        )}

        {phase === "error" && (
          <div className="space-y-4 py-4">
            <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
              <p className="font-medium text-destructive">Compilation failed</p>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
                {error}
              </pre>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPhase("form")}>
                Try Again
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
