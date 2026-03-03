import { Inject, Logger, type OnModuleDestroy } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from "@nestjs/websockets";
import {
  LIVE_STREAMS,
  createLiveCursor,
  decodeLiveCursor,
  encodeLiveCursor,
  hasPermission,
  liveSubscribeSchema,
  type Permission,
  type LiveCursorV1,
  type LiveStreamName,
  type LiveSubscribeInput,
  type Role
} from "@robotops/shared";
import jwt from "jsonwebtoken";
import type { Server, Socket } from "socket.io";
import { PrismaService } from "../services/prisma.service";

interface SocketUser {
  sub: string;
  tenantId: string;
  role: Role;
  permissions: Permission[];
}

interface DeltaSubscription {
  tenantId: string;
  siteId: string;
  streams: LiveStreamName[];
  cursor: Partial<Record<LiveStreamName, string>>;
}

interface PendingDeltaBuffer {
  upserts: Set<string>;
  deletes: Set<string>;
  timer?: NodeJS.Timeout;
}

export interface LiveMetricsSnapshot {
  mode: "dual" | "delta_only";
  connected_clients: number;
  subscribed_clients: number;
  delta_messages_sent: number;
  legacy_messages_sent: number;
  delta_bytes_sent: number;
  legacy_bytes_sent: number;
  last_flush_at: string | null;
}

const DEFAULT_ROBOT_OFFLINE_AFTER_SECONDS = 15;
const DEFAULT_ROBOT_PUBLISH_PERIOD_SECONDS = 2;
const DEFAULT_NON_ROBOT_PUBLISH_PERIOD_MS = 5000;
const SNAPSHOT_BATCH_SIZE = 250;

const STREAM_PERMISSIONS: Record<LiveStreamName, "robots.read" | "incidents.read" | "missions.read"> = {
  robot_last_state: "robots.read",
  incidents: "incidents.read",
  missions: "missions.read"
};

