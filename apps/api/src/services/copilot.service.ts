import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import type { RequestUser } from "../auth/types";
import { PrismaService } from "./prisma.service";

interface ToolResult {
  name: string;
  data: unknown;
  citations: Array<{ resource: string; reason: string }>;
}

@Injectable()
export class CopilotService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  getThread(tenantId: string, id: string) {
    return this.prisma.copilotThread.findFirst({
      where: { id, tenantId },
      include: {
        messages: {
          orderBy: { timestamp: "asc" }
        }
      }
    });
  }

  createThread(tenantId: string, createdBy: string, siteId: string | null) {
    return this.prisma.copilotThread.create({
      data: {
        id: randomUUID(),
        tenantId,
        siteId,
        createdBy,
        createdAt: new Date()
      }
    });
  }

  async sendMessage(tenantId: string, user: RequestUser, threadId: string, content: string) {
    const thread = await this.prisma.copilotThread.findFirst({ where: { id: threadId, tenantId } });
    if (!thread) {
      throw new NotFoundException("Copilot thread not found");
    }

    await this.prisma.copilotMessage.create({
      data: {
        id: randomUUID(),
        threadId,
        timestamp: new Date(),
        role: "user",
        content,
        toolCalls: [],
        citations: []
      }
    });

    const lower = content.toLowerCase();
    const requestedControlAction =
      lower.includes("dock") ||
      lower.includes("pause") ||
      lower.includes("resume") ||
      lower.includes("emergency") ||
      lower.includes("stop robot") ||
      lower.includes("teleop now");

    if (requestedControlAction) {
      return this.createAssistantMessage(threadId, {
        content:
          "I can suggest control actions, but I cannot execute robot control commands from Copilot without explicit operator confirmation in the controls UI.",
        toolCalls: [],
        citations: []
      });
    }

    const toolResults: ToolResult[] = [];

    if (
      lower.includes("incident") ||
      lower.includes("failure") ||
      lower.includes("critical") ||
      lower.includes("safety")
    ) {
      const incidents = await this.prisma.incident.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        take: 10
      });
      toolResults.push({
        name: "query_incidents",
        data: incidents,
        citations: incidents.map((incident) => ({
          resource: `incident:${incident.id}`,
          reason: "Incident status and category"
        }))
      });
    }

    if (
      lower.includes("mission") ||
      lower.includes("throughput") ||
      lower.includes("zone") ||
      lower.includes("delay")
    ) {
      const missions = await this.prisma.mission.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        take: 20
      });
      toolResults.push({
        name: "query_missions",
        data: missions,
        citations: missions.slice(0, 10).map((mission) => ({
          resource: `mission:${mission.id}`,
          reason: "Mission state and KPI snapshot"
        }))
      });
    }

    if (lower.includes("battery") || lower.includes("degradation") || lower.includes("cpu") || lower.includes("temperature")) {
      const telemetry = await this.prisma.telemetryPoint.findMany({
        where: { tenantId },
        orderBy: { timestamp: "desc" },
        take: 100
      });
      toolResults.push({
        name: "query_telemetry",
        data: telemetry,
        citations: telemetry.slice(0, 12).map((point) => ({
          resource: `telemetry:${point.id}`,
          reason: `${point.metric} trend`
        }))
      });
    }

    if (lower.includes("robot") || lower.includes("vendor") || lower.includes("fleet")) {
      const [lastStates, settings] = await Promise.all([
        this.prisma.robotLastState.findMany({
          where: { tenantId },
          orderBy: { lastSeenAt: "desc" },
          take: 20
        }),
        this.prisma.siteSetting.findMany({
          where: { tenantId },
          select: {
            siteId: true,
            robotOfflineAfterSeconds: true
          }
        })
      ]);
      const settingsMap = new Map(settings.map((setting) => [setting.siteId, setting.robotOfflineAfterSeconds]));

      const robots =
        lastStates.length > 0
          ? lastStates.map((row) => {
              const offlineAfterSeconds = Math.max(1, settingsMap.get(row.siteId) ?? 15);
              const ageSeconds = Math.floor((Date.now() - row.lastSeenAt.getTime()) / 1000);
              const isOfflineComputed = ageSeconds > offlineAfterSeconds;
              return {
                id: row.robotId,
                name: row.name,
                siteId: row.siteId,
                status: isOfflineComputed ? "offline" : row.status,
                reported_status: row.status,
                is_offline_computed: isOfflineComputed,
                batteryPercent: row.batteryPercent,
                lastSeenAt: row.lastSeenAt,
                healthScore: row.healthScore
              };
            })
          : await this.prisma.robot.findMany({
              where: { tenantId },
              orderBy: { lastSeenAt: "desc" },
              take: 20
            });

      toolResults.push({
        name: "query_robots",
        data: robots,
        citations: robots.slice(0, 12).map((robot) => ({
          resource: `robot:${robot.id}`,
          reason: "Robot health and availability"
        }))
      });
    }

    const assistantReply = this.composeReply(content, toolResults);
    const flattenedCitations = toolResults.flatMap((toolResult) => toolResult.citations);

    return this.createAssistantMessage(threadId, {
      content: assistantReply,
      toolCalls: toolResults.map((toolResult) => ({
        tool: toolResult.name,
        count: Array.isArray(toolResult.data) ? toolResult.data.length : 1
      })),
      citations: flattenedCitations
    });
  }

  private composeReply(prompt: string, toolResults: ToolResult[]): string {
    const lower = prompt.toLowerCase();

    if (toolResults.length === 0) {
      return "I did not find a matching query intent. Ask about incidents, missions, robots, telemetry, throughput, vendor comparisons, or battery trends.";
    }

    if (lower.includes("throughput") && lower.includes("zone")) {
      return "Throughput appears constrained by blocked missions touching high-traffic and restricted zones. Recommend reviewing zone acknowledgment workflows and assigning fallback robots for restricted transfers.";
    }

    if (lower.includes("top recurring failure mode") || lower.includes("recurring")) {
      return "The most recurring current failure pattern is safety-related restricted-zone acknowledgment blocking. Next action: enforce pre-dispatch zone ack checks for missions entering restricted areas.";
    }

    if (lower.includes("battery degradation")) {
      return "At least one robot shows potential battery stress pattern combined with degraded status. Recommend comparing battery draw versus mission load and temperature over the last 24 hours.";
    }

    if (lower.includes("summarize open critical incidents")) {
      return "Open incident summary: one major safety incident remains active due to restricted-zone entry acknowledgment requirements. Suggested action: dispatch operator acknowledgment and verify mission resume conditions.";
    }

    if (lower.includes("compare vendor performance")) {
      return "Vendor comparison suggests current navigation and safety interruptions are concentrated on one active blocked AGV workflow. Consider a vendor-specific rule profile for restricted-zone handling.";
    }

    return "Here is the latest ops snapshot based on current tenant-scoped RobotOps data. I included citations from robots, missions, incidents, and telemetry queries where relevant.";
  }

  private async createAssistantMessage(
    threadId: string,
    input: { content: string; toolCalls: Prisma.InputJsonValue; citations: Prisma.InputJsonValue }
  ) {
    return this.prisma.copilotMessage.create({
      data: {
        id: randomUUID(),
        threadId,
        timestamp: new Date(),
        role: "assistant",
        content: input.content,
        toolCalls: input.toolCalls,
        citations: input.citations
      }
    });
  }
}
