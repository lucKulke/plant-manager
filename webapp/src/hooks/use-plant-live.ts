"use client";

import { useEffect, useRef, useState } from "react";

export interface PlantLiveData {
  moisture: number | null;
  valveOpen: boolean | null;
  online: boolean | null;
}

export function usePlantLive(plantId: number): PlantLiveData {
  const [moisture, setMoisture] = useState<number | null>(null);
  const [valveOpen, setValveOpen] = useState<boolean | null>(null);
  const [online, setOnline] = useState<boolean | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let unmounted = false;
    let backoff = 1000;

    function connect() {
      if (unmounted) return;

      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(
        `${proto}//${window.location.host}/api/plants/${plantId}/ws`,
      );
      wsRef.current = ws;

      ws.onopen = () => {
        backoff = 1000;
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.topic === "moisture") {
            setMoisture(msg.data.value ?? null);
          } else if (msg.topic === "valve") {
            setValveOpen(msg.data.open ?? null);
          } else if (msg.topic === "availability") {
            setOnline(msg.data.status === "online");
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
  }, [plantId]);

  return { moisture, valveOpen, online };
}
