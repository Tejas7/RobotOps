import { BadRequestException, Inject, Injectable, NotFoundException, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import {
  DEPRECATED_PERMISSIONS,
  PERMISSIONS,
  PERMISSION_ALIASES,
  ROLES,
  alertPolicyPatchSchema,
  alertPolicySchema,
  alertRuleCreateSchema,
  alertRulePatchSchema,
  alertTestRouteSchema,
  crossSiteAnalyticsQuerySchema,
  normalizePermissions,
  permissionsForRole,
  roleScopeOverridePatchSchema,
  telemetryIngestEventSchema,
  telemetryIngestSchema,
  type Role
} from "@robotops/shared";
import type { RequestUser } from "../auth/types";
import { LiveGateway } from "../realtime/live.gateway";
import { AuditService } from "./audit.service";
import { InfrastructureService } from "./infrastructure.service";
import { NatsJetStreamService } from "./nats-jetstream.service";
import { PrismaService } from "./prisma.service";

interface AlertEventFilters {
  state?: string;
  severity?: string;
  site_id?: string;
  incident_id?: string;
  cursor?: string;
  limit?: number;
}

interface AnalyticsQuery {
  site_id?: string;
  site_ids?: string[];
  from?: string;
  to?: string;
  granularity?: "hour" | "day";
  use_rollups?: boolean;
}

const SEVERITY_ORDER: Record<string, number> = {
  info: 1,
  warning: 2,
  major: 3,
  critical: 4
};

@Injectable()
export class Phase3Service implements OnModuleInit, OnModuleDestroy {
  private ingestionTimer?: NodeJS.Timeout;
  private rollupTimer?: NodeJS.Timeout;
  private alertTimer?: NodeJS.Timeout;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly auditService: AuditService,
    @Inject(NatsJetStreamService) private readonly nats: NatsJetStreamService,
    @Inject(InfrastructureService) private readonly infra: InfrastructureService,
    @Inject(LiveGateway) private readonly live: LiveGateway
  ) {}

  onModuleInit() {
    this.ingestionTimer = setInterval(() => {
      void this.processIngestionTick();
    }, 1200);

    const rollupMs = Math.max(15, Number(process.env.ROLLUP_JOB_INTERVAL_SECONDS ?? 300)) * 1000;
    this.rollupTimer = setInterval(() => {
      void this.refreshRollups();
    }, rollupMs);

    const alertMs = Math.max(5, Number(process.env.ALERT_ENGINE_INTERVAL_SECONDS ?? 15)) * 1000;
    this.alertTimer = setInterval(() => {
      void this.runAlertEngineTick();
    }, alertMs);
  }

  onModuleDestroy() {
    if (this.ingestionTimer) {
      clearInterval(this.ingestionTimer);
    }
    if (this.rollupTimer) {
      clearInterval(this.rollupTimer);
    }
    if (this.alertTimer) {
      clearInterval(this.alertTimer);
    }
  }

  async ingestTelemetry(tenantId: string, user: RequestUser, input: unknown) {
    const parsed = telemetryIngestSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    let accepted = 0;
    let duplicate = 0;
    let queued = 0;

    for (const event of parsed.data.events) {
      const dedupeKey =
        event.dedupe_key ??
        event.event_id ??
        `${parsed.data.source}:${event.robot_id}:${event.timestamp}:${Object.entries(event.metrics)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([metric, value]) => `${metric}:${value}`)
          .join("|")}`;

      const existing = await this.prisma.ingestionEvent.findUnique({
        where: {
          tenantId_dedupeKey: {
            tenantId,
            dedupeKey
          }
        }
      });

      if (existing) {
        duplicate += 1;
        continue;
      }

      const created = await this.prisma.ingestionEvent.create({
        data: {
          id: randomUUID(),
          tenantId,
          source: parsed.data.source,
          dedupeKey,
          status: "queued",
          payload: this.toJson(event)
        }
      });

      accepted += 1;

      const publish = await this.nats.publishTelemetry({
        ingestion_event_id: created.id,
        tenant_id: tenantId,
        source: parsed.data.source
      });
      if (publish.accepted) {
        queued += 1;
        await this.prisma.ingestionEvent.update({
          where: { id: created.id },
          data: { status: "published" }
        });
      }
    }

    await this.auditService.log(tenantId, {
      action: "telemetry.ingested",
      resourceType: "robot",
      resourceId: "batch",
      diff: {
        before: null,
        after: {
          source: parsed.data.source,
          accepted,
          duplicate,
          queued
        }
      },
      actorType: "user",
      actorId: user.sub
    });

    return {
      accepted,
      duplicate,
      queued,
      source: parsed.data.source
    };
  }

  async getAnalyticsDashboard(tenantId: string, query: AnalyticsQuery) {
    const parsed = crossSiteAnalyticsQuerySchema.safeParse({
      site_id: query.site_id,
      site_ids: query.site_ids ?? [],
      from: query.from,
      to: query.to,
      granularity: query.granularity,
      use_rollups: query.use_rollups
    });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const window = this.parseWindow(parsed.data.from, parsed.data.to);
    const selectedSiteIds = await this.resolveSiteIds(tenantId, parsed.data.site_id, parsed.data.site_ids);

    const [robots, missions, incidents] = await Promise.all([
      this.prisma.robot.findMany({
        where: {
          tenantId,
          siteId: { in: selectedSiteIds }
        }
      }),
      this.prisma.mission.findMany({
        where: {
          tenantId,
          siteId: { in: selectedSiteIds },
          createdAt: {
            gte: window.from,
            lte: window.to
          }
        },
        include: {
          assignedRobot: true
        }
      }),
      this.prisma.incident.findMany({
        where: {
          tenantId,
          siteId: { in: selectedSiteIds },
          createdAt: {
            gte: window.from,
            lte: window.to
          }
        },
        include: {
          robot: true
        }
      })
    ]);

    const missionCount = missions.length;
    const succeededMissions = missions.filter((mission) => mission.state === "succeeded").length;
    const interventions = missions.reduce((sum, mission) => sum + mission.interventionsCount, 0);

    const throughputByHour = new Map<string, number>();
    for (const mission of missions) {
      const key = `${mission.createdAt.getUTCHours().toString().padStart(2, "0")}:00`;
      throughputByHour.set(key, (throughputByHour.get(key) ?? 0) + 1);
    }

    const zoneThroughput = new Map<string, number>();
    for (const mission of missions) {
      const waypoints = Array.isArray(mission.routeWaypoints) ? mission.routeWaypoints : [];
      for (const waypoint of waypoints) {
        const zone =
          typeof waypoint === "object" && waypoint && "zone_id" in waypoint
            ? (waypoint as { zone_id?: string }).zone_id
            : undefined;
        if (zone) {
          zoneThroughput.set(zone, (zoneThroughput.get(zone) ?? 0) + 1);
        }
      }
    }

    const failureModes = new Map<string, number>();
    for (const incident of incidents) {
      const key = `${incident.category}:${incident.robot?.vendorId ?? "unknown_vendor"}`;
      failureModes.set(key, (failureModes.get(key) ?? 0) + 1);
    }

    const energyByRobot = new Map<string, number>();
    const missionByRobot = new Map<string, number>();
    for (const mission of missions) {
      if (!mission.assignedRobotId) {
        continue;
      }
      energyByRobot.set(mission.assignedRobotId, (energyByRobot.get(mission.assignedRobotId) ?? 0) + mission.energyUsedWh);
      missionByRobot.set(mission.assignedRobotId, (missionByRobot.get(mission.assignedRobotId) ?? 0) + 1);
    }

    const windowHours = Math.max(1, (window.to.getTime() - window.from.getTime()) / (1000 * 60 * 60));
    const utilizationByRobot = robots.map((robot) => {
      const totalMissionSeconds = missions
        .filter((mission) => mission.assignedRobotId === robot.id)
        .reduce((sum, mission) => sum + mission.durationS, 0);
      const utilizationPercent = Math.min(100, (totalMissionSeconds / (windowHours * 3600)) * 100);
      return {
        robotId: robot.id,
        name: robot.name,
        utilizationPercent: Math.round(utilizationPercent),
        idlePercent: Math.max(0, Math.round(100 - utilizationPercent))
      };
    });

    const openIncidents = incidents.filter((incident) => incident.status !== "resolved").length;
    const uptimePercent = robots.length ? Math.round((robots.filter((robot) => robot.status === "online").length / robots.length) * 100) : 0;

    const bySite = selectedSiteIds.map((siteId) => {
      const siteMissions = missions.filter((mission) => mission.siteId === siteId);
      const siteIncidents = incidents.filter((incident) => incident.siteId === siteId && incident.status !== "resolved");
      const siteRobots = robots.filter((robot) => robot.siteId === siteId);
      const siteInterventions = siteMissions.reduce((sum, mission) => sum + mission.interventionsCount, 0);
      const siteUptime = siteRobots.length
        ? Math.round((siteRobots.filter((robot) => robot.status === "online").length / siteRobots.length) * 100)
        : 0;

      return {
        siteId,
        missionsTotal: siteMissions.length,
        missionsSucceeded: siteMissions.filter((mission) => mission.state === "succeeded").length,
        incidentsOpen: siteIncidents.length,
        interventionsPer100Missions: siteMissions.length ? Number(((siteInterventions / siteMissions.length) * 100).toFixed(2)) : 0,
        uptimePercent: siteUptime
      };
    });

    return {
      window: {
        from: window.from.toISOString(),
        to: window.to.toISOString(),
        granularity: parsed.data.granularity
      },
      selectedSites: selectedSiteIds,
      kpis: {
        fleetSize: robots.length,
        uptimePercent,
        missionsTotal: missionCount,
        missionsSucceeded: succeededMissions,
        incidentsOpen: openIncidents,
        interventionsPer100Missions: missionCount ? Number(((interventions / missionCount) * 100).toFixed(2)) : 0
      },
      missionThroughputByHour: Array.from(throughputByHour.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([hour, count]) => ({ hour, count })),
      missionThroughputByZone: Array.from(zoneThroughput.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([zone, count]) => ({ zone, count })),
      topFailureModes: Array.from(failureModes.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
        .map(([key, count]) => {
          const [category, vendorId] = key.split(":");
          return { category, vendorId, count };
        }),
      energyUsageByRobot: Array.from(energyByRobot.entries())
        .map(([robotId, energyWh]) => ({
          robotId,
          energyWh,
          missionCount: missionByRobot.get(robotId) ?? 0
        }))
        .sort((a, b) => b.energyWh - a.energyWh),
      utilizationByRobot,
      crossSiteBySite: bySite
    };
  }

  async getCrossSiteAnalytics(tenantId: string, query: AnalyticsQuery) {
    const parsed = crossSiteAnalyticsQuerySchema.safeParse({
      site_id: query.site_id,
      site_ids: query.site_ids ?? [],
      from: query.from,
      to: query.to,
      granularity: query.granularity,
      use_rollups: query.use_rollups
    });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const window = this.parseWindow(parsed.data.from, parsed.data.to);
    const selectedSiteIds = await this.resolveSiteIds(tenantId, parsed.data.site_id, parsed.data.site_ids);

    let rollupRows = await this.prisma.siteAnalyticsRollupHourly.findMany({
      where: {
        tenantId,
        siteId: { in: selectedSiteIds },
        bucketStart: {
          gte: window.from,
          lte: window.to
        }
      },
      orderBy: { bucketStart: "asc" }
    });

    if (!parsed.data.use_rollups || rollupRows.length === 0) {
      await this.refreshRollups();
      rollupRows = await this.prisma.siteAnalyticsRollupHourly.findMany({
        where: {
          tenantId,
          siteId: { in: selectedSiteIds },
          bucketStart: {
            gte: window.from,
            lte: window.to
          }
        },
        orderBy: { bucketStart: "asc" }
      });
    }

    const bySite = new Map<string, { missionsTotal: number; missionsSucceeded: number; incidentsOpen: number; interventionsCount: number; uptimePercentTotal: number; rows: number }>();
    const trend = rollupRows.map((row) => ({
      bucketStart: row.bucketStart.toISOString(),
      siteId: row.siteId,
      missionsTotal: row.missionsTotal,
      incidentsOpen: row.incidentsOpen
    }));

    for (const row of rollupRows) {
      const current = bySite.get(row.siteId) ?? {
        missionsTotal: 0,
        missionsSucceeded: 0,
        incidentsOpen: 0,
        interventionsCount: 0,
        uptimePercentTotal: 0,
        rows: 0
      };

      current.missionsTotal += row.missionsTotal;
      current.missionsSucceeded += row.missionsSucceeded;
      current.incidentsOpen += row.incidentsOpen;
      current.interventionsCount += row.interventionsCount;
      current.uptimePercentTotal += row.uptimePercent;
      current.rows += 1;
      bySite.set(row.siteId, current);
    }

    const bySiteList = Array.from(bySite.entries()).map(([siteId, value]) => ({
      siteId,
      missionsTotal: value.missionsTotal,
      missionsSucceeded: value.missionsSucceeded,
      incidentsOpen: value.incidentsOpen,
      interventionsPer100Missions: value.missionsTotal ? Number(((value.interventionsCount / value.missionsTotal) * 100).toFixed(2)) : 0,
      uptimePercent: value.rows ? Math.round(value.uptimePercentTotal / value.rows) : 0
    }));

    return {
      window: {
        from: window.from.toISOString(),
        to: window.to.toISOString(),
        granularity: parsed.data.granularity
      },
      totals: {
        sites: bySiteList.length,
        missionsTotal: bySiteList.reduce((sum, row) => sum + row.missionsTotal, 0),
        missionsSucceeded: bySiteList.reduce((sum, row) => sum + row.missionsSucceeded, 0),
        incidentsOpen: bySiteList.reduce((sum, row) => sum + row.incidentsOpen, 0)
      },
      bySite: bySiteList,
      trend
    };
  }

  async exportAnalytics(tenantId: string, format: string | undefined, dataset: string | undefined, query: AnalyticsQuery) {
    const selectedFormat = format === "pdf" ? "pdf" : "csv";
    const selectedDataset = dataset === "cross_site" ? "cross_site" : "dashboard";

    if (selectedDataset === "cross_site") {
      const data = await this.getCrossSiteAnalytics(tenantId, query);
      if (selectedFormat === "pdf") {
        const lines = [
          "RobotOps cross-site analytics summary",
          `Window: ${data.window.from} -> ${data.window.to}`,
          `Sites: ${data.totals.sites}`,
          `Missions total: ${data.totals.missionsTotal}`,
          `Missions succeeded: ${data.totals.missionsSucceeded}`,
          `Incidents open: ${data.totals.incidentsOpen}`
        ];
        const pdf = this.createSimplePdf(lines);
        return {
          dataset: selectedDataset,
          format: "pdf",
          filename: `analytics-cross-site-${Date.now()}.pdf`,
          contentType: "application/pdf",
          content: pdf.toString("base64")
        };
      }

      const rows = [
        ["site_id", "missions_total", "missions_succeeded", "incidents_open", "interventions_per_100_missions", "uptime_percent"],
        ...data.bySite.map((site) => [
          site.siteId,
          String(site.missionsTotal),
          String(site.missionsSucceeded),
          String(site.incidentsOpen),
          String(site.interventionsPer100Missions),
          String(site.uptimePercent)
        ])
      ];

      return {
        dataset: selectedDataset,
        format: "csv",
        filename: `analytics-cross-site-${Date.now()}.csv`,
        contentType: "text/csv",
        content: rows.map((row) => row.join(",")).join("\n")
      };
    }

    const data = await this.getAnalyticsDashboard(tenantId, query);
    if (selectedFormat === "pdf") {
      const lines = [
        "RobotOps analytics summary",
        `Window: ${data.window.from} -> ${data.window.to}`,
        `Fleet size: ${data.kpis.fleetSize}`,
        `Uptime: ${data.kpis.uptimePercent}%`,
        `Missions total: ${data.kpis.missionsTotal}`,
        `Incidents open: ${data.kpis.incidentsOpen}`,
        `Interventions/100 missions: ${data.kpis.interventionsPer100Missions}`
      ];
      const pdf = this.createSimplePdf(lines);

      return {
        dataset: selectedDataset,
        format: "pdf",
        filename: `analytics-dashboard-${Date.now()}.pdf`,
        contentType: "application/pdf",
        content: pdf.toString("base64")
      };
    }

    const rows = [
      ["metric", "value"],
      ["fleet_size", String(data.kpis.fleetSize)],
      ["uptime_percent", String(data.kpis.uptimePercent)],
      ["missions_total", String(data.kpis.missionsTotal)],
      ["missions_succeeded", String(data.kpis.missionsSucceeded)],
      ["incidents_open", String(data.kpis.incidentsOpen)],
      ["interventions_per_100_missions", String(data.kpis.interventionsPer100Missions)]
    ];

    return {
      dataset: selectedDataset,
      format: "csv",
      filename: `analytics-dashboard-${Date.now()}.csv`,
      contentType: "text/csv",
      content: rows.map((row) => row.join(",")).join("\n")
    };
  }

  getScopeCatalog() {
    return {
      version: 2,
      scopes: PERMISSIONS,
      deprecatedScopes: DEPRECATED_PERMISSIONS,
      aliases: PERMISSION_ALIASES
    };
  }

  async getRoleScopeMatrix(tenantId: string) {
    const overrides = await this.prisma.roleScopeOverride.findMany({ where: { tenantId } });

    const rows = Object.keys(ROLES).map((roleName) => {
      const role = roleName as Role;
      const baseScopes = permissionsForRole(role);
      const override = overrides.find((entry) => entry.role === role) ?? null;

      const allowScopes = normalizePermissions(override?.allowScopes ?? []);
      const denyScopes = normalizePermissions(override?.denyScopes ?? []);
      const effectiveScopes = normalizePermissions([
        ...baseScopes,
        ...allowScopes
      ]).filter((scope) => !denyScopes.includes(scope));

      return {
        role,
        baseScopes,
        effectiveScopes,
        overrides: override
          ? {
              role: override.role as Role,
              allowScopes,
              denyScopes
            }
          : null
      };
    });

    return {
      tenantId,
      roles: rows
    };
  }

  async patchRoleScopeOverride(tenantId: string, user: RequestUser, role: string, input: unknown) {
    const parsed = roleScopeOverridePatchSchema.safeParse({
      ...(typeof input === "object" && input ? input : {}),
      role
    });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const allowScopes = normalizePermissions(parsed.data.allow_scopes);
    const denyScopes = normalizePermissions(parsed.data.deny_scopes);

    const current = await this.prisma.roleScopeOverride.findUnique({
      where: {
        tenantId_role: {
          tenantId,
          role: parsed.data.role
        }
      }
    });

    const updated = await this.prisma.roleScopeOverride.upsert({
      where: {
        tenantId_role: {
          tenantId,
          role: parsed.data.role
        }
      },
      update: {
        allowScopes,
        denyScopes,
        updatedBy: user.sub
      },
      create: {
        id: randomUUID(),
        tenantId,
        role: parsed.data.role,
        allowScopes,
        denyScopes,
        createdBy: user.sub,
        updatedBy: user.sub
      }
    });

    await this.auditService.log(tenantId, {
      action: "rbac.role_scope_override.updated",
      resourceType: "config",
      resourceId: updated.id,
      diff: {
        before: current,
        after: updated
      },
      actorType: "user",
      actorId: user.sub
    });

    return updated;
  }

  async listAlertPolicies(tenantId: string) {
    return this.prisma.alertPolicy.findMany({
      where: { tenantId },
      include: {
        steps: {
          orderBy: { orderIndex: "asc" }
        }
      },
      orderBy: { name: "asc" }
    });
  }

  async createAlertPolicy(tenantId: string, user: RequestUser, input: unknown) {
    const parsed = alertPolicySchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const policyId = randomUUID();
    const created = await this.prisma.alertPolicy.create({
      data: {
        id: policyId,
        tenantId,
        name: parsed.data.name,
        description: parsed.data.description,
        isActive: parsed.data.is_active,
        createdBy: user.sub,
        steps: {
          createMany: {
            data: parsed.data.steps.map((step, index) => ({
              id: randomUUID(),
              tenantId,
              orderIndex: index,
              delaySeconds: step.delay_seconds,
              channel: step.channel,
              target: step.target,
              severityMin: step.severity_min ?? null,
              template: step.template ?? null
            }))
          }
        }
      },
      include: {
        steps: {
          orderBy: { orderIndex: "asc" }
        }
      }
    });

    await this.auditService.log(tenantId, {
      action: "alert_policy.created",
      resourceType: "config",
      resourceId: created.id,
      diff: {
        before: null,
        after: created
      },
      actorType: "user",
      actorId: user.sub
    });

    return created;
  }

  async patchAlertPolicy(tenantId: string, user: RequestUser, id: string, input: unknown) {
    const parsed = alertPolicyPatchSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const current = await this.prisma.alertPolicy.findFirst({
      where: { id, tenantId },
      include: { steps: { orderBy: { orderIndex: "asc" } } }
    });
    if (!current) {
      throw new NotFoundException("Alert policy not found");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const base = await tx.alertPolicy.update({
        where: { id },
        data: {
          ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
          ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
          ...(parsed.data.is_active !== undefined ? { isActive: parsed.data.is_active } : {})
        }
      });

      if (parsed.data.steps) {
        await tx.alertPolicyStep.deleteMany({ where: { tenantId, policyId: id } });
        await tx.alertPolicyStep.createMany({
          data: parsed.data.steps.map((step, index) => ({
            id: randomUUID(),
            tenantId,
            policyId: id,
            orderIndex: index,
            delaySeconds: step.delay_seconds,
            channel: step.channel,
            target: step.target,
            severityMin: step.severity_min ?? null,
            template: step.template ?? null
          }))
        });
      }

      const withSteps = await tx.alertPolicy.findUnique({
        where: { id: base.id },
        include: { steps: { orderBy: { orderIndex: "asc" } } }
      });
      if (!withSteps) {
        throw new NotFoundException("Alert policy not found after update");
      }
      return withSteps;
    });

    await this.auditService.log(tenantId, {
      action: "alert_policy.updated",
      resourceType: "config",
      resourceId: updated.id,
      diff: {
        before: current,
        after: updated
      },
      actorType: "user",
      actorId: user.sub
    });

    return updated;
  }

  async deleteAlertPolicy(tenantId: string, user: RequestUser, id: string) {
    const current = await this.prisma.alertPolicy.findFirst({
      where: { id, tenantId },
      include: { steps: true }
    });
    if (!current) {
      throw new NotFoundException("Alert policy not found");
    }

    const linkedRules = await this.prisma.alertRule.count({
      where: {
        tenantId,
        policyId: id,
        isActive: true
      }
    });
    if (linkedRules > 0) {
      throw new BadRequestException("Policy is in use by active alert rules");
    }

    await this.prisma.alertPolicy.delete({ where: { id } });

    await this.auditService.log(tenantId, {
      action: "alert_policy.deleted",
      resourceType: "config",
      resourceId: id,
      diff: {
        before: current,
        after: null
      },
      actorType: "user",
      actorId: user.sub
    });

    return { deleted: true, id };
  }

  async listAlertRules(tenantId: string) {
    return this.prisma.alertRule.findMany({
      where: { tenantId },
      include: {
        policy: {
          include: {
            steps: { orderBy: { orderIndex: "asc" } }
          }
        }
      },
      orderBy: [{ priority: "asc" }, { name: "asc" }]
    });
  }

  async createAlertRule(tenantId: string, user: RequestUser, input: unknown) {
    const parsed = alertRuleCreateSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const policy = await this.prisma.alertPolicy.findFirst({ where: { id: parsed.data.policy_id, tenantId } });
    if (!policy) {
      throw new NotFoundException("Alert policy not found");
    }

    const created = await this.prisma.alertRule.create({
      data: {
        id: randomUUID(),
        tenantId,
        name: parsed.data.name,
        eventType: parsed.data.event_type,
        policyId: parsed.data.policy_id,
        priority: parsed.data.priority,
        isActive: parsed.data.is_active,
        severity: parsed.data.severity ?? null,
        category: parsed.data.category ?? null,
        siteId: parsed.data.site_id ?? null,
        conditions: this.toJson(parsed.data.conditions),
        createdBy: user.sub
      }
    });

    await this.auditService.log(tenantId, {
      action: "alert_rule.created",
      resourceType: "config",
      resourceId: created.id,
      diff: {
        before: null,
        after: created
      },
      actorType: "user",
      actorId: user.sub
    });

    return created;
  }

  async patchAlertRule(tenantId: string, user: RequestUser, id: string, input: unknown) {
    const parsed = alertRulePatchSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const current = await this.prisma.alertRule.findFirst({ where: { id, tenantId } });
    if (!current) {
      throw new NotFoundException("Alert rule not found");
    }

    if (parsed.data.policy_id) {
      const policy = await this.prisma.alertPolicy.findFirst({ where: { id: parsed.data.policy_id, tenantId } });
      if (!policy) {
        throw new NotFoundException("Alert policy not found");
      }
    }

    const updated = await this.prisma.alertRule.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.policy_id !== undefined ? { policyId: parsed.data.policy_id } : {}),
        ...(parsed.data.priority !== undefined ? { priority: parsed.data.priority } : {}),
        ...(parsed.data.is_active !== undefined ? { isActive: parsed.data.is_active } : {}),
        ...(parsed.data.severity !== undefined ? { severity: parsed.data.severity } : {}),
        ...(parsed.data.category !== undefined ? { category: parsed.data.category } : {}),
        ...(parsed.data.site_id !== undefined ? { siteId: parsed.data.site_id } : {}),
        ...(parsed.data.conditions !== undefined ? { conditions: this.toJson(parsed.data.conditions) } : {})
      }
    });

    await this.auditService.log(tenantId, {
      action: "alert_rule.updated",
      resourceType: "config",
      resourceId: updated.id,
      diff: {
        before: current,
        after: updated
      },
      actorType: "user",
      actorId: user.sub
    });

    return updated;
  }

  async deleteAlertRule(tenantId: string, user: RequestUser, id: string) {
    const current = await this.prisma.alertRule.findFirst({ where: { id, tenantId } });
    if (!current) {
      throw new NotFoundException("Alert rule not found");
    }

    await this.prisma.alertRule.delete({ where: { id } });

    await this.auditService.log(tenantId, {
      action: "alert_rule.deleted",
      resourceType: "config",
      resourceId: id,
      diff: {
        before: current,
        after: null
      },
      actorType: "user",
      actorId: user.sub
    });

    return { deleted: true, id };
  }

  async listAlertEvents(tenantId: string, filters: AlertEventFilters) {
    const limit = Math.min(200, Math.max(1, filters.limit ?? 50));
    const cursorDate = filters.cursor ? new Date(filters.cursor) : null;
    if (cursorDate && Number.isNaN(cursorDate.getTime())) {
      throw new BadRequestException("Invalid cursor timestamp");
    }

    const rows = await this.prisma.alertEvent.findMany({
      where: {
        tenantId,
        ...(filters.state ? { state: filters.state } : {}),
        ...(filters.severity ? { severity: filters.severity } : {}),
        ...(filters.incident_id ? { incidentId: filters.incident_id } : {}),
        ...(cursorDate ? { triggeredAt: { lt: cursorDate } } : {}),
        ...(filters.site_id
          ? {
              payload: {
                path: ["site_id"],
                equals: filters.site_id
              }
            }
          : {})
      },
      include: {
        deliveries: {
          orderBy: { scheduledFor: "asc" }
        }
      },
      orderBy: [{ triggeredAt: "desc" }, { id: "desc" }],
      take: limit + 1
    });

    const items = rows.slice(0, limit);
    const nextCursor = rows.length > limit ? items[items.length - 1]?.triggeredAt.toISOString() ?? null : null;

    return {
      items,
      next_cursor: nextCursor
    };
  }

  async acknowledgeAlertEvent(tenantId: string, user: RequestUser, id: string) {
    const current = await this.prisma.alertEvent.findFirst({ where: { id, tenantId } });
    if (!current) {
      throw new NotFoundException("Alert event not found");
    }

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const event = await tx.alertEvent.update({
        where: { id },
        data: {
          state: "acknowledged",
          acknowledgedAt: now,
          acknowledgedBy: user.sub
        }
      });

      await tx.alertDelivery.updateMany({
        where: {
          tenantId,
          alertEventId: id,
          state: "scheduled"
        },
        data: {
          state: "canceled",
          sentAt: now,
          message: "Delivery canceled after acknowledgment"
        }
      });

      return event;
    });

    await this.auditService.log(tenantId, {
      action: "alert_event.acknowledged",
      resourceType: "incident",
      resourceId: id,
      diff: {
        before: current,
        after: updated
      },
      actorType: "user",
      actorId: user.sub
    });

    this.emitLive(tenantId, "alerts.live", {
      type: "alert.acknowledged",
      event: updated
    });

    return updated;
  }

  async testAlertRoute(tenantId: string, user: RequestUser, input: unknown) {
    const parsed = alertTestRouteSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const rules = await this.prisma.alertRule.findMany({
      where: {
        tenantId,
        eventType: parsed.data.event_type,
        isActive: true
      },
      include: {
        policy: {
          include: {
            steps: {
              orderBy: { orderIndex: "asc" }
            }
          }
        }
      },
      orderBy: { priority: "asc" }
    });

    const payload = {
      site_id: parsed.data.site_id ?? null,
      severity: parsed.data.severity ?? "warning",
      category: parsed.data.category ?? null,
      incident_id: parsed.data.incident_id ?? null,
      integration_id: parsed.data.integration_id ?? null,
      ...parsed.data.payload
    };

    const matched = rules.filter((rule) => this.matchesAlertRule(rule, payload));
    const createdEvents = [];
    for (const rule of matched) {
      const created = await this.createAlertEventFromRule(
        tenantId,
        user.sub,
        rule,
        payload.severity,
        `Test route: ${rule.name}`,
        payload,
        parsed.data.incident_id ?? null
      );
      createdEvents.push(created);
    }

    await this.auditService.log(tenantId, {
      action: "alert_route.tested",
      resourceType: "config",
      resourceId: "alerts",
      diff: {
        before: null,
        after: {
          matched_rules: matched.map((rule) => rule.id),
          created_events: createdEvents.map((event) => event.id)
        }
      },
      actorType: "user",
      actorId: user.sub
    });

    return {
      matched_rules: matched.map((rule) => ({ id: rule.id, name: rule.name })),
      created_events: createdEvents
    };
  }

  async getPipelineStatus(tenantId: string) {
    const [queued, processed, failed, deadLetters, latestSite, latestTenant, timescale] = await Promise.all([
      this.prisma.ingestionEvent.count({ where: { tenantId, status: { in: ["queued", "published"] } } }),
      this.prisma.ingestionEvent.count({ where: { tenantId, status: "processed" } }),
      this.prisma.ingestionEvent.count({ where: { tenantId, status: "failed" } }),
      this.prisma.telemetryDeadLetter.count({ where: { tenantId } }),
      this.prisma.siteAnalyticsRollupHourly.findFirst({ where: { tenantId }, orderBy: { bucketStart: "desc" } }),
      this.prisma.tenantAnalyticsRollupHourly.findFirst({ where: { tenantId }, orderBy: { bucketStart: "desc" } }),
      this.infra.getTimescaleStatus()
    ]);

    const latestBucket = latestSite?.bucketStart ?? latestTenant?.bucketStart ?? null;
    const freshnessSeconds = latestBucket ? Math.max(0, Math.floor((Date.now() - latestBucket.getTime()) / 1000)) : null;

    return {
      timestamp: new Date().toISOString(),
      nats: {
        connected: this.nats.getStatus().connected,
        stream: this.nats.getStream(),
        subject: this.nats.getTelemetrySubject()
      },
      ingestion: {
        queued,
        processed,
        failed,
        deadLetters
      },
      rollups: {
        siteHourlyLatest: latestSite?.bucketStart.toISOString() ?? null,
        tenantHourlyLatest: latestTenant?.bucketStart.toISOString() ?? null,
        freshnessSeconds
      },
      timescale
    };
  }

  private async processIngestionTick() {
    const subject = this.nats.getTelemetrySubject();
    const fromBus = this.nats.pull(subject, 200);

    const ids = new Set<string>();
    for (const message of fromBus) {
      if (typeof message.payload !== "object" || !message.payload) {
        continue;
      }
      const ingestionEventId = (message.payload as { ingestion_event_id?: string }).ingestion_event_id;
      if (ingestionEventId) {
        ids.add(ingestionEventId);
      }
    }

    if (ids.size === 0) {
      const queued = await this.prisma.ingestionEvent.findMany({
        where: {
          status: { in: ["queued", "published"] }
        },
        select: { id: true },
        take: 200,
        orderBy: { createdAt: "asc" }
      });
      for (const row of queued) {
        ids.add(row.id);
      }
    }

    for (const id of ids) {
      await this.processIngestionEvent(id);
    }
  }

  private async processIngestionEvent(eventId: string) {
    const event = await this.prisma.ingestionEvent.findUnique({ where: { id: eventId } });
    if (!event || event.status === "processed") {
      return;
    }

    try {
      const parsed = telemetryIngestEventSchema.safeParse(event.payload);
      if (!parsed.success) {
        throw new Error(`Invalid ingestion payload: ${parsed.error.issues.map((issue) => issue.message).join(", ")}`);
      }

      const timestamp = new Date(parsed.data.timestamp);
      const points: Array<{ id: string; tenantId: string; robotId: string; metric: string; value: number; timestamp: Date }> = [];
      for (const [metric, value] of Object.entries(parsed.data.metrics)) {
        points.push({
          id: `${event.id}:${metric}`,
          tenantId: event.tenantId,
          robotId: parsed.data.robot_id,
          metric,
          value,
          timestamp
        });
      }

      for (const point of points) {
        const existing = await this.prisma.telemetryPoint.findUnique({ where: { id: point.id } });
        if (existing) {
          continue;
        }
        await this.prisma.telemetryPoint.create({ data: point });
      }

      await this.prisma.ingestionEvent.update({
        where: { id: event.id },
        data: {
          status: "processed",
          processedAt: new Date(),
          error: null
        }
      });

      this.emitLive(event.tenantId, "telemetry.live", {
        type: "telemetry.ingested",
        robotId: parsed.data.robot_id,
        timestamp: parsed.data.timestamp,
        metrics: parsed.data.metrics
      });
    } catch (error) {
      const message = String(error);
      await this.prisma.ingestionEvent.update({
        where: { id: event.id },
        data: {
          status: "failed",
          error: message
        }
      });
      await this.prisma.telemetryDeadLetter.create({
        data: {
          id: randomUUID(),
          tenantId: event.tenantId,
          source: event.source,
          payload: this.toJson(event.payload),
          error: message
        }
      });
    }
  }

  async refreshRollups() {
    const tenants = await this.prisma.tenant.findMany({ select: { id: true } });
    const now = new Date();
    const bucketStart = this.floorToHour(new Date(now.getTime() - 60 * 60 * 1000));
    const bucketEnd = new Date(bucketStart.getTime() + 60 * 60 * 1000);

    for (const tenant of tenants) {
      const sites = await this.prisma.site.findMany({ where: { tenantId: tenant.id }, select: { id: true } });

      let tenantMissionsTotal = 0;
      let tenantMissionsSucceeded = 0;
      let tenantIncidentsOpen = 0;
      let tenantInterventions = 0;
      let tenantFleet = 0;
      let tenantOnline = 0;

      for (const site of sites) {
        const [missions, incidents, robots] = await Promise.all([
          this.prisma.mission.findMany({
            where: {
              tenantId: tenant.id,
              siteId: site.id,
              createdAt: {
                gte: bucketStart,
                lt: bucketEnd
              }
            }
          }),
          this.prisma.incident.findMany({
            where: {
              tenantId: tenant.id,
              siteId: site.id,
              status: { in: ["open", "acknowledged", "mitigated"] },
              createdAt: {
                lte: bucketEnd
              }
            }
          }),
          this.prisma.robot.findMany({
            where: { tenantId: tenant.id, siteId: site.id },
            select: { status: true }
          })
        ]);

        const missionsTotal = missions.length;
        const missionsSucceeded = missions.filter((mission) => mission.state === "succeeded").length;
        const interventionsCount = missions.reduce((sum, mission) => sum + mission.interventionsCount, 0);
        const incidentsOpen = incidents.length;
        const fleetSize = robots.length;
        const onlineCount = robots.filter((robot) => robot.status === "online").length;
        const uptimePercent = fleetSize ? Math.round((onlineCount / fleetSize) * 100) : 0;

        await this.prisma.siteAnalyticsRollupHourly.upsert({
          where: {
            tenantId_siteId_bucketStart: {
              tenantId: tenant.id,
              siteId: site.id,
              bucketStart
            }
          },
          update: {
            missionsTotal,
            missionsSucceeded,
            incidentsOpen,
            interventionsCount,
            fleetSize,
            uptimePercent
          },
          create: {
            id: randomUUID(),
            tenantId: tenant.id,
            siteId: site.id,
            bucketStart,
            missionsTotal,
            missionsSucceeded,
            incidentsOpen,
            interventionsCount,
            fleetSize,
            uptimePercent
          }
        });

        tenantMissionsTotal += missionsTotal;
        tenantMissionsSucceeded += missionsSucceeded;
        tenantIncidentsOpen += incidentsOpen;
        tenantInterventions += interventionsCount;
        tenantFleet += fleetSize;
        tenantOnline += onlineCount;
      }

      const tenantUptime = tenantFleet ? Math.round((tenantOnline / tenantFleet) * 100) : 0;
      await this.prisma.tenantAnalyticsRollupHourly.upsert({
        where: {
          tenantId_bucketStart: {
            tenantId: tenant.id,
            bucketStart
          }
        },
        update: {
          missionsTotal: tenantMissionsTotal,
          missionsSucceeded: tenantMissionsSucceeded,
          incidentsOpen: tenantIncidentsOpen,
          interventionsCount: tenantInterventions,
          fleetSize: tenantFleet,
          uptimePercent: tenantUptime
        },
        create: {
          id: randomUUID(),
          tenantId: tenant.id,
          bucketStart,
          missionsTotal: tenantMissionsTotal,
          missionsSucceeded: tenantMissionsSucceeded,
          incidentsOpen: tenantIncidentsOpen,
          interventionsCount: tenantInterventions,
          fleetSize: tenantFleet,
          uptimePercent: tenantUptime
        }
      });
    }
  }

  private async runAlertEngineTick() {
    await this.generateIncidentAlerts();
    await this.generateIntegrationAlerts();
    await this.flushScheduledDeliveries();
    await this.resolveRecoveredAlerts();
  }

  private async generateIncidentAlerts() {
    const rules = await this.prisma.alertRule.findMany({
      where: {
        isActive: true,
        eventType: "incident"
      },
      include: {
        policy: {
          include: {
            steps: {
              orderBy: { orderIndex: "asc" }
            }
          }
        }
      },
      orderBy: { priority: "asc" }
    });

    if (rules.length === 0) {
      return;
    }

    const byTenant = new Map<string, typeof rules>();
    for (const rule of rules) {
      const current = byTenant.get(rule.tenantId) ?? [];
      current.push(rule);
      byTenant.set(rule.tenantId, current);
    }

    for (const [tenantId, tenantRules] of byTenant.entries()) {
      const incidents = await this.prisma.incident.findMany({
        where: {
          tenantId,
          status: {
            in: ["open", "acknowledged", "mitigated"]
          }
        },
        orderBy: { createdAt: "desc" },
        take: 200
      });

      for (const incident of incidents) {
        const payload = {
          site_id: incident.siteId,
          severity: incident.severity,
          category: incident.category,
          incident_id: incident.id,
          title: incident.title
        };

        for (const rule of tenantRules) {
          if (!this.matchesAlertRule(rule, payload)) {
            continue;
          }

          const existing = await this.prisma.alertEvent.findFirst({
            where: {
              tenantId,
              ruleId: rule.id,
              incidentId: incident.id,
              state: { in: ["open", "acknowledged"] }
            }
          });
          if (existing) {
            continue;
          }

          await this.createAlertEventFromRule(
            tenantId,
            "system",
            rule,
            incident.severity,
            incident.title,
            payload,
            incident.id
          );
        }
      }
    }
  }

  private async generateIntegrationAlerts() {
    const rules = await this.prisma.alertRule.findMany({
      where: {
        isActive: true,
        eventType: "integration_error"
      },
      include: {
        policy: {
          include: {
            steps: {
              orderBy: { orderIndex: "asc" }
            }
          }
        }
      },
      orderBy: { priority: "asc" }
    });

    if (rules.length === 0) {
      return;
    }

    const byTenant = new Map<string, typeof rules>();
    for (const rule of rules) {
      const current = byTenant.get(rule.tenantId) ?? [];
      current.push(rule);
      byTenant.set(rule.tenantId, current);
    }

    for (const [tenantId, tenantRules] of byTenant.entries()) {
      const erroredIntegrations = await this.prisma.integration.findMany({
        where: {
          tenantId,
          status: "error"
        }
      });

      for (const integration of erroredIntegrations) {
        const payload = {
          integration_id: integration.id,
          severity: "major",
          category: "integration",
          site_id: null,
          integration_name: integration.name
        };

        for (const rule of tenantRules) {
          if (!this.matchesAlertRule(rule, payload)) {
            continue;
          }

          const existing = await this.prisma.alertEvent.findFirst({
            where: {
              tenantId,
              ruleId: rule.id,
              state: { in: ["open", "acknowledged"] },
              payload: {
                path: ["integration_id"],
                equals: integration.id
              }
            }
          });
          if (existing) {
            continue;
          }

          await this.createAlertEventFromRule(
            tenantId,
            "system",
            rule,
            "major",
            `Integration error: ${integration.name}`,
            payload,
            null
          );
        }
      }
    }
  }

  private async flushScheduledDeliveries() {
    const due = await this.prisma.alertDelivery.findMany({
      where: {
        state: "scheduled",
        scheduledFor: { lte: new Date() }
      },
      include: {
        alertEvent: true,
        policyStep: true
      },
      take: 200,
      orderBy: { scheduledFor: "asc" }
    });

    for (const delivery of due) {
      const shouldFail = delivery.target.toLowerCase().includes("fail");
      const now = new Date();

      const updated = await this.prisma.alertDelivery.update({
        where: { id: delivery.id },
        data: {
          state: shouldFail ? "failed" : "sent",
          sentAt: now,
          message: shouldFail
            ? `Deterministic stub delivery failed for ${delivery.channel}`
            : `Deterministic stub delivery sent to ${delivery.channel}:${delivery.target}`,
          error: shouldFail ? "Deterministic simulated failure" : null
        }
      });

      this.emitLive(delivery.tenantId, "alerts.live", {
        type: "alert.delivery.updated",
        delivery: updated
      });
    }
  }

  private async resolveRecoveredAlerts() {
    const openIncidentEvents = await this.prisma.alertEvent.findMany({
      where: {
        state: { in: ["open", "acknowledged"] },
        incidentId: { not: null }
      },
      take: 200,
      orderBy: { triggeredAt: "desc" }
    });

    for (const alertEvent of openIncidentEvents) {
      if (!alertEvent.incidentId) {
        continue;
      }

      const incident = await this.prisma.incident.findFirst({
        where: {
          id: alertEvent.incidentId,
          tenantId: alertEvent.tenantId
        }
      });

      if (!incident || incident.status !== "resolved") {
        continue;
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.alertEvent.update({
          where: { id: alertEvent.id },
          data: {
            state: "resolved",
            resolvedAt: new Date()
          }
        });

        await tx.alertDelivery.updateMany({
          where: {
            alertEventId: alertEvent.id,
            state: "scheduled"
          },
          data: {
            state: "canceled",
            sentAt: new Date(),
            message: "Delivery canceled because source incident is resolved"
          }
        });
      });
    }

    const openIntegrationEvents = await this.prisma.alertEvent.findMany({
      where: {
        state: { in: ["open", "acknowledged"] },
        incidentId: null
      },
      take: 200,
      orderBy: { triggeredAt: "desc" }
    });

    for (const alertEvent of openIntegrationEvents) {
      const integrationId =
        typeof alertEvent.payload === "object" && alertEvent.payload && "integration_id" in (alertEvent.payload as Record<string, unknown>)
          ? (alertEvent.payload as Record<string, unknown>).integration_id
          : null;
      if (!integrationId || typeof integrationId !== "string") {
        continue;
      }

      const integration = await this.prisma.integration.findFirst({
        where: {
          id: integrationId,
          tenantId: alertEvent.tenantId
        }
      });

      if (!integration || integration.status === "error") {
        continue;
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.alertEvent.update({
          where: { id: alertEvent.id },
          data: {
            state: "resolved",
            resolvedAt: new Date()
          }
        });

        await tx.alertDelivery.updateMany({
          where: {
            alertEventId: alertEvent.id,
            state: "scheduled"
          },
          data: {
            state: "canceled",
            sentAt: new Date(),
            message: "Delivery canceled because integration recovered"
          }
        });
      });
    }
  }

  private async createAlertEventFromRule(
    tenantId: string,
    actorId: string,
    rule: {
      id: string;
      policyId: string;
      name: string;
    },
    severity: string,
    title: string,
    payload: Record<string, unknown>,
    incidentId: string | null
  ) {
    const policy = await this.prisma.alertPolicy.findFirst({
      where: {
        id: rule.policyId,
        tenantId,
        isActive: true
      },
      include: {
        steps: {
          orderBy: { orderIndex: "asc" }
        }
      }
    });

    if (!policy) {
      throw new BadRequestException("Alert policy is missing or inactive");
    }

    const triggeredAt = new Date();
    const event = await this.prisma.alertEvent.create({
      data: {
        id: randomUUID(),
        tenantId,
        ruleId: rule.id,
        policyId: policy.id,
        incidentId,
        state: "open",
        severity,
        title,
        payload: this.toJson(payload),
        triggeredAt
      }
    });

    const deliveries = [];
    for (const step of policy.steps) {
      const scheduledFor = new Date(triggeredAt.getTime() + step.delaySeconds * 1000);
      const delivery = await this.prisma.alertDelivery.create({
        data: {
          id: randomUUID(),
          tenantId,
          alertEventId: event.id,
          policyStepId: step.id,
          attempt: 1,
          state: "scheduled",
          channel: step.channel,
          target: step.target,
          scheduledFor,
          message: `Scheduled deterministic ${step.channel} delivery`,
          details: this.toJson({
            delay_seconds: step.delaySeconds,
            severity_min: step.severityMin,
            template: step.template
          })
        }
      });
      deliveries.push(delivery);
    }

    await this.auditService.log(tenantId, {
      action: "alert.triggered",
      resourceType: "incident",
      resourceId: event.id,
      diff: {
        before: null,
        after: {
          event,
          deliveries
        }
      },
      actorType: actorId === "system" ? "system" : "user",
      actorId
    });

    this.emitLive(tenantId, "alerts.live", {
      type: "alert.created",
      event,
      deliveries
    });

    return {
      ...event,
      deliveries
    };
  }

  private matchesAlertRule(
    rule: {
      severity: string | null;
      category: string | null;
      siteId: string | null;
    },
    payload: {
      severity?: string | null;
      category?: string | null;
      site_id?: string | null;
    }
  ) {
    const payloadSeverity = payload.severity ?? "warning";
    if (rule.severity && (SEVERITY_ORDER[payloadSeverity] ?? 0) < (SEVERITY_ORDER[rule.severity] ?? 0)) {
      return false;
    }

    if (rule.category && payload.category !== rule.category) {
      return false;
    }

    if (rule.siteId && payload.site_id !== rule.siteId) {
      return false;
    }

    return true;
  }

  private async resolveSiteIds(tenantId: string, siteId?: string, explicitSiteIds: string[] = []) {
    if (siteId && siteId !== "all") {
      return [siteId];
    }

    if (explicitSiteIds.length > 0) {
      return explicitSiteIds;
    }

    const sites = await this.prisma.site.findMany({ where: { tenantId }, select: { id: true } });
    return sites.map((site) => site.id);
  }

  private parseWindow(from?: string, to?: string) {
    const toDate = to ? new Date(to) : new Date();
    const fromDate = from ? new Date(from) : new Date(toDate.getTime() - 24 * 60 * 60 * 1000);

    if (Number.isNaN(toDate.getTime())) {
      throw new BadRequestException("Invalid to timestamp");
    }
    if (Number.isNaN(fromDate.getTime())) {
      throw new BadRequestException("Invalid from timestamp");
    }
    if (fromDate > toDate) {
      throw new BadRequestException("from must be less than or equal to to");
    }

    return { from: fromDate, to: toDate };
  }

  private floorToHour(value: Date) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), value.getUTCHours()));
  }

  private emitLive(tenantId: string, channel: string, data: unknown) {
    if (!this.live.server) {
      return;
    }
    this.live.server.to(`tenant:${tenantId}`).emit(channel, {
      channel,
      timestamp: new Date().toISOString(),
      data
    });
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
  }

  private createSimplePdf(lines: string[]) {
    const pageHeight = 792;
    const contentLines = [
      "BT",
      "/F1 12 Tf",
      `50 ${pageHeight - 50} Td`,
      ...lines.flatMap((line, index) => {
        const escaped = this.escapePdfText(line);
        if (index === 0) {
          return [`(${escaped}) Tj`];
        }
        return ["0 -16 Td", `(${escaped}) Tj`];
      }),
      "ET"
    ];
    const contentStream = contentLines.join("\n");

    const objects = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
      `<< /Length ${Buffer.byteLength(contentStream, "utf8")} >>\nstream\n${contentStream}\nendstream`,
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
    ];

    let body = "";
    const offsets: number[] = [0];

    for (let index = 0; index < objects.length; index += 1) {
      const objectNumber = index + 1;
      offsets.push(Buffer.byteLength(`%PDF-1.4\n${body}`, "utf8"));
      body += `${objectNumber} 0 obj\n${objects[index]}\nendobj\n`;
    }

    let xref = `xref\n0 ${objects.length + 1}\n`;
    xref += "0000000000 65535 f \n";
    for (let index = 1; index < offsets.length; index += 1) {
      xref += `${offsets[index].toString().padStart(10, "0")} 00000 n \n`;
    }

    const header = "%PDF-1.4\n";
    const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${Buffer.byteLength(
      `${header}${body}`,
      "utf8"
    )}\n%%EOF`;

    return Buffer.from(`${header}${body}${xref}${trailer}`, "utf8");
  }

  private escapePdfText(input: string) {
    return input.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  }
}
