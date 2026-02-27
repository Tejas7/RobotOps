import { z } from "zod";

export const robotActionSchema = z.object({
  action: z.enum(["dock", "pause", "resume", "speed_limit"]),
  params: z.record(z.string(), z.unknown()).default({})
});

export const missionWaypointSchema = z.object({
  name: z.string().min(1),
  x: z.number(),
  y: z.number(),
  zone_id: z.string().min(1).optional()
});

export const missionCreateSchema = z.object({
  name: z.string().min(3),
  type: z.enum(["pickup_dropoff", "patrol", "inventory", "cleaning", "custom"]),
  priority: z.enum(["low", "normal", "high", "critical"]),
  site_id: z.string().min(1),
  assigned_robot_id: z.string().nullable(),
  route: z.object({
    waypoints: z.array(missionWaypointSchema).min(2),
    planned_path_polyline: z.array(z.object({ x: z.number(), y: z.number() })).min(2)
  }),
  operator_acknowledged_restricted_zones: z.boolean().optional().default(false)
});

export const incidentResolveSchema = z.object({
  note: z.string().min(3)
});

export const copilotMessageSchema = z.object({
  thread_id: z.string().min(1),
  content: z.string().min(1)
});

export const telemetryMetricSchema = z.enum(["battery", "temp_c", "cpu_percent", "network_rssi", "disk_percent"]);

export const telemetryQuerySchema = z.object({
  metric: telemetryMetricSchema.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  max_points: z.coerce.number().int().positive().max(5000).optional().default(240),
  bucket_seconds: z.coerce.number().int().positive().optional(),
  aggregation: z.enum(["avg", "min", "max", "last"]).optional().default("avg")
});

export const robotPathQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  interval_seconds: z.coerce.number().int().positive().optional().default(20),
  floorplan_id: z.string().min(1).optional()
});

export const savedViewCreateSchema = z.object({
  page: z.string().min(1),
  name: z.string().min(2),
  filters: z.record(z.string(), z.unknown()).default({}),
  layout: z.record(z.string(), z.unknown()).default({}),
  is_shared: z.boolean().optional().default(false)
});

export const savedViewPatchSchema = z
  .object({
    name: z.string().min(2).optional(),
    filters: z.record(z.string(), z.unknown()).optional(),
    layout: z.record(z.string(), z.unknown()).optional(),
    is_shared: z.boolean().optional()
  })
  .refine((input) => Object.keys(input).length > 0, "At least one field is required");

export const roleDefaultSchema = z.object({
  role: z.enum(["Owner", "OpsManager", "Engineer", "Operator", "Viewer"]),
  page: z.string().min(1),
  saved_view_id: z.string().min(1)
});

export const integrationCreateSchema = z.object({
  type: z.enum(["wms", "erp", "wes", "webhook", "slack", "teams", "email", "sso", "rtls_partner"]),
  name: z.string().min(2),
  config: z.record(z.string(), z.unknown()).default({})
});

export const integrationPatchSchema = z
  .object({
    name: z.string().min(2).optional(),
    status: z.enum(["active", "disabled", "error"]).optional(),
    config: z.record(z.string(), z.unknown()).optional()
  })
  .refine((input) => Object.keys(input).length > 0, "At least one field is required");

const dashboardWidgetSchemaV1 = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  metric: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  options: z.record(z.string(), z.unknown()).optional()
});

export const dashboardConfigSchemaV1 = z.object({
  name: z.string().min(2),
  schema_version: z.literal("1"),
  widgets: z.array(dashboardWidgetSchemaV1).min(1),
  rules: z.record(z.string(), z.unknown()).default({}),
  applies_to: z.object({
    robot_tags: z.array(z.string()).optional().default([]),
    site_ids: z.array(z.string()).optional().default([]),
    roles: z.array(z.enum(["Owner", "OpsManager", "Engineer", "Operator", "Viewer"])).optional().default([])
  })
});

export const dashboardConfigPatchSchema = z
  .object({
    name: z.string().min(2).optional(),
    widgets: z.array(dashboardWidgetSchemaV1).min(1).optional(),
    rules: z.record(z.string(), z.unknown()).optional(),
    applies_to: z
      .object({
        robot_tags: z.array(z.string()).optional(),
        site_ids: z.array(z.string()).optional(),
        roles: z.array(z.enum(["Owner", "OpsManager", "Engineer", "Operator", "Viewer"])).optional()
      })
      .optional()
  })
  .refine((input) => Object.keys(input).length > 0, "At least one field is required");

export type RobotActionInput = z.infer<typeof robotActionSchema>;
export type MissionCreateInput = z.infer<typeof missionCreateSchema>;
export type IncidentResolveInput = z.infer<typeof incidentResolveSchema>;
export type CopilotMessageInput = z.infer<typeof copilotMessageSchema>;
export type TelemetryQueryInput = z.infer<typeof telemetryQuerySchema>;
export type RobotPathQueryInput = z.infer<typeof robotPathQuerySchema>;
export type SavedViewCreateInput = z.infer<typeof savedViewCreateSchema>;
export type SavedViewPatchInput = z.infer<typeof savedViewPatchSchema>;
export type RoleDefaultInput = z.infer<typeof roleDefaultSchema>;
export type IntegrationCreateInput = z.infer<typeof integrationCreateSchema>;
export type IntegrationPatchInput = z.infer<typeof integrationPatchSchema>;
export type DashboardConfigInput = z.infer<typeof dashboardConfigSchemaV1>;
export type DashboardConfigPatchInput = z.infer<typeof dashboardConfigPatchSchema>;
