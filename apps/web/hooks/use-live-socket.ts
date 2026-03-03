"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LIVE_STREAMS, type LiveStreamName } from "@robotops/shared";
import { useSession } from "next-auth/react";
import { io, type Socket } from "socket.io-client";

export interface LiveChannelPayload<T = unknown> {
  channel: string;
  timestamp: string;
  data: T;
}

export interface LiveDeltaPayload<T = unknown> {
  stream: LiveStreamName;
  cursor: string;
  upserts: T[];
  deletes: string[];
  snapshot: boolean;
  batch_index: number;
  batch_total: number;
}

interface UseLiveSocketOptions {
  siteId?: string;
  streams?: LiveStreamName[];
  enabled?: boolean;
}

export function useLiveSocket(options?: UseLiveSocketOptions) {
  const { data: session } = useSession();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [subscribeError, setSubscribeError] = useState<string | null>(null);
  const [streamCursors, setStreamCursors] = useState<Partial<Record<LiveStreamName, string>>>({});

  const cursorRef = useRef<Partial<Record<LiveStreamName, string>>>({});

  const socketUrl = useMemo(() => process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4000", []);
  const enabled = options?.enabled ?? true;
  const siteId = options?.siteId ?? "all";
  const streamInputKey = useMemo(() => {
    const selected = options?.streams?.length ? options.streams : [...LIVE_STREAMS];
    return selected.join("|");
  }, [options?.streams]);
  const streams = useMemo(() => {
    if (!streamInputKey) {
      return [...LIVE_STREAMS];
    }
    return [...new Set(streamInputKey.split("|").filter(Boolean))] as LiveStreamName[];
  }, [streamInputKey]);
  const streamsKey = streamInputKey || LIVE_STREAMS.join("|");

  const emitSubscribe = useCallback(
    (instance: Socket) => {
      if (!streams.length) {
        return;
      }

      instance.emit("subscribe", {
        site_id: siteId,
        streams,
        cursor: cursorRef.current
      });
    },
    [siteId, streams]
  );

  const updateStreamCursor = useCallback((stream: LiveStreamName, cursor: string) => {
    cursorRef.current = {
      ...cursorRef.current,
      [stream]: cursor
    };
    setStreamCursors(cursorRef.current);
  }, []);

  useEffect(() => {
    if (!session?.accessToken || !enabled) {
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
      setSubscribeError(null);
    };

    const onDisconnect = () => {
      setConnected(false);
    };

    const onSubscribed = (payload: { cursor?: Partial<Record<LiveStreamName, string>> }) => {
      if (!payload?.cursor) {
        return;
      }

      cursorRef.current = {
        ...cursorRef.current,
        ...payload.cursor
      };
      setStreamCursors(cursorRef.current);
    };

    const onSubscribeError = (payload: { message?: string }) => {
      setSubscribeError(payload?.message ?? "Failed to subscribe to live stream");
    };

    const onDelta = (payload: LiveDeltaPayload<unknown>) => {
      if (!payload?.stream || !payload?.cursor) {
        return;
      }
      updateStreamCursor(payload.stream, payload.cursor);
    };

    instance.on("connect", onConnect);
    instance.on("disconnect", onDisconnect);
    instance.on("subscribed", onSubscribed);
    instance.on("subscribe.error", onSubscribeError);
    instance.on("delta", onDelta);

    setSocket(instance);

    return () => {
      instance.off("connect", onConnect);
      instance.off("disconnect", onDisconnect);
      instance.off("subscribed", onSubscribed);
      instance.off("subscribe.error", onSubscribeError);
      instance.off("delta", onDelta);
      instance.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [enabled, session?.accessToken, socketUrl, updateStreamCursor]);

  useEffect(() => {
    if (!socket || !connected) {
      return;
    }

    emitSubscribe(socket);
  }, [connected, emitSubscribe, siteId, socket, streamsKey]);

  return {
    socket,
    connected,
    subscribeError,
    streamCursors,
    updateStreamCursor
  };
}
