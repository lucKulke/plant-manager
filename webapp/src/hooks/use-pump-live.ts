"use client";

import { useEffect, useRef, useState } from "react";

export interface PumpLiveData {
  flowLMin: number | null;
  totalL: number | null;
  pressureBar: number | null;
  pumpOn: boolean | null;
  online: boolean | null;
}

export function usePumpLive(pumpId: number): PumpLiveData {
  const [flowLMin, setFlowLMin] = useState<number | null>(null);
  const [totalL, setTotalL] = useState<number | null>(null);
  const [pressureBar, setPressureBar] = useState<number | null>(null);
  const [pumpOn, setPumpOn] = useState<boolean | null>(null);
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
        `${proto}//${window.location.host}/api/pumps/${pumpId}/ws`,
      );
      wsRef.current = ws;

      ws.onopen = () => {
        backoff = 1000;
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.topic === "flow") {
            setFlowLMin(msg.data.l_min ?? null);
            setTotalL(msg.data.total_l ?? null);
          } else if (msg.topic === "pressure") {
            setPressureBar(msg.data.bar ?? null);
          } else if (msg.topic === "pump") {
            setPumpOn(msg.data.on ?? null);
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
  }, [pumpId]);

  return { flowLMin, totalL, pressureBar, pumpOn, online };
}
