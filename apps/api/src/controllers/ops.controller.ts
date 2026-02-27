import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
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
    @Query("resource_id") resourceId?: string,
    @Query("actor_id") actorId?: string,
    @Query("action") action?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string
  ) {
    return this.opsService.listAudit(user.tenantId, {
      resource_type: resourceType,
      resource_id: resourceId,
      actor_id: actorId,
      action,
      from,
      to,
      cursor,
      limit: limit ? Number(limit) : undefined
    });
  }

  @Get("telemetry/robot/:id")
  @RequirePermissions("robots.read")
  telemetryByRobot(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Query("metric") metric?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("max_points") maxPoints?: string,
    @Query("bucket_seconds") bucketSeconds?: string,
    @Query("aggregation") aggregation?: string
  ) {
    return this.opsService.telemetryByRobot(user.tenantId, id, {
      metric,
      from,
      to,
      max_points: maxPoints,
      bucket_seconds: bucketSeconds,
      aggregation
    });
  }

  @Get("robots/:id/path")
  @RequirePermissions("robots.read")
  robotPathByRobot(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("interval_seconds") intervalSeconds?: string,
    @Query("floorplan_id") floorplanId?: string
  ) {
    return this.opsService.robotPathByRobot(user.tenantId, id, {
      from,
      to,
      interval_seconds: intervalSeconds,
      floorplan_id: floorplanId
    });
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

  @Get("saved-views")
  listSavedViews(@CurrentUser() user: RequestUser, @Query("page") page?: string) {
    return this.opsService.listSavedViews(user.tenantId, user, page);
  }

  @Post("saved-views")
  createSavedView(@CurrentUser() user: RequestUser, @Body() body: unknown) {
    return this.opsService.createSavedView(user.tenantId, user, body);
  }

  @Patch("saved-views/:id")
  patchSavedView(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() body: unknown) {
    return this.opsService.patchSavedView(user.tenantId, user, id, body);
  }

  @Delete("saved-views/:id")
  deleteSavedView(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.opsService.deleteSavedView(user.tenantId, user, id);
  }

  @Post("saved-views/:id/set-default")
  setDefaultSavedView(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() body: unknown) {
    return this.opsService.setDefaultSavedView(user.tenantId, user, id, body);
  }

  @Get("integrations")
  @RequirePermissions("integrations.read")
  listIntegrations(@CurrentUser() user: RequestUser) {
    return this.opsService.listIntegrations(user.tenantId);
  }

  @Post("integrations")
  @RequirePermissions("integrations.manage")
  createIntegration(@CurrentUser() user: RequestUser, @Body() body: unknown) {
    return this.opsService.createIntegration(user.tenantId, user, body);
  }

  @Patch("integrations/:id")
  @RequirePermissions("integrations.manage")
  patchIntegration(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() body: unknown) {
    return this.opsService.patchIntegration(user.tenantId, user, id, body);
  }

  @Post("integrations/:id/test")
  @RequirePermissions("integrations.manage")
  testIntegration(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.opsService.testIntegration(user.tenantId, user, id);
  }

  @Get("integrations/:id/test-runs")
  @RequirePermissions("integrations.read")
  listIntegrationTestRuns(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.opsService.listIntegrationTestRuns(user.tenantId, id);
  }

  @Get("dashboard-configs")
  @RequirePermissions("config.read")
  listDashboardConfigs(@CurrentUser() user: RequestUser) {
    return this.opsService.listDashboardConfigs(user.tenantId);
  }

  @Post("dashboard-configs")
  @RequirePermissions("config.write")
  createDashboardConfig(@CurrentUser() user: RequestUser, @Body() body: unknown) {
    return this.opsService.createDashboardConfig(user.tenantId, user, body);
  }

  @Post("dashboard-configs/validate")
  @RequirePermissions("config.write")
  validateDashboardConfig(@CurrentUser() user: RequestUser, @Body() body: unknown) {
    return this.opsService.validateDashboardConfig(user.tenantId, body);
  }

  @Patch("dashboard-configs/:id")
  @RequirePermissions("config.write")
  patchDashboardConfig(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() body: unknown) {
    return this.opsService.patchDashboardConfig(user.tenantId, user, id, body);
  }

  @Post("dashboard-configs/:id/activate")
  @RequirePermissions("config.write")
  activateDashboardConfig(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.opsService.activateDashboardConfig(user.tenantId, user, id);
  }

  @Get("analytics/dashboard")
  @RequirePermissions("analytics.read")
  getAnalyticsDashboard(
    @CurrentUser() user: RequestUser,
    @Query("site_id") siteId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    return this.opsService.getAnalyticsDashboard(user.tenantId, siteId, from, to);
  }

  @Get("analytics/export")
  @RequirePermissions("analytics.read")
  exportAnalytics(
    @CurrentUser() user: RequestUser,
    @Query("format") format?: string,
    @Query("site_id") siteId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    return this.opsService.exportAnalytics(user.tenantId, format, siteId, from, to);
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
