import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
  ForbiddenException
} from "@nestjs/common";
import type { Permission } from "@robotops/shared";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import type { RequestUser } from "../auth/types";
import { OpsService } from "../services/ops.service";

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OpsController {
  constructor(@Inject(OpsService) private readonly opsService: OpsService) {}

  @Get("tenants/me")
  getTenant(@CurrentUser() user: RequestUser) {
    return this.opsService.getTenant(user.tenantId);
  }

  @Get("sites")
  @RequirePermissions("robots.read")
  listSites(@CurrentUser() user: RequestUser) {
    return this.opsService.listSites(user.tenantId);
  }

  @Get("floorplans")
  @RequirePermissions("robots.read")
  listFloorplans(@CurrentUser() user: RequestUser, @Query("site_id") siteId: string) {
    return this.opsService.listFloorplans(user.tenantId, siteId);
  }

  @Get("robots")
  @RequirePermissions("robots.read")
  listRobots(
    @CurrentUser() user: RequestUser,
    @Query("site_id") site_id?: string,
    @Query("status") status?: string,
    @Query("tag") tag?: string,
    @Query("vendor") vendor?: string,
    @Query("capability") capability?: string,
    @Query("battery_min") batteryMin?: string,
    @Query("battery_max") batteryMax?: string
  ) {
    return this.opsService.listRobots(user.tenantId, {
      site_id,
      status,
      tag,
      vendor,
      capability,
      battery_min: batteryMin ? Number(batteryMin) : undefined,
      battery_max: batteryMax ? Number(batteryMax) : undefined
    });
  }

  @Get("robots/:id")
  @RequirePermissions("robots.read")
  getRobot(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.opsService.getRobot(user.tenantId, id);
  }

  @Post("robots/:id/actions")
  @RequirePermissions("robots.control")
  requestRobotAction(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() body: unknown) {
    return this.opsService.requestRobotAction(user.tenantId, id, user, body);
  }

  @Get("missions")
  @RequirePermissions("missions.read")
  listMissions(@CurrentUser() user: RequestUser, @Query("site_id") site_id?: string, @Query("state") state?: string) {
    return this.opsService.listMissions(user.tenantId, { site_id, state });
  }

  @Post("missions")
  @RequirePermissions("missions.write")
  createMission(@CurrentUser() user: RequestUser, @Body() body: unknown) {
    return this.opsService.createMission(user.tenantId, user, body);
  }

  @Get("missions/:id")
  @RequirePermissions("missions.read")
  getMission(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.opsService.getMission(user.tenantId, id);
  }

  @Get("incidents")
  @RequirePermissions("incidents.read")
  listIncidents(
    @CurrentUser() user: RequestUser,
    @Query("site_id") site_id?: string,
    @Query("status") status?: string,
    @Query("severity") severity?: string,
    @Query("category") category?: string,
    @Query("robot") robot_id?: string
  ) {
    return this.opsService.listIncidents(user.tenantId, {
      site_id,
      status,
      severity,
      category,
      robot_id
    });
  }

  @Post("incidents/:id/ack")
  acknowledgeIncident(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    this.assertAnyPermission(user, ["incidents.ack", "incidents.write"]);
    return this.opsService.acknowledgeIncident(user.tenantId, id, user);
  }

  @Post("incidents/:id/resolve")
  @RequirePermissions("incidents.write")
  resolveIncident(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() body: unknown) {
    return this.opsService.resolveIncident(user.tenantId, id, user, body);
  }

  @Get("audit")
  @RequirePermissions("audit.read")
  listAudit(
    @CurrentUser() user: RequestUser,
    @Query("resource_type") resourceType?: string,
    @Query("resource_id") resourceId?: string
  ) {
    return this.opsService.listAudit(user.tenantId, resourceType, resourceId);
  }

  @Get("telemetry/robot/:id")
  @RequirePermissions("robots.read")
  telemetryByRobot(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Query("metric") metric?: string,
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    return this.opsService.telemetryByRobot(user.tenantId, id, metric, from, to);
  }

  @Get("rtls/assets")
  @RequirePermissions("robots.read")
  listAssets(@CurrentUser() user: RequestUser, @Query("site_id") siteId?: string) {
    return this.opsService.listAssets(user.tenantId, siteId);
  }

  @Get("api-keys")
  @RequirePermissions("integrations.read")
  listApiKeys(@CurrentUser() user: RequestUser) {
    return this.opsService.listApiKeys(user.tenantId);
  }

  private assertAnyPermission(user: RequestUser, permissions: Permission[]) {
    if (user.role === "Owner") {
      return;
    }
    const allowed = permissions.some((permission) => user.permissions.includes(permission));
    if (!allowed) {
      throw new ForbiddenException("Insufficient permissions");
    }
  }
}
