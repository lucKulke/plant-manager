"use client";

import { useEffect, useRef, useState } from "react";

export interface PlantStatus {
  name: string;
  moisture: number | null;
  valveOpen: boolean | null;
  online: boolean | null;
}

export interface PumpStatus {
  name: string;
  flowLMin: number | null;
  pressureBar: number | null;
  pumpOn: boolean | null;
  online: boolean | null;
}

export interface DashboardLiveData {
  plants: Record<string, PlantStatus>;
  pumps: Record<string, PumpStatus>;
}

export function useDashboardLive(): DashboardLiveData {
  const [plants, setPlants] = useState<Record<string, PlantStatus>>({});
  const [pumps, setPumps] = useState<Record<string, PumpStatus>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let unmounted = false;
    let backoff = 1000;

    function connect() {
      if (unmounted) return;

      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(
        `${proto}//${window.location.host}/api/dashboard/ws`,
      );
      wsRef.current = ws;

      ws.onopen = () => {
        backoff = 1000;
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          const deviceId: string = msg.device_id;
          const name: string = msg.name;

          if (msg.type === "plant") {
            setPlants((prev) => {
              const current = prev[deviceId] ?? {
                name,
                moisture: null,
                valveOpen: null,
                online: null,
              };
              const updated = { ...current, name };

              if (msg.topic === "moisture") {
                updated.moisture = msg.data.value ?? null;
              } else if (msg.topic === "valve") {
                updated.valveOpen = msg.data.open ?? null;
              } else if (msg.topic === "availability") {
                updated.online = msg.data.status === "online";
              }

              return { ...prev, [deviceId]: updated };
            });
          } else if (msg.type === "pump") {
            setPumps((prev) => {
              const current = prev[deviceId] ?? {
                name,
                flowLMin: null,
                pressureBar: null,
                pumpOn: null,
                online: null,
              };
              const updated = { ...current, name };

              if (msg.topic === "flow") {
                updated.flowLMin = msg.data.l_min ?? null;
              } else if (msg.topic === "pressure") {
                updated.pressureBar = msg.data.bar ?? null;
              } else if (msg.topic === "pump") {
                updated.pumpOn = msg.data.on ?? null;
              } else if (msg.topic === "availability") {
                updated.online = msg.data.status === "online";
              }

              return { ...prev, [deviceId]: updated };
            });
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        if (unmounted) return;
        reconnectTimer.current = setTimeout(() => {
          backoff = Math.min(backoff * 2, 10000);
          connect();
        }, backoff);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      unmounted = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, []);

  return { plants, pumps };
}
