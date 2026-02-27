"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { io, type Socket } from "socket.io-client";

export interface LiveChannelPayload<T = unknown> {
  channel: string;
  timestamp: string;
  data: T;
}

export function useLiveSocket() {
  const { data: session } = useSession();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  const socketUrl = useMemo(() => process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4000", []);

  useEffect(() => {
    if (!session?.accessToken) {
      return;
    }

    const instance = io(socketUrl, {
      autoConnect: true,
      transports: ["websocket"],
      auth: {
        token: session.accessToken
      },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 5000
    });

    const onConnect = () => {
      setConnected(true);
      instance.emit("live.subscribe", {
        channels: ["robots.live", "incidents.live", "missions.live", "telemetry.live", "alerts.live"]
      });
    };

    const onDisconnect = () => {
      setConnected(false);
    };

    instance.on("connect", onConnect);
    instance.on("disconnect", onDisconnect);

    setSocket(instance);

    return () => {
      instance.off("connect", onConnect);
      instance.off("disconnect", onDisconnect);
      instance.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [session?.accessToken, socketUrl]);

  return { socket, connected };
}
