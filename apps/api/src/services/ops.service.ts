import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import {
  copilotMessageSchema,
  dashboardConfigPatchSchema,
  dashboardConfigSchemaV1,
  incidentResolveSchema,
  integrationCreateSchema,
  integrationPatchSchema,
  missionCreateSchema,
  normalizePermissions,
  permissionImplies,
  robotActionSchema,
  robotLastStateQuerySchema,
  robotPathQuerySchema,
  roleDefaultSchema,
  savedViewCreateSchema,
  savedViewPatchSchema,
  transformVendorPosePoint,
  telemetryQuerySchema,
  vendorSiteMapCreateSchema,
  vendorSiteMapPatchSchema,
  vendorSiteMapPreviewSchema,
  vendorSiteMapQuerySchema,
  type MissionCreateInput
} from "@robotops/shared";
import type { Permission } from "@robotops/shared";
import type { RequestUser } from "../auth/types";
import { AuditService } from "./audit.service";
import { PrismaService } from "./prisma.service";

interface RobotFilters {
  site_id?: string;
  status?: string;
  tag?: string;
  vendor?: string;
  capability?: string;
  battery_min?: number;
  battery_max?: number;
}

interface MissionFilters {
  site_id?: string;
  state?: string;
}

interface IncidentFilters {
  site_id?: string;
  status?: string;
  severity?: string;
  category?: string;
  robot_id?: string;
}

interface AuditFilters {
  resource_type?: string;
  resource_id?: string;
  actor_id?: string;
  action?: string;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
}

interface TelemetryFilters {
  metric?: string;
  from?: string;
  to?: string;
  max_points?: string;
  bucket_seconds?: string;
  aggregation?: string;
}

interface RobotPathFilters {
  from?: string;
  to?: string;
  interval_seconds?: string;
  floorplan_id?: string;
}

interface RobotLastStateFilters {
  site_id?: string;
  status?: string;
  vendor?: string;
  tag?: string;
}

interface VendorSiteMapFilters {
  site_id?: string;
  vendor?: string;
}

const DEFAULT_ROBOT_OFFLINE_AFTER_SECONDS = 15;

