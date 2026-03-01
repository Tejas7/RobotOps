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
  UseGuards
} from "@nestjs/common";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequireAnyPermissions, RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import type { RequestUser } from "../auth/types";
import { OpsService } from "../services/ops.service";
import { Phase3Service } from "../services/phase3.service";

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OpsController {
  constructor(
    @Inject(OpsService) private readonly opsService: OpsService,
    @Inject(Phase3Service) private readonly phase3Service: Phase3Service
  ) {}

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

  @Get("robots/last_state")
  @RequirePermissions("robots.read")
  listRobotsLastState(
    @CurrentUser() user: RequestUser,
    @Query("site_id") site_id?: string,
    @Query("status") status?: string,
    @Query("vendor") vendor?: string,
    @Query("tag") tag?: string
  ) {
    return this.opsService.listRobotsLastState(user.tenantId, {
      site_id,
      status,
      vendor,
      tag
    });
  }

  @Get("robots/:id")
  @RequirePermissions("robots.read")
  getRobot(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.opsService.getRobot(user.tenantId, id);
  }

  @Post("robots/:id/actions")
  @RequireAnyPermissions(
    "robots.control",
    "robots.control.dock",
    "robots.control.pause",
    "robots.control.resume",
    "robots.control.speed_limit"
  )
  requestRobotAction(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() body: unknown) {
    return this.opsService.requestRobotAction(user.tenantId, id, user, body);
  }

  @Get("missions")
  @RequirePermissions("missions.read")
  listMissions(@CurrentUser() user: RequestUser, @Query("site_id") site_id?: string, @Query("state") state?: string) {
    return this.opsService.listMissions(user.tenantId, { site_id, state });
  }

  @Post("missions")
  @RequireAnyPermissions("missions.create", "missions.write")
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
  @RequireAnyPermissions("incidents.ack", "incidents.resolve", "incidents.write")
  acknowledgeIncident(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.opsService.acknowledgeIncident(user.tenantId, id, user);
  }

  @Post("incidents/:id/resolve")
  @RequireAnyPermissions("incidents.resolve", "incidents.write")
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
  @RequireAnyPermissions("telemetry.read", "robots.read")
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
  @RequireAnyPermissions("integrations.test", "integrations.manage")
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

  @Get("vendor-site-maps")
  @RequirePermissions("config.read")
  listVendorSiteMaps(@CurrentUser() user: RequestUser, @Query("site_id") siteId?: string, @Query("vendor") vendor?: string) {
    return this.opsService.listVendorSiteMaps(user.tenantId, { site_id: siteId, vendor });
  }

  @Post("vendor-site-maps")
  @RequirePermissions("config.write")
  createVendorSiteMap(@CurrentUser() user: RequestUser, @Body() body: unknown) {
    return this.opsService.createVendorSiteMap(user.tenantId, user, body);
  }

  @Post("vendor-site-maps/preview")
  @RequirePermissions("config.write")
  previewVendorSiteMap(@CurrentUser() user: RequestUser, @Body() body: unknown) {
    return this.opsService.previewVendorSiteMap(user.tenantId, body);
  }

  @Patch("vendor-site-maps/:id")
  @RequirePermissions("config.write")
  patchVendorSiteMap(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() body: unknown) {
    return this.opsService.patchVendorSiteMap(user.tenantId, user, id, body);
  }

  @Delete("vendor-site-maps/:id")
  @RequirePermissions("config.write")
  deleteVendorSiteMap(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.opsService.deleteVendorSiteMap(user.tenantId, user, id);
  }

  @Get("analytics/dashboard")
  @RequireAnyPermissions("analytics.read.site", "analytics.read.cross_site", "analytics.read")
  getAnalyticsDashboard(
    @CurrentUser() user: RequestUser,
    @Query("site_id") siteId?: string,
    @Query("site_ids") siteIdsRaw?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("granularity") granularity?: "hour" | "day",
    @Query("use_rollups") useRollupsRaw?: string
  ) {
    return this.phase3Service.getAnalyticsDashboard(user.tenantId, {
      site_id: siteId,
      site_ids: siteIdsRaw ? siteIdsRaw.split(",").filter(Boolean) : [],
      from,
      to,
      granularity,
      use_rollups: useRollupsRaw ? useRollupsRaw === "true" : undefined
    });
  }

  @Get("analytics/cross-site")
  @RequireAnyPermissions("analytics.read.cross_site", "analytics.read")
  getCrossSiteAnalytics(
    @CurrentUser() user: RequestUser,
    @Query("site_id") siteId?: string,
    @Query("site_ids") siteIdsRaw?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("granularity") granularity?: "hour" | "day",
    @Query("use_rollups") useRollupsRaw?: string
  ) {
    return this.phase3Service.getCrossSiteAnalytics(user.tenantId, {
      site_id: siteId,
      site_ids: siteIdsRaw ? siteIdsRaw.split(",").filter(Boolean) : [],
      from,
      to,
      granularity,
      use_rollups: useRollupsRaw ? useRollupsRaw === "true" : undefined
    });
  }

  @Get("analytics/export")
  @RequirePermissions("analytics.export")
  exportAnalytics(
    @CurrentUser() user: RequestUser,
    @Query("format") format?: string,
    @Query("site_id") siteId?: string,
    @Query("site_ids") siteIdsRaw?: string,
    @Query("dataset") dataset?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("granularity") granularity?: "hour" | "day",
    @Query("use_rollups") useRollupsRaw?: string
  ) {
    return this.phase3Service.exportAnalytics(user.tenantId, format, dataset, {
      site_id: siteId,
      site_ids: siteIdsRaw ? siteIdsRaw.split(",").filter(Boolean) : [],
      from,
      to,
      granularity,
      use_rollups: useRollupsRaw ? useRollupsRaw === "true" : undefined
    });
  }

  @Get("adapters/health")
  @RequireAnyPermissions("integrations.read", "config.read")
  listAdapterHealth(@CurrentUser() user: RequestUser) {
    return this.phase3Service.listAdapterHealth(user.tenantId);
  }

  @Get("adapters/captures")
  @RequirePermissions("integrations.read")
  listAdapterCaptures(@CurrentUser() user: RequestUser, @Query("site_id") siteId?: string, @Query("vendor") vendor?: string) {
    return this.phase3Service.listAdapterCaptures(user.tenantId, {
      site_id: siteId,
      vendor
    });
  }

  @Post("adapters/captures/record")
  @RequirePermissions("integrations.manage")
  recordAdapterCapture(@CurrentUser() user: RequestUser, @Body() body: unknown) {
    return this.phase3Service.recordAdapterCapture(user.tenantId, user, body);
  }

  @Post("adapters/replays")
  @RequireAnyPermissions("integrations.manage", "telemetry.ingest")
  createAdapterReplay(@CurrentUser() user: RequestUser, @Body() body: unknown) {
    return this.phase3Service.createAdapterReplay(user.tenantId, user, body);
  }

  @Get("adapters/replays/:id")
  @RequirePermissions("integrations.read")
  getAdapterReplayRun(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.phase3Service.getAdapterReplayRun(user.tenantId, id);
  }

  @Post("ingest/telemetry")
  @RequirePermissions("telemetry.ingest")
  ingestTelemetry(@CurrentUser() user: RequestUser, @Body() body: unknown) {
    return this.phase3Service.ingestTelemetry(user.tenantId, user, body);
  }

  @Get("alerts/rules")
  @RequirePermissions("alerts.read")
  listAlertRules(@CurrentUser() user: RequestUser) {
    return this.phase3Service.listAlertRules(user.tenantId);
  }

  @Post("alerts/rules")
  @RequirePermissions("alerts.manage")
  createAlertRule(@CurrentUser() user: RequestUser, @Body() body: unknown) {
    return this.phase3Service.createAlertRule(user.tenantId, user, body);
  }

  @Patch("alerts/rules/:id")
  @RequirePermissions("alerts.manage")
  patchAlertRule(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() body: unknown) {
    return this.phase3Service.patchAlertRule(user.tenantId, user, id, body);
  }

  @Delete("alerts/rules/:id")
  @RequirePermissions("alerts.manage")
  deleteAlertRule(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.phase3Service.deleteAlertRule(user.tenantId, user, id);
  }

  @Get("alerts/policies")
  @RequirePermissions("alerts.read")
  listAlertPolicies(@CurrentUser() user: RequestUser) {
    return this.phase3Service.listAlertPolicies(user.tenantId);
  }

  @Post("alerts/policies")
  @RequirePermissions("alerts.manage")
  createAlertPolicy(@CurrentUser() user: RequestUser, @Body() body: unknown) {
    return this.phase3Service.createAlertPolicy(user.tenantId, user, body);
  }

  @Patch("alerts/policies/:id")
  @RequirePermissions("alerts.manage")
  patchAlertPolicy(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() body: unknown) {
    return this.phase3Service.patchAlertPolicy(user.tenantId, user, id, body);
  }

  @Delete("alerts/policies/:id")
  @RequirePermissions("alerts.manage")
  deleteAlertPolicy(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.phase3Service.deleteAlertPolicy(user.tenantId, user, id);
  }

  @Get("alerts/events")
  @RequirePermissions("alerts.read")
  listAlertEvents(
    @CurrentUser() user: RequestUser,
    @Query("state") state?: string,
    @Query("severity") severity?: string,
    @Query("site_id") siteId?: string,
    @Query("incident_id") incidentId?: string,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string
  ) {
    return this.phase3Service.listAlertEvents(user.tenantId, {
      state,
      severity,
      site_id: siteId,
      incident_id: incidentId,
      cursor,
      limit: limit ? Number(limit) : undefined
    });
  }

  @Post("alerts/events/:id/ack")
  @RequirePermissions("alerts.manage")
  acknowledgeAlertEvent(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.phase3Service.acknowledgeAlertEvent(user.tenantId, user, id);
  }

  @Post("alerts/test-route")
  @RequirePermissions("alerts.manage")
  testAlertRoute(@CurrentUser() user: RequestUser, @Body() body: unknown) {
    return this.phase3Service.testAlertRoute(user.tenantId, user, body);
  }

  @Get("rbac/scopes")
  @RequirePermissions("rbac.read")
  getScopeCatalog() {
    return this.phase3Service.getScopeCatalog();
  }

  @Get("rbac/roles")
  @RequirePermissions("rbac.read")
  getRoleScopeMatrix(@CurrentUser() user: RequestUser) {
    return this.phase3Service.getRoleScopeMatrix(user.tenantId);
  }

  @Patch("rbac/roles/:role")
  @RequirePermissions("rbac.write")
  patchRoleScopeOverride(@CurrentUser() user: RequestUser, @Param("role") role: string, @Body() body: unknown) {
    return this.phase3Service.patchRoleScopeOverride(user.tenantId, user, role, body);
  }

  @Get("system/pipeline-status")
  @RequirePermissions("config.read")
  getPipelineStatus(@CurrentUser() user: RequestUser) {
    return this.phase3Service.getPipelineStatus(user.tenantId);
  }
}
