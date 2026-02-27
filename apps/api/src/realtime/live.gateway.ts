import { Inject } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from "@nestjs/websockets";
import jwt from "jsonwebtoken";
import type { Server, Socket } from "socket.io";
import { PrismaService } from "../services/prisma.service";

interface SocketUser {
  sub: string;
  tenantId: string;
  role: string;
  permissions: string[];
}

const DEFAULT_ROBOT_OFFLINE_AFTER_SECONDS = 15;
const DEFAULT_ROBOT_PUBLISH_PERIOD_SECONDS = 2;
const DEFAULT_NON_ROBOT_PUBLISH_PERIOD_MS = 5000;

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN?.split(",") ?? ["http://localhost:3000"],
    credentials: true
  }
})
export class LiveGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private intervalRef?: NodeJS.Timeout;
  private tenantLastRobotPublishAt = new Map<string, number>();
  private tenantLastOpsPublishAt = new Map<string, number>();

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  afterInit() {
    this.intervalRef = setInterval(() => {
      void this.broadcastLiveUpdates();
    }, 1000);
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
      client.data.user = user;
      client.join(`tenant:${user.tenantId}`);

      client.emit("live.connected", {
        ok: true,
        channels: ["robots.live", "incidents.live", "missions.live", "telemetry.live", "alerts.live"],
        reconnect_hint: "Send auth token in handshake.auth.token on reconnect"
      });
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect() {
    // no-op
  }

  @SubscribeMessage("live.subscribe")
  handleSubscribe(@ConnectedSocket() client: Socket, @MessageBody() payload: { channels?: string[] }) {
    const user = client.data.user as SocketUser | undefined;
    if (!user) {
      return { ok: false, error: "unauthorized" };
    }

    const channels = payload.channels ?? [];
    channels.forEach((channel) => {
      client.join(`tenant:${user.tenantId}:${channel}`);
    });

    return {
      ok: true,
      channels
    };
  }

  onModuleDestroy() {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
    }
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

  private async broadcastLiveUpdates() {
    const tenants = await this.prisma.tenant.findMany({ select: { id: true } });
    const nowMs = Date.now();

    for (const tenant of tenants) {
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
        shouldEmitRobots ? this.getLiveRobots(tenant.id, settingsMap) : Promise.resolve(null),
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

      const timestamp = new Date().toISOString();

      if (shouldEmitRobots && robots) {
        this.server.to(`tenant:${tenant.id}`).emit("robots.live", { channel: "robots.live", timestamp, data: robots });
        this.tenantLastRobotPublishAt.set(tenant.id, nowMs);
      }

      if (shouldEmitOps && incidents && missions && telemetry) {
        this.server.to(`tenant:${tenant.id}`).emit("incidents.live", {
          channel: "incidents.live",
          timestamp,
          data: incidents
        });
        this.server.to(`tenant:${tenant.id}`).emit("missions.live", { channel: "missions.live", timestamp, data: missions });
        this.server.to(`tenant:${tenant.id}`).emit("telemetry.live", {
          channel: "telemetry.live",
          timestamp,
          data: telemetry
        });
        this.server.to(`tenant:${tenant.id}`).emit("alerts.live", {
          channel: "alerts.live",
          timestamp,
          data: []
        });
        this.tenantLastOpsPublishAt.set(tenant.id, nowMs);
      }

      this.server.to(`tenant:${tenant.id}`).emit("live.heartbeat", {
        timestamp,
        reconnect_hint: "If disconnected, reconnect with handshake.auth.token"
      });
    }
  }

  private async getLiveRobots(
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
        currentTaskPercentComplete: null
      };
    });
  }
}