@Injectable()
export class OpsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly auditService: AuditService
  ) {}

  async getTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException("Tenant not found");
    }
    return tenant;
  }

  listSites(tenantId: string) {
    return this.prisma.site.findMany({
      where: { tenantId },
      orderBy: { name: "asc" }
    });
  }

  async listFloorplans(tenantId: string, siteId: string) {
    if (siteId === "all") {
      const floorplans = await this.prisma.floorplan.findMany({
        where: { tenantId },
        orderBy: [{ siteId: "asc" }, { name: "asc" }]
      });

      const zones = await this.prisma.zone.findMany({
        where: { tenantId, floorplanId: { in: floorplans.map((floorplan) => floorplan.id) } },
        orderBy: { name: "asc" }
      });

      return floorplans.map((floorplan) => ({
        ...floorplan,
        zones: zones.filter((zone) => zone.floorplanId === floorplan.id)
      }));
    }

    const site = await this.prisma.site.findFirst({ where: { id: siteId, tenantId } });
    if (!site) {
      throw new NotFoundException("Site not found");
    }

    const floorplans = await this.prisma.floorplan.findMany({
      where: { tenantId, siteId },
      orderBy: { name: "asc" }
    });

    const floorplanIds = floorplans.map((floorplan) => floorplan.id);
    const zones = await this.prisma.zone.findMany({
      where: { tenantId, floorplanId: { in: floorplanIds } },
      orderBy: { name: "asc" }
    });

    return floorplans.map((floorplan) => ({
      ...floorplan,
      zones: zones.filter((zone) => zone.floorplanId === floorplan.id)
    }));
  }

  async listVendorSiteMaps(tenantId: string, filters: VendorSiteMapFilters) {
    const parsed = vendorSiteMapQuerySchema.safeParse(filters);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.prisma.vendorSiteMap.findMany({
      where: {
        tenantId,
        ...(parsed.data.site_id ? { siteId: parsed.data.site_id } : {}),
        ...(parsed.data.vendor ? { vendor: this.normalizeVendorValue(parsed.data.vendor) } : {})
      },
      include: {
        robotopsFloorplan: {
          select: {
            id: true,
            name: true,
            siteId: true
          }
        }
      },
      orderBy: [{ siteId: "asc" }, { vendor: "asc" }, { updatedAt: "desc" }]
    });
  }

  async createVendorSiteMap(tenantId: string, user: RequestUser, input: unknown) {
    const parsed = vendorSiteMapCreateSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const vendor = this.normalizeVendorValue(parsed.data.vendor);
    const vendorMapId = parsed.data.vendor_map_id ? parsed.data.vendor_map_id.trim().toLowerCase() : null;
    const vendorMapName = parsed.data.vendor_map_name ? parsed.data.vendor_map_name.trim().toLowerCase() : null;

    await this.assertFloorplanBelongsToSite(
      tenantId,
      parsed.data.site_id,
      parsed.data.robotops_floorplan_id
    );
    await this.assertVendorSiteMapUniqueness(tenantId, {
      siteId: parsed.data.site_id,
      vendor,
      vendorMapId,
      vendorMapName
    });

    const created = await this.prisma.vendorSiteMap.create({
      data: {
        id: randomUUID(),
        tenantId,
        siteId: parsed.data.site_id,
        vendor,
        vendorMapId,
        vendorMapName,
        robotopsFloorplanId: parsed.data.robotops_floorplan_id,
        scale: parsed.data.scale,
        rotationDegrees: parsed.data.rotation_degrees,
        translateX: parsed.data.translate_x,
        translateY: parsed.data.translate_y,
        createdBy: user.sub,
        updatedBy: user.sub
      },
      include: {
        robotopsFloorplan: {
          select: {
            id: true,
            name: true,
            siteId: true
          }
        }
      }
    });

    await this.auditService.log(tenantId, {
      action: "vendor_site_map.created",
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

  async patchVendorSiteMap(tenantId: string, user: RequestUser, id: string, input: unknown) {
    const parsed = vendorSiteMapPatchSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const current = await this.prisma.vendorSiteMap.findFirst({
      where: { tenantId, id }
    });
    if (!current) {
      throw new NotFoundException("Vendor site map not found");
    }

    const nextVendor = parsed.data.vendor ? this.normalizeVendorValue(parsed.data.vendor) : current.vendor;
    const nextSiteId = current.siteId;
    const nextVendorMapId =
      parsed.data.vendor_map_id === undefined
        ? current.vendorMapId
        : parsed.data.vendor_map_id === null
          ? null
          : parsed.data.vendor_map_id.trim().toLowerCase();
    const nextVendorMapName =
      parsed.data.vendor_map_name === undefined
        ? current.vendorMapName
        : parsed.data.vendor_map_name === null
          ? null
          : parsed.data.vendor_map_name.trim().toLowerCase();

    if (!nextVendorMapId && !nextVendorMapName) {
      throw new BadRequestException("Either vendor_map_id or vendor_map_name must remain set");
    }

    const nextFloorplanId = parsed.data.robotops_floorplan_id ?? current.robotopsFloorplanId;
    await this.assertFloorplanBelongsToSite(tenantId, nextSiteId, nextFloorplanId);
    await this.assertVendorSiteMapUniqueness(tenantId, {
      siteId: nextSiteId,
      vendor: nextVendor,
      vendorMapId: nextVendorMapId,
      vendorMapName: nextVendorMapName,
      excludeId: current.id
    });

    const updated = await this.prisma.vendorSiteMap.update({
      where: { id: current.id },
      data: {
        vendor: nextVendor,
        vendorMapId: nextVendorMapId,
        vendorMapName: nextVendorMapName,
        robotopsFloorplanId: nextFloorplanId,
        ...(parsed.data.scale !== undefined ? { scale: parsed.data.scale } : {}),
        ...(parsed.data.rotation_degrees !== undefined ? { rotationDegrees: parsed.data.rotation_degrees } : {}),
        ...(parsed.data.translate_x !== undefined ? { translateX: parsed.data.translate_x } : {}),
        ...(parsed.data.translate_y !== undefined ? { translateY: parsed.data.translate_y } : {}),
        updatedBy: user.sub
      },
      include: {
        robotopsFloorplan: {
          select: {
            id: true,
            name: true,
            siteId: true
          }
        }
      }
    });

    await this.auditService.log(tenantId, {
      action: "vendor_site_map.updated",
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

  async deleteVendorSiteMap(tenantId: string, user: RequestUser, id: string) {
    const current = await this.prisma.vendorSiteMap.findFirst({
      where: { tenantId, id }
    });
    if (!current) {
      throw new NotFoundException("Vendor site map not found");
    }

    await this.prisma.vendorSiteMap.delete({
      where: { id: current.id }
    });

    await this.auditService.log(tenantId, {
      action: "vendor_site_map.deleted",
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

  async previewVendorSiteMap(tenantId: string, input: unknown) {
    const parsed = vendorSiteMapPreviewSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    if (parsed.data.robotops_floorplan_id) {
      const floorplan = await this.prisma.floorplan.findFirst({
        where: {
          id: parsed.data.robotops_floorplan_id,
          tenantId
        },
        select: { id: true }
      });
      if (!floorplan) {
        throw new BadRequestException("robotops_floorplan_id is invalid for tenant");
      }
    }

    const points = parsed.data.points.map((point) => {
      const output = transformVendorPosePoint(
        {
          x: point.x,
          y: point.y,
          headingDegrees: point.heading_degrees,
          confidence: point.confidence
        },
        {
          scale: parsed.data.scale,
          rotationDegrees: parsed.data.rotation_degrees,
          translateX: parsed.data.translate_x,
          translateY: parsed.data.translate_y
        }
      );

      return {
        input: point,
        output: {
          x: output.x,
          y: output.y,
          heading_degrees: output.headingDegrees,
          confidence: output.confidence
        }
      };
    });

    return {
      floorplan_id: parsed.data.robotops_floorplan_id ?? null,
      points
    };
  }

  async listRobots(tenantId: string, filters: RobotFilters) {
    const rows = await this.fetchRobotLastStateView(tenantId, {
      site_id: filters.site_id,
      status: filters.status,
      vendor: filters.vendor,
      tag: filters.tag
    });

    return rows.filter((row) => {
      const capabilityPass = filters.capability ? (row.capabilities ?? []).includes(filters.capability) : true;
      const batteryMinPass = filters.battery_min !== undefined ? row.batteryPercent >= Number(filters.battery_min) : true;
      const batteryMaxPass = filters.battery_max !== undefined ? row.batteryPercent <= Number(filters.battery_max) : true;
      return capabilityPass && batteryMinPass && batteryMaxPass;
    });
  }

  async listRobotsLastState(tenantId: string, filters: RobotLastStateFilters) {
    const parsed = robotLastStateQuerySchema.safeParse(filters);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.fetchRobotLastStateView(tenantId, parsed.data);
  }

  async getRobot(tenantId: string, id: string) {
    const robot = await this.prisma.robot.findFirst({
      where: { id, tenantId },
      include: {
        vendor: true,
        site: true,
        missions: {
          orderBy: { createdAt: "desc" },
          take: 25
        },
        incidents: {
          orderBy: { createdAt: "desc" },
          take: 25
        }
      }
    });

    if (!robot) {
      throw new NotFoundException("Robot not found");
    }
    const lastState = await this.prisma.robotLastState.findUnique({
      where: {
        tenantId_siteId_robotId: {
          tenantId,
          siteId: robot.siteId,
          robotId: robot.id
        }
      }
    });

    if (!lastState) {
      return robot;
    }

    const setting = await this.prisma.siteSetting.findUnique({
      where: {
        tenantId_siteId: {
          tenantId,
          siteId: robot.siteId
        }
      }
    });
    const { status, reported_status, is_offline_computed } = this.computeOfflineState(
      lastState.status,
      lastState.lastSeenAt,
      setting?.robotOfflineAfterSeconds ?? DEFAULT_ROBOT_OFFLINE_AFTER_SECONDS
    );

    return {
      ...robot,
      status,
      batteryPercent: lastState.batteryPercent,
      lastSeenAt: lastState.lastSeenAt,
      floorplanId: lastState.floorplanId,
      x: lastState.x,
      y: lastState.y,
      headingDegrees: lastState.headingDegrees,
      confidence: lastState.confidence,
      cpuPercent: lastState.cpuPercent,
      memoryPercent: lastState.memoryPercent,
      tempC: lastState.tempC,
      diskPercent: lastState.diskPercent,
      networkRssi: lastState.networkRssi,
      reported_status,
      is_offline_computed,
      healthScore: lastState.healthScore,
      currentTaskId: lastState.currentTaskId,
      currentTaskState: lastState.currentTaskState,
      currentTaskPercentComplete: lastState.currentTaskPercentComplete
    };
  }

  async requestRobotAction(tenantId: string, robotId: string, user: RequestUser, input: unknown) {
    const parsed = robotActionSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const actionPermission: Record<string, Permission> = {
      dock: "robots.control.dock",
      pause: "robots.control.pause",
      resume: "robots.control.resume",
      speed_limit: "robots.control.speed_limit"
    };
    const requiredPermission = actionPermission[parsed.data.action];
    if (!this.hasPermission(user, requiredPermission) && !this.hasPermission(user, "robots.control")) {
      throw new ForbiddenException("Insufficient permissions");
    }

    const robot = await this.prisma.robot.findFirst({ where: { id: robotId, tenantId } });
    if (!robot) {
      throw new NotFoundException("Robot not found");
    }

    await this.auditService.log(tenantId, {
      action: `robot.action.${parsed.data.action}`,
      resourceType: "robot",
      resourceId: robotId,
      diff: {
        before: null,
        after: parsed.data
      },
      actorType: "user",
      actorId: user.sub
    });

    return {
      accepted: true,
      action: parsed.data.action,
      robotId,
      requestedAt: new Date().toISOString()
    };
  }

  listMissions(tenantId: string, filters: MissionFilters) {
    return this.prisma.mission.findMany({
      where: {
        tenantId,
        ...(filters.site_id && filters.site_id !== "all" ? { siteId: filters.site_id } : {}),
        ...(filters.state ? { state: filters.state } : {})
      },
      include: {
        assignedRobot: true,
        site: true
      },
      orderBy: { createdAt: "desc" }
    });
  }

  async createMission(tenantId: string, user: RequestUser, input: unknown) {
    const parsed = missionCreateSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const payload: MissionCreateInput = parsed.data;
    const site = await this.prisma.site.findFirst({ where: { id: payload.site_id, tenantId } });
    if (!site) {
      throw new NotFoundException("Site not found");
    }

    if (payload.assigned_robot_id) {
      const robot = await this.prisma.robot.findFirst({
        where: { id: payload.assigned_robot_id, tenantId, siteId: payload.site_id }
      });
      if (!robot) {
        throw new BadRequestException("Assigned robot is invalid for tenant/site");
      }
    }

    const waypointZoneIds = payload.route.waypoints
      .map((waypoint) => waypoint.zone_id)
      .filter((zoneId): zoneId is string => typeof zoneId === "string");

    if (waypointZoneIds.length > 0) {
      const restrictedZones = await this.prisma.zone.findMany({
        where: {
          tenantId,
          id: { in: waypointZoneIds },
          requiresOperatorAck: true
        }
      });

      if (restrictedZones.length > 0 && !payload.operator_acknowledged_restricted_zones) {
        throw new BadRequestException({
          code: "ZONE_REQUIRES_ACK",
          message: "Mission route enters a zone that requires operator acknowledgment",
          zones: restrictedZones.map((zone) => ({ id: zone.id, name: zone.name }))
        });
      }
    }

    const mission = await this.prisma.mission.create({
      data: {
        id: randomUUID(),
        tenantId,
        siteId: payload.site_id,
        name: payload.name,
        type: payload.type,
        priority: payload.priority,
        createdByUserId: user.sub,
        assignedRobotId: payload.assigned_robot_id,
        state: "queued",
        startTime: null,
        endTime: null,
        durationS: 0,
        distanceM: 0,
        stopsCount: 0,
        interventionsCount: 0,
        energyUsedWh: 0,
        routeWaypoints: payload.route.waypoints,
        routePolyline: payload.route.planned_path_polyline,
        failureCode: null,
        failureMessage: null,
        lastEventId: null,
        createdAt: new Date()
      }
    });

    await this.auditService.log(tenantId, {
      action: "mission.created",
      resourceType: "mission",
      resourceId: mission.id,
      diff: {
        before: null,
        after: {
          name: mission.name,
          type: mission.type,
          priority: mission.priority
        }
      },
      actorType: "user",
      actorId: user.sub
    });

    return mission;
  }

  async getMission(tenantId: string, missionId: string) {
    const mission = await this.prisma.mission.findFirst({
      where: { id: missionId, tenantId },
      include: {
        assignedRobot: true,
        site: true,
        missionEvents: {
          orderBy: { timestamp: "asc" }
        },
        incidents: {
          orderBy: { createdAt: "desc" }
        }
      }
    });

    if (!mission) {
      throw new NotFoundException("Mission not found");
    }

    return mission;
  }

  listIncidents(tenantId: string, filters: IncidentFilters) {
    return this.prisma.incident.findMany({
      where: {
        tenantId,
        ...(filters.site_id && filters.site_id !== "all" ? { siteId: filters.site_id } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.severity ? { severity: filters.severity } : {}),
        ...(filters.category ? { category: filters.category } : {}),
        ...(filters.robot_id ? { robotId: filters.robot_id } : {})
      },
      include: {
        robot: true,
        mission: true,
        site: true,
        timeline: {
          orderBy: { timestamp: "asc" }
        }
      },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }]
    });
  }

  async acknowledgeIncident(tenantId: string, incidentId: string, user: RequestUser) {
    const incident = await this.prisma.incident.findFirst({ where: { id: incidentId, tenantId } });
    if (!incident) {
      throw new NotFoundException("Incident not found");
    }

    const updated = await this.prisma.incident.update({
      where: { id: incident.id },
      data: {
        status: "acknowledged",
        acknowledgedBy: user.sub
      }
    });

    await this.prisma.incidentEvent.create({
      data: {
        id: randomUUID(),
        incidentId: incident.id,
        timestamp: new Date(),
        type: "acknowledged",
        message: `${user.name} acknowledged incident`,
        meta: { actorId: user.sub }
      }
    });

    await this.auditService.log(tenantId, {
      action: "incident.acknowledged",
      resourceType: "incident",
      resourceId: incident.id,
      diff: {
        before: { status: incident.status, acknowledgedBy: incident.acknowledgedBy },
        after: { status: "acknowledged", acknowledgedBy: user.sub }
      },
      actorType: "user",
      actorId: user.sub
    });

    return updated;
  }

  async resolveIncident(tenantId: string, incidentId: string, user: RequestUser, input: unknown) {
    const parsed = incidentResolveSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const incident = await this.prisma.incident.findFirst({ where: { id: incidentId, tenantId } });
    if (!incident) {
      throw new NotFoundException("Incident not found");
    }

    const updated = await this.prisma.incident.update({
      where: { id: incident.id },
      data: {
        status: "resolved",
        resolvedAt: new Date()
      }
    });

    await this.prisma.incidentEvent.createMany({
      data: [
        {
          id: randomUUID(),
          incidentId: incident.id,
          timestamp: new Date(),
          type: "note",
          message: parsed.data.note,
          meta: { actorId: user.sub }
        },
        {
          id: randomUUID(),
          incidentId: incident.id,
          timestamp: new Date(),
          type: "resolved",
          message: `${user.name} resolved incident`,
          meta: { actorId: user.sub }
        }
      ]
    });

    await this.auditService.log(tenantId, {
      action: "incident.resolved",
      resourceType: "incident",
      resourceId: incident.id,
      diff: {
        before: { status: incident.status, resolvedAt: incident.resolvedAt },
        after: { status: "resolved", resolvedAt: updated.resolvedAt, note: parsed.data.note }
      },
      actorType: "user",
      actorId: user.sub
    });

    return updated;
  }

  async listAudit(tenantId: string, filters: AuditFilters) {
    const limit = Math.min(200, Math.max(1, filters.limit ?? 50));
    const from = this.optionalDate(filters.from, "Invalid from timestamp");
    const to = this.optionalDate(filters.to, "Invalid to timestamp");
    if (from && to && from > to) {
      throw new BadRequestException("from must be less than or equal to to");
    }

    const cursorDate = this.optionalDate(filters.cursor, "Invalid cursor timestamp");

    const rows = await this.prisma.auditLog.findMany({
      where: {
        tenantId,
        ...(filters.resource_type ? { resourceType: filters.resource_type } : {}),
        ...(filters.resource_id ? { resourceId: filters.resource_id } : {}),
        ...(filters.actor_id ? { actorId: filters.actor_id } : {}),
        ...(filters.action ? { action: { contains: filters.action, mode: "insensitive" } } : {}),
        ...((from || to || cursorDate)
          ? {
              timestamp: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
                ...(cursorDate ? { lt: cursorDate } : {})
              }
            }
          : {})
      },
      orderBy: [{ timestamp: "desc" }, { id: "desc" }],
      take: limit + 1
    });

    const items = rows.slice(0, limit);
    const nextCursor = rows.length > limit ? items[items.length - 1]?.timestamp.toISOString() ?? null : null;

    return {
      items,
      next_cursor: nextCursor
    };
  }

  async telemetryByRobot(tenantId: string, robotId: string, query: TelemetryFilters) {
    const robot = await this.prisma.robot.findFirst({ where: { id: robotId, tenantId } });
    if (!robot) {
      throw new NotFoundException("Robot not found");
    }

    const parsed = telemetryQuerySchema.safeParse({
      metric: query.metric,
      from: query.from,
      to: query.to,
      max_points: query.max_points,
      bucket_seconds: query.bucket_seconds,
      aggregation: query.aggregation
    });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const toDate = parsed.data.to ? new Date(parsed.data.to) : new Date();
    const fromDate = parsed.data.from ? new Date(parsed.data.from) : new Date(toDate.getTime() - 24 * 60 * 60 * 1000);
    if (fromDate > toDate) {
      throw new BadRequestException("from must be less than or equal to to");
    }

    const metric = parsed.data.metric ?? "battery";

    const rows = await this.prisma.telemetryPoint.findMany({
      where: {
        tenantId,
        robotId,
        metric,
        timestamp: {
          gte: fromDate,
          lte: toDate
        }
      },
      orderBy: { timestamp: "asc" },
      take: 5000
    });

    const totalPoints = rows.length;
    const windowSeconds = Math.max(1, Math.ceil((toDate.getTime() - fromDate.getTime()) / 1000));
    const maxPoints = parsed.data.max_points;
    const shouldDownsample = totalPoints > maxPoints || parsed.data.bucket_seconds !== undefined;

    if (!shouldDownsample) {
      return {
        robotId,
        metric,
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
        totalPoints,
        downsampled: false,
        aggregation: parsed.data.aggregation,
        bucketSeconds: null,
        maxPoints,
        points: rows.map((row) => ({
          timestamp: row.timestamp.toISOString(),
          value: row.value,
          count: 1,
          min: row.value,
          max: row.value
        }))
      };
    }

    const bucketSeconds = parsed.data.bucket_seconds ?? Math.max(1, Math.ceil(windowSeconds / maxPoints));
    const buckets = new Map<number, number[]>();

    for (const row of rows) {
      const ts = Math.floor(row.timestamp.getTime() / 1000);
      const key = Math.floor(ts / bucketSeconds) * bucketSeconds;
      const values = buckets.get(key) ?? [];
      values.push(row.value);
      buckets.set(key, values);
    }

    const points = Array.from(buckets.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([bucketStart, values]) => {
        const count = values.length;
        const min = Math.min(...values);
        const max = Math.max(...values);
        const last = values[values.length - 1] ?? 0;
        const avg = values.reduce((sum, value) => sum + value, 0) / count;

        let value = avg;
        if (parsed.data.aggregation === "min") {
          value = min;
        } else if (parsed.data.aggregation === "max") {
          value = max;
        } else if (parsed.data.aggregation === "last") {
          value = last;
        }

        return {
          timestamp: new Date(bucketStart * 1000).toISOString(),
          value,
          count,
          min,
          max
        };
      });

    return {
      robotId,
      metric,
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      totalPoints,
      downsampled: true,
      aggregation: parsed.data.aggregation,
      bucketSeconds,
      maxPoints,
      points
    };
  }

  async robotPathByRobot(tenantId: string, robotId: string, query: RobotPathFilters) {
    const robot = await this.prisma.robot.findFirst({ where: { id: robotId, tenantId } });
    if (!robot) {
      throw new NotFoundException("Robot not found");
    }

    const parsed = robotPathQuerySchema.safeParse({
      from: query.from,
      to: query.to,
      interval_seconds: query.interval_seconds,
      floorplan_id: query.floorplan_id
    });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const toDate = parsed.data.to ? new Date(parsed.data.to) : new Date();
    const fromDate = parsed.data.from ? new Date(parsed.data.from) : new Date(toDate.getTime() - 60 * 60 * 1000);
    if (fromDate > toDate) {
      throw new BadRequestException("from must be less than or equal to to");
    }

    const rows = await this.prisma.robotPathPoint.findMany({
      where: {
        tenantId,
        robotId,
        ...(parsed.data.floorplan_id ? { floorplanId: parsed.data.floorplan_id } : {}),
        timestamp: {
          gte: fromDate,
          lte: toDate
        }
      },
      orderBy: { timestamp: "asc" },
      take: 5000
    });

    const sampled: typeof rows = [];
    let lastIncluded = 0;
    for (const row of rows) {
      if (sampled.length === 0 || row.timestamp.getTime() - lastIncluded >= parsed.data.interval_seconds * 1000) {
        sampled.push(row);
        lastIncluded = row.timestamp.getTime();
      }
    }

    return {
      robotId,
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      intervalSeconds: parsed.data.interval_seconds,
      totalPoints: rows.length,
      points: sampled.map((row) => ({
        id: row.id,
        floorplanId: row.floorplanId,
        x: row.x,
        y: row.y,
        headingDegrees: row.headingDegrees,
        confidence: row.confidence,
        timestamp: row.timestamp.toISOString()
      }))
    };
  }

  listAssets(tenantId: string, siteId?: string) {
    return this.prisma.asset.findMany({
      where: {
        tenantId,
        ...(siteId && siteId !== "all" ? { siteId } : {})
      },
      include: {
        proximityEvents: {
          orderBy: { timestamp: "desc" },
          take: 20
        }
      },
      orderBy: { name: "asc" }
    });
  }

  listApiKeys(tenantId: string) {
    return this.prisma.apiKey.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" }
    });
  }

  async listSavedViews(tenantId: string, user: RequestUser, page?: string) {
    const [items, defaults] = await Promise.all([
      this.prisma.savedView.findMany({
        where: {
          tenantId,
          ...(page ? { page } : {}),
          OR: [{ createdBy: user.sub }, { isShared: true }]
        },
        orderBy: [{ isShared: "desc" }, { updatedAt: "desc" }]
      }),
      this.prisma.roleDashboardDefault.findMany({
        where: {
          tenantId,
          role: user.role,
          ...(page ? { page } : {})
        }
      })
    ]);

    return {
      items,
      defaults
    };
  }

  async createSavedView(tenantId: string, user: RequestUser, input: unknown) {
    const parsed = savedViewCreateSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const created = await this.prisma.savedView.create({
      data: {
        id: randomUUID(),
        tenantId,
        createdBy: user.sub,
        page: parsed.data.page,
        name: parsed.data.name,
        filters: this.toJson(parsed.data.filters),
        layout: this.toJson(parsed.data.layout),
        isShared: parsed.data.is_shared
      }
    });

    await this.auditService.log(tenantId, {
      action: "saved_view.created",
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

  async patchSavedView(tenantId: string, user: RequestUser, id: string, input: unknown) {
    const parsed = savedViewPatchSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const current = await this.prisma.savedView.findFirst({ where: { id, tenantId } });
    if (!current) {
      throw new NotFoundException("Saved view not found");
    }

    this.assertCanManageSavedView(user, current.createdBy);

    const updated = await this.prisma.savedView.update({
      where: { id },
        data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.filters !== undefined ? { filters: this.toJson(parsed.data.filters) } : {}),
        ...(parsed.data.layout !== undefined ? { layout: this.toJson(parsed.data.layout) } : {}),
        ...(parsed.data.is_shared !== undefined ? { isShared: parsed.data.is_shared } : {})
      }
    });

    await this.auditService.log(tenantId, {
      action: "saved_view.updated",
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

  async deleteSavedView(tenantId: string, user: RequestUser, id: string) {
    const current = await this.prisma.savedView.findFirst({ where: { id, tenantId } });
    if (!current) {
      throw new NotFoundException("Saved view not found");
    }

    this.assertCanManageSavedView(user, current.createdBy);

    await this.prisma.roleDashboardDefault.deleteMany({ where: { tenantId, savedViewId: id } });
    await this.prisma.savedView.delete({ where: { id } });

    await this.auditService.log(tenantId, {
      action: "saved_view.deleted",
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

  async setDefaultSavedView(tenantId: string, user: RequestUser, id: string, input: unknown) {
    if (!this.hasPermission(user, "config.write") && user.role !== "Owner") {
      throw new ForbiddenException("Insufficient permissions");
    }

    const parsed = roleDefaultSchema.safeParse({
      ...(typeof input === "object" && input ? input : {}),
      saved_view_id: id
    });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const savedView = await this.prisma.savedView.findFirst({ where: { id, tenantId } });
    if (!savedView) {
      throw new NotFoundException("Saved view not found");
    }

    if (savedView.page !== parsed.data.page) {
      throw new BadRequestException("Saved view page does not match requested default page");
    }

    const current = await this.prisma.roleDashboardDefault.findUnique({
      where: {
        tenantId_role_page: {
          tenantId,
          role: parsed.data.role,
          page: parsed.data.page
        }
      }
    });

    const updated = await this.prisma.roleDashboardDefault.upsert({
      where: {
        tenantId_role_page: {
          tenantId,
          role: parsed.data.role,
          page: parsed.data.page
        }
      },
      update: {
        savedViewId: id,
        createdBy: user.sub
      },
      create: {
        id: randomUUID(),
        tenantId,
        role: parsed.data.role,
        page: parsed.data.page,
        savedViewId: id,
        createdBy: user.sub
      }
    });

    await this.auditService.log(tenantId, {
      action: "saved_view.default_set",
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

  listIntegrations(tenantId: string) {
    return this.prisma.integration.findMany({
      where: { tenantId },
      include: {
        testRuns: {
          orderBy: { createdAt: "desc" },
          take: 5
        }
      },
      orderBy: { name: "asc" }
    });
  }

  async createIntegration(tenantId: string, user: RequestUser, input: unknown) {
    const parsed = integrationCreateSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const created = await this.prisma.integration.create({
      data: {
        id: randomUUID(),
        tenantId,
        type: parsed.data.type,
        name: parsed.data.name,
        status: "active",
        config: this.toJson(parsed.data.config),
        lastSyncAt: null
      }
    });

    await this.auditService.log(tenantId, {
      action: "integration.created",
      resourceType: "integration",
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

  async patchIntegration(tenantId: string, user: RequestUser, id: string, input: unknown) {
    const parsed = integrationPatchSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const current = await this.prisma.integration.findFirst({ where: { id, tenantId } });
    if (!current) {
      throw new NotFoundException("Integration not found");
    }

    const updated = await this.prisma.integration.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
        ...(parsed.data.config !== undefined ? { config: this.toJson(parsed.data.config) } : {})
      }
    });

    await this.auditService.log(tenantId, {
      action: "integration.updated",
      resourceType: "integration",
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

  async testIntegration(tenantId: string, user: RequestUser, id: string) {
    const integration = await this.prisma.integration.findFirst({ where: { id, tenantId } });
    if (!integration) {
      throw new NotFoundException("Integration not found");
    }

    const checksum = Array.from(`${integration.id}:${integration.type}`).reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const success = integration.status !== "disabled" && checksum % 2 === 0;
    const runStatus = success ? "success" : "error";
    const message = success
      ? "Deterministic test passed. Connector handshake and sample payload verified."
      : "Deterministic test failed. Connector returned a simulated auth or endpoint error.";

    const now = new Date();
    const run = await this.prisma.integrationTestRun.create({
      data: {
        id: randomUUID(),
        integrationId: integration.id,
        tenantId,
        status: runStatus,
        message,
        details: {
          deterministic: true,
          checked_at: now.toISOString(),
          checksum
        },
        createdAt: now
      }
    });

    const updated = await this.prisma.integration.update({
      where: { id: integration.id },
      data: {
        status: success ? "active" : "error",
        lastSyncAt: now
      }
    });

    await this.auditService.log(tenantId, {
      action: "integration.tested",
      resourceType: "integration",
      resourceId: integration.id,
      diff: {
        before: integration,
        after: updated,
        run
      },
      actorType: "user",
      actorId: user.sub
    });

    return {
      integration: updated,
      run
    };
  }

  async listIntegrationTestRuns(tenantId: string, id: string) {
    const integration = await this.prisma.integration.findFirst({ where: { id, tenantId } });
    if (!integration) {
      throw new NotFoundException("Integration not found");
    }

    return this.prisma.integrationTestRun.findMany({
      where: { tenantId, integrationId: id },
      orderBy: { createdAt: "desc" },
      take: 50
    });
  }

  listDashboardConfigs(tenantId: string) {
    return this.prisma.dashboardConfig.findMany({
      where: { tenantId },
      orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }]
    });
  }

  async createDashboardConfig(tenantId: string, user: RequestUser, input: unknown) {
    const parsed = dashboardConfigSchemaV1.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const created = await this.prisma.dashboardConfig.create({
      data: {
        id: randomUUID(),
        tenantId,
        name: parsed.data.name,
        schemaVersion: parsed.data.schema_version,
        widgets: this.toJson(parsed.data.widgets),
        rules: this.toJson(parsed.data.rules),
        appliesTo: this.toJson(parsed.data.applies_to),
        isActive: false,
        createdBy: user.sub
      }
    });

    await this.auditService.log(tenantId, {
      action: "dashboard_config.created",
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

  async validateDashboardConfig(_tenantId: string, input: unknown) {
    const parsed = dashboardConfigSchemaV1.safeParse(input);
    if (parsed.success) {
      return {
        valid: true,
        errors: []
      };
    }

    return {
      valid: false,
      errors: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message
      }))
    };
  }

  async patchDashboardConfig(tenantId: string, user: RequestUser, id: string, input: unknown) {
    const parsed = dashboardConfigPatchSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const current = await this.prisma.dashboardConfig.findFirst({ where: { id, tenantId } });
    if (!current) {
      throw new NotFoundException("Dashboard config not found");
    }

    const updated = await this.prisma.dashboardConfig.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.widgets !== undefined ? { widgets: this.toJson(parsed.data.widgets) } : {}),
        ...(parsed.data.rules !== undefined ? { rules: this.toJson(parsed.data.rules) } : {}),
        ...(parsed.data.applies_to !== undefined ? { appliesTo: this.toJson(parsed.data.applies_to) } : {})
      }
    });

    await this.auditService.log(tenantId, {
      action: "dashboard_config.updated",
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

  async activateDashboardConfig(tenantId: string, user: RequestUser, id: string) {
    const current = await this.prisma.dashboardConfig.findFirst({ where: { id, tenantId } });
    if (!current) {
      throw new NotFoundException("Dashboard config not found");
    }

    const [, updated] = await this.prisma.$transaction([
      this.prisma.dashboardConfig.updateMany({
        where: { tenantId },
        data: { isActive: false }
      }),
      this.prisma.dashboardConfig.update({
        where: { id },
        data: { isActive: true }
      })
    ]);

    await this.auditService.log(tenantId, {
      action: "dashboard_config.activated",
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

  async getAnalyticsDashboard(tenantId: string, siteId?: string, from?: string, to?: string) {
    const fromDate = this.optionalDate(from, "Invalid from timestamp") ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
    const toDate = this.optionalDate(to, "Invalid to timestamp") ?? new Date();
    if (fromDate > toDate) {
      throw new BadRequestException("from must be less than or equal to to");
    }

    const [robots, missions, incidents] = await Promise.all([
      this.prisma.robot.findMany({
        where: {
          tenantId,
          ...(siteId ? { siteId } : {})
        }
      }),
      this.prisma.mission.findMany({
        where: {
          tenantId,
          ...(siteId ? { siteId } : {}),
          createdAt: {
            gte: fromDate,
            lte: toDate
          }
        },
        include: {
          assignedRobot: true
        }
      }),
      this.prisma.incident.findMany({
        where: {
          tenantId,
          ...(siteId ? { siteId } : {}),
          createdAt: {
            gte: fromDate,
            lte: toDate
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
        const zone = typeof waypoint === "object" && waypoint && "zone_id" in waypoint ? (waypoint as { zone_id?: string }).zone_id : undefined;
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

    const windowHours = Math.max(1, (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60));
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

    return {
      window: {
        from: fromDate.toISOString(),
        to: toDate.toISOString()
      },
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
      utilizationByRobot
    };
  }

  async exportAnalytics(tenantId: string, format: string | undefined, siteId?: string, from?: string, to?: string) {
    const selectedFormat = format === "pdf" ? "pdf" : "csv";
    const data = await this.getAnalyticsDashboard(tenantId, siteId, from, to);

    if (selectedFormat === "pdf") {
      const textSummaryLines = [
        "RobotOps analytics summary",
        `Window: ${data.window.from} -> ${data.window.to}`,
        `Fleet size: ${data.kpis.fleetSize}`,
        `Uptime: ${data.kpis.uptimePercent}%`,
        `Missions total: ${data.kpis.missionsTotal}`,
        `Incidents open: ${data.kpis.incidentsOpen}`,
        `Interventions/100 missions: ${data.kpis.interventionsPer100Missions}`
      ];
      const pdf = this.createSimplePdf(textSummaryLines);

      return {
        format: "pdf",
        filename: `analytics-${Date.now()}.pdf`,
        contentType: "application/pdf",
        content: pdf.toString("base64")
      };
    }

    const header = ["metric", "value"];
    const rows: string[][] = [
      ["fleet_size", String(data.kpis.fleetSize)],
      ["uptime_percent", String(data.kpis.uptimePercent)],
      ["missions_total", String(data.kpis.missionsTotal)],
      ["missions_succeeded", String(data.kpis.missionsSucceeded)],
      ["incidents_open", String(data.kpis.incidentsOpen)],
      ["interventions_per_100_missions", String(data.kpis.interventionsPer100Missions)]
    ];

    const csv = [header.join(","), ...rows.map((row) => row.join(","))].join("\n");

    return {
      format: "csv",
      filename: `analytics-${Date.now()}.csv`,
      contentType: "text/csv",
      content: csv
    };
  }

  async assertCopilotMessageInput(payload: unknown) {
    const parsed = copilotMessageSchema.safeParse(payload);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return parsed.data;
  }

  private async fetchRobotLastStateView(tenantId: string, filters: RobotLastStateFilters) {
    const rows = await this.prisma.robotLastState.findMany({
      where: {
        tenantId,
        ...(filters.site_id && filters.site_id !== "all" ? { siteId: filters.site_id } : {}),
        ...(filters.vendor ? { vendor: filters.vendor } : {}),
        ...(filters.tag ? { tags: { has: filters.tag } } : {})
      },
      orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
      take: 5000
    });

    if (rows.length === 0) {
      return this.fetchRobotFallbackView(tenantId, filters);
    }

    const siteIds = [...new Set(rows.map((row) => row.siteId))];
    const settingsMap = await this.getSiteSettingsMap(tenantId, siteIds);

    const rowsWithStatus = rows.map((row) => {
      const setting = settingsMap.get(row.siteId);
      const offline = this.computeOfflineState(
        row.status,
        row.lastSeenAt,
        setting?.robotOfflineAfterSeconds ?? DEFAULT_ROBOT_OFFLINE_AFTER_SECONDS
      );
      return {
        ...row,
        status: offline.status,
        reported_status: offline.reported_status,
        is_offline_computed: offline.is_offline_computed
      };
    });

    const statusFiltered = filters.status ? rowsWithStatus.filter((row) => row.status === filters.status) : rowsWithStatus;
    if (statusFiltered.length === 0) {
      return [];
    }

    const robotById = new Map(
      (
        await this.prisma.robot.findMany({
          where: {
            tenantId,
            id: { in: statusFiltered.map((row) => row.robotId) }
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
        })
      ).map((robot) => [robot.id, robot])
    );

    return statusFiltered
      .map((row) => {
        const robot = robotById.get(row.robotId);
        if (!robot) {
          return null;
        }

        return {
          ...robot,
          status: row.status,
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
          reported_status: row.reported_status,
          is_offline_computed: row.is_offline_computed
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);
  }

  private async fetchRobotFallbackView(tenantId: string, filters: RobotLastStateFilters) {
    const robots = await this.prisma.robot.findMany({
      where: {
        tenantId,
        ...(filters.site_id && filters.site_id !== "all" ? { siteId: filters.site_id } : {}),
        ...(filters.vendor ? { vendorId: filters.vendor } : {}),
        ...(filters.tag ? { tags: { has: filters.tag } } : {})
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
      },
      orderBy: [{ lastSeenAt: "desc" }, { name: "asc" }],
      take: 5000
    });

    const siteIds = [...new Set(robots.map((robot) => robot.siteId))];
    const settingsMap = await this.getSiteSettingsMap(tenantId, siteIds);

    const mapped = robots.map((robot) => {
      const setting = settingsMap.get(robot.siteId);
      const offline = this.computeOfflineState(
        robot.status,
        robot.lastSeenAt,
        setting?.robotOfflineAfterSeconds ?? DEFAULT_ROBOT_OFFLINE_AFTER_SECONDS
      );
      return {
        ...robot,
        status: offline.status,
        healthScore: Math.max(0, Math.min(100, 100 - Math.round((robot.cpuPercent + robot.memoryPercent + robot.diskPercent) / 3))),
        currentTaskId: null,
        currentTaskState: null,
        currentTaskPercentComplete: null,
        reported_status: offline.reported_status,
        is_offline_computed: offline.is_offline_computed
      };
    });

    return filters.status ? mapped.filter((robot) => robot.status === filters.status) : mapped;
  }

  private async getSiteSettingsMap(tenantId: string, siteIds: string[]) {
    if (siteIds.length === 0) {
      return new Map<string, { robotOfflineAfterSeconds: number; robotStatePublishPeriodSeconds: number }>();
    }

    const settings = await this.prisma.siteSetting.findMany({
      where: {
        tenantId,
        siteId: { in: siteIds }
      },
      select: {
        siteId: true,
        robotOfflineAfterSeconds: true,
        robotStatePublishPeriodSeconds: true
      }
    });

    return new Map(
      settings.map((setting) => [
        setting.siteId,
        {
          robotOfflineAfterSeconds: setting.robotOfflineAfterSeconds,
          robotStatePublishPeriodSeconds: setting.robotStatePublishPeriodSeconds
        }
      ])
    );
  }

  private computeOfflineState(reportedStatus: string, lastSeenAt: Date, robotOfflineAfterSeconds: number) {
    const offlineAfterSeconds = Math.max(1, robotOfflineAfterSeconds);
    const ageSeconds = Math.floor((Date.now() - lastSeenAt.getTime()) / 1000);
    const isOfflineComputed = ageSeconds > offlineAfterSeconds;
    return {
      status: isOfflineComputed ? "offline" : reportedStatus,
      reported_status: reportedStatus,
      is_offline_computed: isOfflineComputed
    };
  }

  private normalizeVendorValue(vendor: string) {
    const normalized = vendor.trim().toLowerCase();
    if (!normalized) {
      throw new BadRequestException("vendor must be non-empty");
    }
    return normalized;
  }

  private async assertFloorplanBelongsToSite(tenantId: string, siteId: string, floorplanId: string) {
    const floorplan = await this.prisma.floorplan.findFirst({
      where: {
        id: floorplanId,
        tenantId,
        siteId
      },
      select: { id: true }
    });
    if (!floorplan) {
      throw new BadRequestException("robotops_floorplan_id must belong to the same tenant/site");
    }
  }

  private async assertVendorSiteMapUniqueness(
    tenantId: string,
    input: {
      siteId: string;
      vendor: string;
      vendorMapId: string | null;
      vendorMapName: string | null;
      excludeId?: string;
    }
  ) {
    if (input.vendorMapId) {
      const duplicateById = await this.prisma.vendorSiteMap.findFirst({
        where: {
          tenantId,
          siteId: input.siteId,
          vendor: input.vendor,
          vendorMapId: input.vendorMapId,
          ...(input.excludeId ? { id: { not: input.excludeId } } : {})
        },
        select: { id: true }
      });
      if (duplicateById) {
        throw new BadRequestException("Duplicate vendor_map_id for tenant/site/vendor");
      }
    }

    if (input.vendorMapName) {
      const duplicateByName = await this.prisma.vendorSiteMap.findFirst({
        where: {
          tenantId,
          siteId: input.siteId,
          vendor: input.vendor,
          vendorMapName: input.vendorMapName,
          ...(input.excludeId ? { id: { not: input.excludeId } } : {})
        },
        select: { id: true }
      });
      if (duplicateByName) {
        throw new BadRequestException("Duplicate vendor_map_name for tenant/site/vendor");
      }
    }
  }

  private optionalDate(raw: string | undefined, message: string) {
    if (!raw) {
      return null;
    }
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(message);
    }
    return parsed;
  }

  private hasPermission(user: RequestUser, permission: Permission) {
    if (user.role === "Owner") {
      return true;
    }
    const normalized = normalizePermissions(user.permissions ?? []);
    return normalized.some((granted) => permissionImplies(granted, permission));
  }

  private assertCanManageSavedView(user: RequestUser, ownerId: string) {
    if (user.role === "Owner") {
      return;
    }
    if (ownerId === user.sub) {
      return;
    }
    if (user.permissions.includes("config.write")) {
      return;
    }
    throw new ForbiddenException("Insufficient permissions");
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
        return [`0 -16 Td`, `(${escaped}) Tj`];
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
