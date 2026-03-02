"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import type { FirmwareSettings } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function FirmwareSettingsPage() {
  const [wifiSsid, setWifiSsid] = useState("");
  const [wifiPassword, setWifiPassword] = useState("");
  const [mqttBroker, setMqttBroker] = useState("");
  const [mqttPort, setMqttPort] = useState("1883");
  const [otaPassword, setOtaPassword] = useState("");
  const [settings, setSettings] = useState<FirmwareSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<FirmwareSettings>("/firmware/settings").then((s) => {
      setSettings(s);
      setWifiSsid(s.wifi_ssid);
      setMqttBroker(s.mqtt_broker);
      setMqttPort(s.mqtt_port);
      setLoading(false);
    });
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const update: Record<string, string> = {
        wifi_ssid: wifiSsid,
        mqtt_broker: mqttBroker,
        mqtt_port: mqttPort,
      };
      if (wifiPassword) update.wifi_password = wifiPassword;
      if (otaPassword) update.ota_password = otaPassword;

      const updated = await apiFetch<FirmwareSettings>("/firmware/settings", {
        method: "PUT",
        body: JSON.stringify(update),
      });
      setSettings(updated);
      setWifiPassword("");
      setOtaPassword("");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  return (
    <div className="max-w-md">
      <h1 className="mb-6 text-2xl font-bold">Firmware Settings</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Configure default WiFi and MQTT credentials for firmware compilation.
        These are pre-filled when flashing a device.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Credentials</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="fw-ssid">WiFi SSID</Label>
              <Input
                id="fw-ssid"
                value={wifiSsid}
                onChange={(e) => setWifiSsid(e.target.value)}
                placeholder="MyNetwork"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="fw-wpass">
                WiFi Password
                {settings?.wifi_password_set && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    (currently set)
                  </span>
                )}
              </Label>
              <Input
                id="fw-wpass"
                type="password"
                value={wifiPassword}
                onChange={(e) => setWifiPassword(e.target.value)}
                placeholder="leave blank to keep current"
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
            <div>
              <Label htmlFor="fw-ota">
                OTA Password
                {settings?.ota_password_set && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    (currently set)
                  </span>
                )}
              </Label>
              <Input
                id="fw-ota"
                type="password"
                value={otaPassword}
                onChange={(e) => setOtaPassword(e.target.value)}
                placeholder="leave blank to keep current"
                className="mt-1"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {saved && (
              <p className="text-sm text-green-600">Settings saved</p>
            )}

            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Settings"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
