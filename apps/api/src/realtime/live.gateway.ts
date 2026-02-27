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

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  afterInit() {
    this.intervalRef = setInterval(() => {
      void this.broadcastLiveUpdates();
    }, 5000);
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

    for (const tenant of tenants) {
      const [robots, incidents, missions, telemetry] = await Promise.all([
        this.prisma.robot.findMany({ where: { tenantId: tenant.id }, take: 50, orderBy: { lastSeenAt: "desc" } }),
        this.prisma.incident.findMany({ where: { tenantId: tenant.id }, take: 25, orderBy: { createdAt: "desc" } }),
        this.prisma.mission.findMany({ where: { tenantId: tenant.id }, take: 25, orderBy: { createdAt: "desc" } }),
        this.prisma.telemetryPoint.findMany({ where: { tenantId: tenant.id }, take: 50, orderBy: { timestamp: "desc" } })
      ]);

      const timestamp = new Date().toISOString();

      this.server.to(`tenant:${tenant.id}`).emit("robots.live", { channel: "robots.live", timestamp, data: robots });
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
      this.server.to(`tenant:${tenant.id}`).emit("live.heartbeat", {
        timestamp,
        reconnect_hint: "If disconnected, reconnect with handshake.auth.token"
      });
    }
  }
}