const STREAM_COALESCE_WINDOW_MS: Record<LiveStreamName, number> = {
  robot_last_state: 250,
  incidents: 500,
  missions: 500
};

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN?.split(",") ?? ["http://localhost:3000"],
    credentials: true
  }
})
export class LiveGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(LiveGateway.name);
  private readonly liveMode: "dual" | "delta_only" = process.env.LIVE_UPDATES_MODE === "delta_only" ? "delta_only" : "dual";

  private intervalRef?: NodeJS.Timeout;
  private tenantLastRobotPublishAt = new Map<string, number>();
  private tenantLastOpsPublishAt = new Map<string, number>();
  private pendingBuffers = new Map<string, PendingDeltaBuffer>();
  private subscribedClients = new Set<string>();

  private deltaMessagesSent = 0;
  private legacyMessagesSent = 0;
  private deltaBytesSent = 0;
  private legacyBytesSent = 0;
  private lastFlushAt: string | null = null;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  afterInit() {
    this.intervalRef = setInterval(() => {
      void this.broadcastLegacyLiveUpdates();
    }, 1000);
  }

  onModuleDestroy() {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
    }

    for (const buffer of this.pendingBuffers.values()) {
      if (buffer.timer) {
        clearTimeout(buffer.timer);
      }
    }
    this.pendingBuffers.clear();
  }

  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);
      const secret = process.env.JWT_SECRET;
      if (!token || !secret) {
        client.disconnect();
        return;
      }

      const user = jwt.verify(token, secret) as SocketUser;
      client.data.user = {
        ...user,
        permissions: (Array.isArray(user.permissions) ? user.permissions : []) as Permission[]
      };
      client.join(this.tenantRoom(user.tenantId));

      client.emit("live.connected", {
        ok: true,
        mode: this.liveMode,
        channels: ["delta", "subscribed", "subscribe.error", "robots.live", "incidents.live", "missions.live", "telemetry.live", "alerts.live"],
        reconnect_hint: "Send auth token in handshake.auth.token on reconnect"
      });
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.subscribedClients.delete(client.id);
    this.clearClientDeltaSubscription(client);
  }

  @SubscribeMessage("live.subscribe")
  handleLegacySubscribe(@ConnectedSocket() client: Socket, @MessageBody() payload: { channels?: string[] }) {
    const user = client.data.user as SocketUser | undefined;
    if (!user) {
      return { ok: false, error: "unauthorized" };
    }

    client.join(this.legacyRoom(user.tenantId));
    client.data.legacySubscribed = true;

    const channels = payload?.channels ?? [];
    return {
      ok: true,
      mode: this.liveMode,
      channels
    };
  }

  @SubscribeMessage("subscribe")
  async handleSubscribe(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
    const user = client.data.user as SocketUser | undefined;
    if (!user) {
      client.emit("subscribe.error", {
        code: "unauthorized",
        message: "Missing authenticated socket session"
      });
      return { ok: false, error: "unauthorized" };
    }

    const parsed = liveSubscribeSchema.safeParse(payload);
    if (!parsed.success) {
      client.emit("subscribe.error", {
        code: "invalid_payload",
        message: "Invalid subscribe payload",
        details: parsed.error.flatten()
      });
      return { ok: false, error: "invalid_payload" };
    }

    const input: LiveSubscribeInput = parsed.data;
    if (input.tenant_id && input.tenant_id !== user.tenantId) {
      client.emit("subscribe.error", {
        code: "tenant_mismatch",
        message: "tenant_id mismatch with authenticated session"
      });
      return { ok: false, error: "tenant_mismatch" };
    }

    if (input.site_id !== "all") {
      const site = await this.prisma.site.findFirst({
        where: {
          id: input.site_id,
          tenantId: user.tenantId
        },
        select: { id: true }
      });
      if (!site) {
        client.emit("subscribe.error", {
          code: "invalid_site",
          message: "site_id must belong to authenticated tenant"
        });
        return { ok: false, error: "invalid_site" };
      }
    }

    const unauthorizedStreams = input.streams.filter((stream) => !this.hasStreamPermission(user, stream));
    if (unauthorizedStreams.length > 0) {
      client.emit("subscribe.error", {
        code: "forbidden_streams",
        message: "One or more requested streams are not authorized",
        streams: unauthorizedStreams
      });
      return { ok: false, error: "forbidden_streams" };
    }

    const cursors: Partial<Record<LiveStreamName, string>> = {};
    for (const stream of LIVE_STREAMS) {
      const cursor = input.cursor?.[stream];
      if (!cursor) {
        continue;
      }

      const decoded = decodeLiveCursor(cursor);
      if (!decoded) {
        client.emit("subscribe.error", {
          code: "invalid_cursor",
          message: `Invalid cursor for ${stream}`,
          stream
        });
        return { ok: false, error: "invalid_cursor" };
      }

      cursors[stream] = cursor;
    }

    this.clearClientDeltaSubscription(client);
    for (const stream of input.streams) {
      client.join(this.deltaRoom(user.tenantId, input.site_id, stream));
    }

    const nextSubscription: DeltaSubscription = {
      tenantId: user.tenantId,
      siteId: input.site_id,
      streams: input.streams,
      cursor: { ...cursors }
    };

    const ackCursor: Partial<Record<LiveStreamName, string>> = { ...cursors };
    try {
      for (const stream of input.streams) {
        const latestCursor = await this.sendCatchUpSnapshot(client, user.tenantId, input.site_id, stream, cursors[stream]);
        if (latestCursor) {
          ackCursor[stream] = latestCursor;
        }
      }
    } catch (error) {
      this.logger.warn(`Initial catch-up failed: ${error instanceof Error ? error.message : String(error)}`);
      this.clearClientDeltaSubscription(client);
      client.emit("subscribe.error", {
        code: "catchup_failed",
        message: "Failed to initialize delta subscription"
      });
      return { ok: false, error: "catchup_failed" };
    }

    nextSubscription.cursor = ackCursor;
    client.data.deltaSubscription = nextSubscription;
    this.subscribedClients.add(client.id);

    client.emit("subscribed", {
      site_id: input.site_id,
      streams: input.streams,
      cursor: ackCursor,
      mode: this.liveMode
    });

    return { ok: true };
  }

  publishLegacy(tenantId: string, channel: string, data: unknown) {
    if (!this.server || this.liveMode !== "dual") {
      return;
    }

    const legacyRoom = this.legacyRoom(tenantId);
    const recipients = this.roomSize(legacyRoom);
    if (recipients <= 0) {
      return;
    }

    const envelope = {
      channel,
      timestamp: new Date().toISOString(),
      data
    };

    this.server.to(legacyRoom).emit(channel, envelope);
    this.legacyMessagesSent += recipients;
    this.legacyBytesSent += this.payloadSize(envelope) * recipients;
  }

  publishRobotLastStateUpsert(tenantId: string, siteId: string, robotId: string) {
    this.queueUpsert(tenantId, siteId, "robot_last_state", robotId);
  }

  publishIncidentUpsert(tenantId: string, siteId: string, incidentId: string) {
    this.queueUpsert(tenantId, siteId, "incidents", incidentId);
  }

  publishMissionUpsert(tenantId: string, siteId: string, missionId: string) {
    this.queueUpsert(tenantId, siteId, "missions", missionId);
  }

  publishIncidentDelete(tenantId: string, siteId: string, incidentId: string) {
    this.queueDelete(tenantId, siteId, "incidents", incidentId);
  }

  publishMissionDelete(tenantId: string, siteId: string, missionId: string) {
    this.queueDelete(tenantId, siteId, "missions", missionId);
  }

  getLiveMetrics(): LiveMetricsSnapshot {
    return {
      mode: this.liveMode,
      connected_clients: this.server?.sockets?.sockets?.size ?? 0,
      subscribed_clients: this.subscribedClients.size,
      delta_messages_sent: this.deltaMessagesSent,
      legacy_messages_sent: this.legacyMessagesSent,
      delta_bytes_sent: this.deltaBytesSent,
      legacy_bytes_sent: this.legacyBytesSent,
      last_flush_at: this.lastFlushAt
    };
  }

  private async broadcastLegacyLiveUpdates() {
    const tenants = await this.prisma.tenant.findMany({ select: { id: true } });
    const nowMs = Date.now();

    for (const tenant of tenants) {
      const timestamp = new Date().toISOString();
      this.server.to(this.tenantRoom(tenant.id)).emit("live.heartbeat", {
        timestamp,
        reconnect_hint: "If disconnected, reconnect with handshake.auth.token"
      });

      if (this.liveMode !== "dual") {
        continue;
      }

      const legacyRoom = this.legacyRoom(tenant.id);
      if (this.roomSize(legacyRoom) <= 0) {
        continue;
      }

      const settings = await this.prisma.siteSetting.findMany({
        where: { tenantId: tenant.id },
        select: {
          siteId: true,
          robotOfflineAfterSeconds: true,
          robotStatePublishPeriodSeconds: true
        }
      });
      const settingsMap = new Map(
        settings.map((setting) => [
          setting.siteId,
          {
            offlineAfterSeconds: setting.robotOfflineAfterSeconds,
            publishPeriodSeconds: setting.robotStatePublishPeriodSeconds
          }
        ])
      );

      const minPublishPeriodSeconds = settings.length
        ? Math.max(
            1,
            Math.min(...settings.map((setting) => setting.robotStatePublishPeriodSeconds))
          )
        : DEFAULT_ROBOT_PUBLISH_PERIOD_SECONDS;
      const lastRobotPublish = this.tenantLastRobotPublishAt.get(tenant.id) ?? 0;
      const lastOpsPublish = this.tenantLastOpsPublishAt.get(tenant.id) ?? 0;
      const shouldEmitRobots = nowMs - lastRobotPublish >= minPublishPeriodSeconds * 1000;
      const shouldEmitOps = nowMs - lastOpsPublish >= DEFAULT_NON_ROBOT_PUBLISH_PERIOD_MS;

      if (!shouldEmitRobots && !shouldEmitOps) {
        continue;
      }

      const [robots, incidents, missions, telemetry] = await Promise.all([
        shouldEmitRobots ? this.getLegacyRobots(tenant.id, settingsMap) : Promise.resolve(null),
        shouldEmitOps
          ? this.prisma.incident.findMany({ where: { tenantId: tenant.id }, take: 25, orderBy: { createdAt: "desc" } })
          : Promise.resolve(null),
        shouldEmitOps
          ? this.prisma.mission.findMany({ where: { tenantId: tenant.id }, take: 25, orderBy: { createdAt: "desc" } })
          : Promise.resolve(null),
        shouldEmitOps
          ? this.prisma.telemetryPoint.findMany({ where: { tenantId: tenant.id }, take: 50, orderBy: { timestamp: "desc" } })
          : Promise.resolve(null)
      ]);

      if (shouldEmitRobots && robots) {
        this.emitLegacyToRoom(legacyRoom, "robots.live", { channel: "robots.live", timestamp, data: robots });
        this.tenantLastRobotPublishAt.set(tenant.id, nowMs);
      }

      if (shouldEmitOps && incidents && missions && telemetry) {
        this.emitLegacyToRoom(legacyRoom, "incidents.live", { channel: "incidents.live", timestamp, data: incidents });
        this.emitLegacyToRoom(legacyRoom, "missions.live", { channel: "missions.live", timestamp, data: missions });
        this.emitLegacyToRoom(legacyRoom, "telemetry.live", { channel: "telemetry.live", timestamp, data: telemetry });
        this.emitLegacyToRoom(legacyRoom, "alerts.live", { channel: "alerts.live", timestamp, data: [] });
        this.tenantLastOpsPublishAt.set(tenant.id, nowMs);
      }
    }
  }

  private emitLegacyToRoom(room: string, channel: string, payload: unknown) {
    const recipients = this.roomSize(room);
    if (recipients <= 0) {
      return;
    }

    this.server.to(room).emit(channel, payload);
    this.legacyMessagesSent += recipients;
    this.legacyBytesSent += this.payloadSize(payload) * recipients;
  }

  private queueUpsert(tenantId: string, siteId: string, stream: LiveStreamName, id: string) {
    const normalizedSite = siteId || "all";
    this.queueDeltaChange(tenantId, normalizedSite, stream, id, "upsert");

    if (normalizedSite !== "all") {
      this.queueDeltaChange(tenantId, "all", stream, id, "upsert");
    }
  }

  private queueDelete(tenantId: string, siteId: string, stream: LiveStreamName, id: string) {
    const normalizedSite = siteId || "all";
    this.queueDeltaChange(tenantId, normalizedSite, stream, id, "delete");

    if (normalizedSite !== "all") {
      this.queueDeltaChange(tenantId, "all", stream, id, "delete");
    }
  }

  private queueDeltaChange(
    tenantId: string,
    siteId: string,
    stream: LiveStreamName,
    id: string,
    kind: "upsert" | "delete"
  ) {
    const key = this.deltaBufferKey(tenantId, siteId, stream);
    const room = this.deltaRoom(tenantId, siteId, stream);

    if (this.roomSize(room) <= 0) {
      return;
    }

    const buffer = this.pendingBuffers.get(key) ?? { upserts: new Set<string>(), deletes: new Set<string>() };

    if (kind === "upsert") {
      buffer.upserts.add(id);
      buffer.deletes.delete(id);
    } else {
      buffer.deletes.add(id);
      buffer.upserts.delete(id);
    }

    if (!buffer.timer) {
      buffer.timer = setTimeout(() => {
        void this.flushDeltaBuffer(key);
      }, STREAM_COALESCE_WINDOW_MS[stream]);
    }

    this.pendingBuffers.set(key, buffer);
  }

  private async flushDeltaBuffer(key: string) {
    const parsed = this.parseDeltaBufferKey(key);
    if (!parsed) {
      return;
    }

    const { tenantId, siteId, stream } = parsed;
    const room = this.deltaRoom(tenantId, siteId, stream);
    const recipients = this.roomSize(room);
    if (recipients <= 0) {
      this.pendingBuffers.delete(key);
      return;
    }

    const buffer = this.pendingBuffers.get(key);
    if (!buffer) {
      return;
    }

    if (buffer.timer) {
      clearTimeout(buffer.timer);
      buffer.timer = undefined;
    }

    const upsertIds = [...buffer.upserts];
    const deleteIds = [...buffer.deletes];
    buffer.upserts.clear();
    buffer.deletes.clear();

    if (upsertIds.length === 0 && deleteIds.length === 0) {
      this.pendingBuffers.delete(key);
      return;
    }

    const upserts = await this.loadStreamRecordsByIds(tenantId, siteId, stream, upsertIds);
    const batches = this.chunk(upserts, SNAPSHOT_BATCH_SIZE);

    if (batches.length === 0 && deleteIds.length > 0) {
      const cursor = encodeLiveCursor(createLiveCursor(new Date(), deleteIds[0]));
      this.emitDeltaToRoom(
        room,
        {
          stream,
          cursor,
          upserts: [],
          deletes: deleteIds,
          snapshot: false,
          batch_index: 1,
          batch_total: 1
        },
        recipients
      );
      this.lastFlushAt = new Date().toISOString();
      this.pendingBuffers.delete(key);
      return;
    }

    for (let index = 0; index < batches.length; index += 1) {
      const batch = batches[index];
      const last = batch[batch.length - 1];
      if (!last) {
        continue;
      }
      const batchCursor = this.cursorForRecord(stream, last);
      const encodedCursor = encodeLiveCursor(batchCursor);
      this.emitDeltaToRoom(
        room,
        {
          stream,
          cursor: encodedCursor,
          upserts: batch,
          deletes: index === 0 ? deleteIds : [],
          snapshot: false,
          batch_index: index + 1,
          batch_total: batches.length
        },
        recipients
      );
    }

    this.lastFlushAt = new Date().toISOString();
    this.pendingBuffers.delete(key);
  }

  private emitDeltaToRoom(room: string, payload: unknown, recipients: number) {
    this.server.to(room).emit("delta", payload);
    this.deltaMessagesSent += recipients;
    this.deltaBytesSent += this.payloadSize(payload) * recipients;
  }

  private emitDeltaToClient(client: Socket, payload: unknown) {
    client.emit("delta", payload);
    this.deltaMessagesSent += 1;
    this.deltaBytesSent += this.payloadSize(payload);
  }

  private async sendCatchUpSnapshot(
    client: Socket,
    tenantId: string,
    siteId: string,
    stream: LiveStreamName,
    startCursor?: string
  ): Promise<string | undefined> {
    const decodedCursor = startCursor ? decodeLiveCursor(startCursor) : null;
    const records = await this.collectStreamRecordsAfterCursor(tenantId, siteId, stream, decodedCursor);

    if (records.length === 0) {
      if (!startCursor) {
        const emptyCursor = encodeLiveCursor(createLiveCursor(new Date(), "snapshot"));
        this.emitDeltaToClient(client, {
          stream,
          cursor: emptyCursor,
          upserts: [],
          deletes: [],
          snapshot: true,
          batch_index: 1,
          batch_total: 1
        });
        return emptyCursor;
      }
      return startCursor;
    }

    const batches = this.chunk(records, SNAPSHOT_BATCH_SIZE);
    let cursor = startCursor;

    for (let index = 0; index < batches.length; index += 1) {
      const batch = batches[index];
      const last = batch[batch.length - 1];
      if (!last) {
        continue;
      }
      const batchCursor = encodeLiveCursor(this.cursorForRecord(stream, last));
      this.emitDeltaToClient(client, {
        stream,
        cursor: batchCursor,
        upserts: batch,
        deletes: [],
        snapshot: true,
        batch_index: index + 1,
        batch_total: batches.length
      });
      cursor = batchCursor;
    }

    return cursor;
  }

  private async collectStreamRecordsAfterCursor(
    tenantId: string,
    siteId: string,
    stream: LiveStreamName,
    startCursor: LiveCursorV1 | null
  ) {
    const records: Array<Record<string, unknown>> = [];
    let cursor = startCursor;

    while (true) {
      const page = await this.loadStreamRecordsPage(tenantId, siteId, stream, cursor, 1000);
      if (page.length === 0) {
        break;
      }

      records.push(...page);
      const last = page[page.length - 1];
      if (!last) {
        break;
      }
      cursor = this.cursorForRecord(stream, last);
      if (page.length < 1000) {
        break;
      }
    }

    return records;
  }

  private async loadStreamRecordsByIds(tenantId: string, siteId: string, stream: LiveStreamName, ids: string[]) {
    if (ids.length === 0) {
      return [] as Array<Record<string, unknown>>;
    }

    if (stream === "robot_last_state") {
      const states = await this.prisma.robotLastState.findMany({
        where: {
          tenantId,
          ...(siteId !== "all" ? { siteId } : {}),
          robotId: { in: ids }
        },
        orderBy: [{ updatedAt: "asc" }, { robotId: "asc" }]
      });
      return this.hydrateRobotLastStateRows(tenantId, states);
    }

    if (stream === "incidents") {
      return this.prisma.incident.findMany({
        where: {
          tenantId,
          ...(siteId !== "all" ? { siteId } : {}),
          id: { in: ids }
        },
        include: {
          robot: true,
          mission: true,
          site: true,
          timeline: {
            orderBy: { timestamp: "asc" }
          }
        },
        orderBy: [{ updatedAt: "asc" }, { id: "asc" }]
      }) as Promise<Array<Record<string, unknown>>>;
    }

    return this.prisma.mission.findMany({
      where: {
        tenantId,
        ...(siteId !== "all" ? { siteId } : {}),
        id: { in: ids }
      },
      include: {
        assignedRobot: true,
        site: true
      },
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }]
    }) as Promise<Array<Record<string, unknown>>>;
  }

  private async loadStreamRecordsPage(
    tenantId: string,
    siteId: string,
    stream: LiveStreamName,
    cursor: LiveCursorV1 | null,
    take: number
  ) {
    if (stream === "robot_last_state") {
      const states = await this.prisma.robotLastState.findMany({
        where: {
          tenantId,
          ...(siteId !== "all" ? { siteId } : {}),
          ...(cursor
            ? {
                OR: [
                  { updatedAt: { gt: new Date(cursor.t) } },
                  {
                    AND: [{ updatedAt: new Date(cursor.t) }, { robotId: { gt: cursor.id } }]
                  }
                ]
              }
            : {})
        },
        orderBy: [{ updatedAt: "asc" }, { robotId: "asc" }],
        take
      });

      return this.hydrateRobotLastStateRows(tenantId, states);
    }

    if (stream === "incidents") {
      return (await this.prisma.incident.findMany({
        where: {
          tenantId,
          ...(siteId !== "all" ? { siteId } : {}),
          ...(cursor
            ? {
                OR: [
                  { updatedAt: { gt: new Date(cursor.t) } },
                  {
                    AND: [{ updatedAt: new Date(cursor.t) }, { id: { gt: cursor.id } }]
                  }
                ]
              }
            : {})
        },
        include: {
          robot: true,
          mission: true,
          site: true,
          timeline: {
            orderBy: { timestamp: "asc" }
          }
        },
        orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
        take
      })) as Array<Record<string, unknown>>;
    }

    return (await this.prisma.mission.findMany({
      where: {
        tenantId,
        ...(siteId !== "all" ? { siteId } : {}),
        ...(cursor
          ? {
              OR: [
                { updatedAt: { gt: new Date(cursor.t) } },
                {
                  AND: [{ updatedAt: new Date(cursor.t) }, { id: { gt: cursor.id } }]
                }
              ]
            }
          : {})
      },
      include: {
        assignedRobot: true,
        site: true
      },
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      take
    })) as Array<Record<string, unknown>>;
  }

  private async hydrateRobotLastStateRows(
    tenantId: string,
    states: Array<{
      tenantId: string;
      siteId: string;
      robotId: string;
      status: string;
      batteryPercent: number;
      lastSeenAt: Date;
      floorplanId: string;
      x: number;
      y: number;
      headingDegrees: number;
      confidence: number;
      cpuPercent: number;
      memoryPercent: number;
      tempC: number;
      diskPercent: number;
      networkRssi: number;
      healthScore: number;
      currentTaskId: string | null;
      currentTaskState: string | null;
      currentTaskPercentComplete: number | null;
      updatedAt: Date;
    }>
  ) {
    if (states.length === 0) {
      return [] as Array<Record<string, unknown>>;
    }

    const siteIds = [...new Set(states.map((row) => row.siteId))];
    const [robots, settings] = await Promise.all([
      this.prisma.robot.findMany({
        where: {
          tenantId,
          id: { in: states.map((row) => row.robotId) }
        },
        include: {
          vendor: true,
          site: true,
          missions: {
            where: {
              state: {
                in: ["queued", "running", "blocked"]
              }
            },
            take: 1,
            orderBy: { createdAt: "desc" }
          }
        }
      }),
      this.prisma.siteSetting.findMany({
        where: {
          tenantId,
          siteId: { in: siteIds }
        },
        select: {
          siteId: true,
          robotOfflineAfterSeconds: true
        }
      })
    ]);

    const robotById = new Map(robots.map((robot) => [robot.id, robot]));
    const offlineBySite = new Map(
      settings.map((setting) => [setting.siteId, Math.max(1, setting.robotOfflineAfterSeconds)])
    );

    const hydrated = states
      .map((row) => {
        const robot = robotById.get(row.robotId);
        if (!robot) {
          return null;
        }

        const offlineAfter = offlineBySite.get(row.siteId) ?? DEFAULT_ROBOT_OFFLINE_AFTER_SECONDS;
        const ageSeconds = Math.floor((Date.now() - row.lastSeenAt.getTime()) / 1000);
        const isOfflineComputed = ageSeconds > offlineAfter;

        return {
          ...robot,
          status: isOfflineComputed ? "offline" : row.status,
          batteryPercent: row.batteryPercent,
          lastSeenAt: row.lastSeenAt,
          floorplanId: row.floorplanId,
          x: row.x,
          y: row.y,
          headingDegrees: row.headingDegrees,
          confidence: row.confidence,
          cpuPercent: row.cpuPercent,
          memoryPercent: row.memoryPercent,
          tempC: row.tempC,
          diskPercent: row.diskPercent,
          networkRssi: row.networkRssi,
          healthScore: row.healthScore,
          currentTaskId: row.currentTaskId,
          currentTaskState: row.currentTaskState,
          currentTaskPercentComplete: row.currentTaskPercentComplete,
          reported_status: row.status,
          is_offline_computed: isOfflineComputed,
          updatedAt: row.updatedAt
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    return hydrated as Array<Record<string, unknown>>;
  }

  private cursorForRecord(stream: LiveStreamName, record: Record<string, unknown>): LiveCursorV1 {
    const id = String(record.id ?? record.robotId ?? "");
    if (!id) {
      return createLiveCursor(new Date(), "unknown");
    }

    if (stream === "robot_last_state") {
      const updatedAt = record.updatedAt instanceof Date ? record.updatedAt : new Date(String(record.updatedAt ?? record.lastSeenAt));
      return createLiveCursor(updatedAt, id);
    }

    const updatedAt = record.updatedAt instanceof Date ? record.updatedAt : new Date(String(record.updatedAt));
    return createLiveCursor(updatedAt, id);
  }

  private hasStreamPermission(user: SocketUser, stream: LiveStreamName) {
    return hasPermission(user.role, STREAM_PERMISSIONS[stream], user.permissions);
  }

  private clearClientDeltaSubscription(client: Socket) {
    const current = client.data.deltaSubscription as DeltaSubscription | undefined;
    if (!current) {
      return;
    }

    for (const stream of current.streams) {
      client.leave(this.deltaRoom(current.tenantId, current.siteId, stream));
    }

    delete client.data.deltaSubscription;
  }

  private extractToken(client: Socket): string | null {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === "string") {
      return authToken;
    }

    const header = client.handshake.headers.authorization;
    if (typeof header === "string" && header.startsWith("Bearer ")) {
      return header.replace("Bearer ", "");
    }

    return null;
  }

  private tenantRoom(tenantId: string) {
    return `tenant:${tenantId}`;
  }

  private legacyRoom(tenantId: string) {
    return `tenant:${tenantId}:legacy`;
  }

  private deltaRoom(tenantId: string, siteId: string, stream: LiveStreamName) {
    return `tenant:${tenantId}:delta:${siteId}:${stream}`;
  }

  private deltaBufferKey(tenantId: string, siteId: string, stream: LiveStreamName) {
    return `${tenantId}|${siteId}|${stream}`;
  }

  private parseDeltaBufferKey(key: string): { tenantId: string; siteId: string; stream: LiveStreamName } | null {
    const [tenantId, siteId, stream] = key.split("|");
    if (!tenantId || !siteId || !LIVE_STREAMS.includes(stream as LiveStreamName)) {
      return null;
    }

    return {
      tenantId,
      siteId,
      stream: stream as LiveStreamName
    };
  }

  private roomSize(room: string) {
    return this.server.sockets.adapter.rooms.get(room)?.size ?? 0;
  }

  private payloadSize(payload: unknown) {
    return Buffer.byteLength(JSON.stringify(payload), "utf8");
  }

  private chunk<T>(items: T[], size: number) {
    if (items.length === 0) {
      return [] as T[][];
    }

    const chunks: T[][] = [];
    for (let index = 0; index < items.length; index += size) {
      chunks.push(items.slice(index, index + size));
    }
    return chunks;
  }

  private async getLegacyRobots(
    tenantId: string,
    settingsMap: Map<string, { offlineAfterSeconds: number; publishPeriodSeconds: number }>
  ) {
    const states = await this.prisma.robotLastState.findMany({
      where: { tenantId },
      orderBy: { lastSeenAt: "desc" },
      take: 200
    });

    if (states.length > 0) {
      return states.map((row) => {
        const offlineAfterSeconds = Math.max(
          1,
          settingsMap.get(row.siteId)?.offlineAfterSeconds ?? DEFAULT_ROBOT_OFFLINE_AFTER_SECONDS
        );
        const ageSeconds = Math.floor((Date.now() - row.lastSeenAt.getTime()) / 1000);
        const isOfflineComputed = ageSeconds > offlineAfterSeconds;

        return {
          id: row.robotId,
          tenantId: row.tenantId,
          siteId: row.siteId,
          name: row.name,
          status: isOfflineComputed ? "offline" : row.status,
          reported_status: row.status,
          is_offline_computed: isOfflineComputed,
          batteryPercent: row.batteryPercent,
          lastSeenAt: row.lastSeenAt,
          floorplanId: row.floorplanId,
          x: row.x,
          y: row.y,
          headingDegrees: row.headingDegrees,
          confidence: row.confidence,
          healthScore: row.healthScore,
          cpuPercent: row.cpuPercent,
          memoryPercent: row.memoryPercent,
          tempC: row.tempC,
          diskPercent: row.diskPercent,
          networkRssi: row.networkRssi,
          currentTaskId: row.currentTaskId,
          currentTaskState: row.currentTaskState,
          currentTaskPercentComplete: row.currentTaskPercentComplete,
          updatedAt: row.updatedAt
        };
      });
    }

    const robots = await this.prisma.robot.findMany({
      where: { tenantId },
      orderBy: { lastSeenAt: "desc" },
      take: 200
    });

    return robots.map((robot) => {
      const offlineAfterSeconds = Math.max(
        1,
        settingsMap.get(robot.siteId)?.offlineAfterSeconds ?? DEFAULT_ROBOT_OFFLINE_AFTER_SECONDS
      );
      const ageSeconds = Math.floor((Date.now() - robot.lastSeenAt.getTime()) / 1000);
      const isOfflineComputed = ageSeconds > offlineAfterSeconds;

      return {
        ...robot,
        status: isOfflineComputed ? "offline" : robot.status,
        reported_status: robot.status,
        is_offline_computed: isOfflineComputed,
        healthScore: Math.max(0, Math.min(100, 100 - Math.round((robot.cpuPercent + robot.memoryPercent + robot.diskPercent) / 3))),
        currentTaskId: null,
        currentTaskState: null,
        currentTaskPercentComplete: null,
        updatedAt: robot.lastSeenAt
      };
    });
  }
}
