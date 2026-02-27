import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import {
  copilotMessageSchema,
  incidentResolveSchema,
  missionCreateSchema,
  robotActionSchema,
  type MissionCreateInput,
  type RobotActionInput
} from "@robotops/shared";
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

  async listRobots(tenantId: string, filters: RobotFilters) {
    return this.prisma.robot.findMany({
      where: {
        tenantId,
        ...(filters.site_id ? { siteId: filters.site_id } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.tag ? { tags: { has: filters.tag } } : {}),
        ...(filters.vendor ? { vendorId: filters.vendor } : {}),
        ...(filters.capability ? { capabilities: { has: filters.capability } } : {}),
        ...(filters.battery_min || filters.battery_max
          ? {
              batteryPercent: {
                ...(filters.battery_min !== undefined ? { gte: Number(filters.battery_min) } : {}),
                ...(filters.battery_max !== undefined ? { lte: Number(filters.battery_max) } : {})
              }
            }
          : {})
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
      orderBy: [{ status: "asc" }, { name: "asc" }]
    });
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

    return robot;
  }

  async requestRobotAction(tenantId: string, robotId: string, user: RequestUser, input: unknown) {
    const parsed = robotActionSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const robot = await this.prisma.robot.findFirst({ where: { id: robotId, tenantId } });
    if (!robot) {
      throw new NotFoundException("Robot not found");
    }

    await this.auditService.log(tenantId, {
      action: `robot.action.${parsed.data.action}`,
      resourceType: "robot",
      resourceId: robotId,
      diff: parsed.data,
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
        ...(filters.site_id ? { siteId: filters.site_id } : {}),
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
        name: mission.name,
        type: mission.type,
        priority: mission.priority
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
        ...(filters.site_id ? { siteId: filters.site_id } : {}),
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
        status: "acknowledged"
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
        status: "resolved",
        note: parsed.data.note
      },
      actorType: "user",
      actorId: user.sub
    });

    return updated;
  }

  listAudit(tenantId: string, resourceType?: string, resourceId?: string) {
    return this.prisma.auditLog.findMany({
      where: {
        tenantId,
        ...(resourceType ? { resourceType } : {}),
        ...(resourceId ? { resourceId } : {})
      },
      orderBy: { timestamp: "desc" },
      take: 200
    });
  }

  async telemetryByRobot(
    tenantId: string,
    robotId: string,
    metric?: string,
    from?: string,
    to?: string
  ) {
    const robot = await this.prisma.robot.findFirst({ where: { id: robotId, tenantId } });
    if (!robot) {
      throw new NotFoundException("Robot not found");
    }

    return this.prisma.telemetryPoint.findMany({
      where: {
        tenantId,
        robotId,
        ...(metric ? { metric } : {}),
        ...(from || to
          ? {
              timestamp: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {})
              }
            }
          : {})
      },
      orderBy: { timestamp: "asc" },
      take: 1000
    });
  }

  listAssets(tenantId: string, siteId?: string) {
    return this.prisma.asset.findMany({
      where: {
        tenantId,
        ...(siteId ? { siteId } : {})
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

  async assertCopilotMessageInput(payload: unknown) {
    const parsed = copilotMessageSchema.safeParse(payload);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return parsed.data;
  }
}
