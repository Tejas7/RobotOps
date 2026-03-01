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

export const robotLastStateQuerySchema = z.object({
  site_id: z.string().min(1).optional(),
  status: z.enum(["online", "offline", "degraded", "maintenance", "emergency_stop"]).optional(),
  vendor: z.string().min(1).optional(),
  tag: z.string().min(1).optional()
});

const vendorMapKeySchema = z.string().trim().min(1);

export const vendorSiteMapQuerySchema = z.object({
  site_id: z.string().min(1).optional(),
  vendor: z.string().trim().min(1).optional()
});

export const vendorSiteMapCreateSchema = z
  .object({
    site_id: z.string().min(1),
    vendor: z.string().trim().min(1),
    vendor_map_id: vendorMapKeySchema.optional(),
    vendor_map_name: vendorMapKeySchema.optional(),
    robotops_floorplan_id: z.string().min(1),
    scale: z.coerce.number().positive().optional().default(1),
    rotation_degrees: z.coerce.number().optional().default(0),
    translate_x: z.coerce.number().optional().default(0),
    translate_y: z.coerce.number().optional().default(0)
  })
  .superRefine((input, ctx) => {
    if (!input.vendor_map_id && !input.vendor_map_name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["vendor_map_id"],
        message: "Either vendor_map_id or vendor_map_name is required"
      });
    }
  });

export const vendorSiteMapPatchSchema = z
  .object({
    vendor: z.string().trim().min(1).optional(),
    vendor_map_id: z.string().trim().min(1).nullable().optional(),
    vendor_map_name: z.string().trim().min(1).nullable().optional(),
    robotops_floorplan_id: z.string().min(1).optional(),
    scale: z.coerce.number().positive().optional(),
    rotation_degrees: z.coerce.number().optional(),
    translate_x: z.coerce.number().optional(),
    translate_y: z.coerce.number().optional()
  })
  .refine((input) => Object.keys(input).length > 0, "At least one field is required");

export const vendorSiteMapPreviewSchema = z.object({
  robotops_floorplan_id: z.string().min(1).optional(),
  scale: z.coerce.number().positive(),
  rotation_degrees: z.coerce.number(),
  translate_x: z.coerce.number(),
  translate_y: z.coerce.number(),
  points: z
    .array(
      z.object({
        x: z.number(),
        y: z.number(),
        heading_degrees: z.number().optional(),
        confidence: z.number().min(0).max(1).optional()
      })
    )
    .min(1)
    .max(500)
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

const TELEMETRY_INGEST_METRICS = ["battery", "temp_c", "cpu_percent", "network_rssi", "disk_percent"] as const;
export const ROBOT_STATE_ALLOWED_LATENESS_SECONDS = 5 as const;
export const ROBOT_EVENT_DEDUPE_WINDOW_SECONDS = 1800 as const;
export const TASK_STATUS_DEDUPE_WINDOW_SECONDS = 86400 as const;

export const canonicalMessageTypeSchema = z.enum(["robot_state", "robot_event", "task_status"]);
export const canonicalSeveritySchema = z.enum(["info", "warning", "major", "critical"]);
export const canonicalCategorySchema = z.enum([
  "navigation",
  "traffic",
  "battery",
  "connectivity",
  "hardware",
  "safety",
  "integration"
]);

export const SUPPORTED_CANONICAL_SCHEMA_VERSIONS = [1] as const;

export function isSupportedCanonicalSchemaVersion(version: number) {
  return SUPPORTED_CANONICAL_SCHEMA_VERSIONS.includes(version as (typeof SUPPORTED_CANONICAL_SCHEMA_VERSIONS)[number]);
}

export const robotStatePayloadSchema = z
  .object({
    sequence: z.number().int().positive().optional(),
    status: z.enum(["online", "offline", "degraded", "maintenance", "emergency_stop"]).optional(),
    battery_percent: z.number().min(0).max(100).optional(),
    pose: z
      .object({
        floorplan_id: z.string().min(1).optional(),
        vendor_map_id: z.string().trim().min(1).optional(),
        vendor_map_name: z.string().trim().min(1).optional(),
        x: z.number(),
        y: z.number(),
        heading_degrees: z.number().optional().default(0),
        confidence: z.number().min(0).max(1).optional()
      })
      .optional(),
    telemetry: z
      .object({
        cpu_percent: z.number().min(0).max(100).optional(),
        memory_percent: z.number().min(0).max(100).optional(),
        temp_c: z.number().optional(),
        disk_percent: z.number().min(0).max(100).optional(),
        network_rssi: z.number().optional()
      })
      .optional(),
    metrics: z.record(z.string(), z.number()).optional(),
    task: z
      .object({
        task_id: z.string().min(1).optional(),
        state: z.string().min(1).optional(),
        percent_complete: z.number().min(0).max(100).optional()
      })
      .optional(),
    meta: z.record(z.string(), z.unknown()).optional()
  })
  .superRefine((input, ctx) => {
    if (Object.keys(input).length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [],
        message: "robot_state payload cannot be empty"
      });
    }
    if (input.metrics) {
      const allowed = new Set<string>(TELEMETRY_INGEST_METRICS);
      for (const key of Object.keys(input.metrics)) {
        if (!allowed.has(key)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["metrics", key],
            message: `Unsupported metric: ${key}`
          });
        }
      }
    }
  });

export const robotEventPayloadSchema = z.object({
  sequence: z.number().int().positive().optional(),
  event_id: z.string().min(1).optional(),
  dedupe_key: z.string().min(1),
  event_type: z.string().min(1),
  severity: canonicalSeveritySchema,
  category: canonicalCategorySchema,
  title: z.string().min(1),
  message: z.string().min(1).optional(),
  create_incident: z.boolean().optional().default(true),
  occurred_at: z.string().datetime().optional(),
  meta: z.record(z.string(), z.unknown()).optional().default({})
});

export const taskStatusPayloadSchema = z.object({
  sequence: z.number().int().positive().optional(),
  task_id: z.string().min(1),
  state: z.enum(["queued", "running", "blocked", "succeeded", "failed", "canceled"]),
  percent_complete: z.number().min(0).max(100).optional(),
  updated_at: z.string().datetime().optional(),
  message: z.string().optional(),
  meta: z.record(z.string(), z.unknown()).optional().default({})
});

const canonicalSourceSchema = z.object({
  source_type: z.enum(["edge", "adapter", "simulator"]),
  source_id: z.string().min(1),
  vendor: z.string().min(1),
  protocol: z.enum(["http", "websocket", "internal"])
});

const canonicalEntitySchema = z.object({
  entity_type: z.literal("robot"),
  robot_id: z.string().min(1)
});

export const canonicalEnvelopeSchema = z
  .object({
    message_id: z.string().uuid(),
    schema_version: z.coerce.number().int().positive(),
    tenant_id: z.string().min(1),
    site_id: z.string().min(1),
    message_type: canonicalMessageTypeSchema,
    timestamp: z.string().datetime(),
    source: canonicalSourceSchema,
    entity: canonicalEntitySchema,
    payload: z.unknown()
  })
  .superRefine((input, ctx) => {
    if (!isSupportedCanonicalSchemaVersion(input.schema_version)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["schema_version"],
        message: `Unsupported schema_version: ${input.schema_version}`
      });
      return;
    }

    const parser =
      input.message_type === "robot_state"
        ? robotStatePayloadSchema
        : input.message_type === "robot_event"
          ? robotEventPayloadSchema
          : taskStatusPayloadSchema;
    const payloadParse = parser.safeParse(input.payload);
    if (!payloadParse.success) {
      for (const issue of payloadParse.error.issues) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["payload", ...issue.path],
          message: issue.message
        });
      }
    }
  });

type CanonicalPayloadByType = {
  robot_state: z.infer<typeof robotStatePayloadSchema>;
  robot_event: z.infer<typeof robotEventPayloadSchema>;
  task_status: z.infer<typeof taskStatusPayloadSchema>;
};

export function parseCanonicalPayload<T extends z.infer<typeof canonicalMessageTypeSchema>>(
  messageType: T,
  payload: unknown
): z.SafeParseReturnType<unknown, CanonicalPayloadByType[T]> {
  const parser =
    messageType === "robot_state"
      ? robotStatePayloadSchema
      : messageType === "robot_event"
        ? robotEventPayloadSchema
        : taskStatusPayloadSchema;
  return parser.safeParse(payload) as z.SafeParseReturnType<unknown, CanonicalPayloadByType[T]>;
}

export const crossSiteAnalyticsQuerySchema = z.object({
  site_id: z.string().optional().default("all"),
  site_ids: z.array(z.string().min(1)).optional().default([]),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  granularity: z.enum(["hour", "day"]).optional().default("hour"),
  use_rollups: z.coerce.boolean().optional().default(true)
});

export const adapterCaptureRecordRequestSchema = z.object({
  vendor: z.string().trim().min(1),
  site_id: z.string().min(1),
  adapter_name: z.string().trim().min(1),
  duration_seconds: z.coerce.number().int().min(1).max(3600).optional().default(10),
  source_endpoint: z.string().trim().min(1).optional().default("/vendor/mock"),
  capture_id: z.string().trim().min(1).optional()
});

export const adapterCaptureQuerySchema = z.object({
  vendor: z.string().trim().min(1).optional(),
  site_id: z.string().min(1).optional()
});

export const rawCaptureManifestSchema = z
  .object({
    capture_id: z.string().trim().min(1),
    tenant_id: z.string().min(1),
    vendor: z.string().trim().min(1),
    site_id: z.string().min(1),
    adapter_name: z.string().trim().min(1),
    source_endpoint: z.string().trim().min(1),
    start_time: z.string().datetime(),
    end_time: z.string().datetime(),
    capture_version: z.coerce.number().int().positive().optional().default(1),
    entry_count: z.coerce.number().int().nonnegative()
  })
  .superRefine((input, ctx) => {
    if (new Date(input.start_time).getTime() > new Date(input.end_time).getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["end_time"],
        message: "end_time must be greater than or equal to start_time"
      });
    }
  });

export const rawCaptureEntrySchema = z.object({
  timestamp: z.string().datetime(),
  raw_payload: z.record(z.string(), z.unknown()),
  raw_headers: z.record(z.string(), z.string()).optional(),
  raw_path: z.string().optional(),
  sequence_hint: z.coerce.number().int().optional(),
  capture_index: z.coerce.number().int().nonnegative()
});

export const replayOptionsSchema = z.object({
  replay_speed_multiplier: z.coerce.number().min(0).max(1000).optional().default(1),
  deterministic_ordering: z.coerce.boolean().optional().default(true),
  time_window_filter: z
    .object({
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional()
    })
    .optional(),
  validation_only: z.coerce.boolean().optional().default(false),
  return_envelopes: z.coerce.boolean().optional().default(false)
});

export const adapterReplayRequestSchema = replayOptionsSchema.extend({
  capture_id: z.string().trim().min(1),
  replay_mode: z
    .enum(["logical_timestamp_scaling", "wall_clock_pacing", "hybrid"])
    .optional()
    .default("logical_timestamp_scaling"),
  start_at: z.string().datetime().optional(),
  sleep: z.boolean().optional(),
  timestamp_policy: z.enum(["preserve", "rewrite_to_now"]).optional(),
  run_id: z.string().uuid().optional()
});

const alertSeveritySchema = z.enum(["info", "warning", "major", "critical"]);
const alertChannelSchema = z.enum(["slack", "teams", "email", "webhook", "pager"]);
const roleSchema = z.enum(["Owner", "OpsManager", "Engineer", "Operator", "Viewer"]);

export const alertPolicyStepSchema = z.object({
  delay_seconds: z.coerce.number().int().min(0).max(86400),
  channel: alertChannelSchema,
  target: z.string().min(1),
  severity_min: alertSeveritySchema.optional(),
  template: z.string().optional()
});

export const alertPolicySchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  is_active: z.boolean().optional().default(true),
  steps: z.array(alertPolicyStepSchema).min(1)
});

export const alertPolicyPatchSchema = z
  .object({
    name: z.string().min(2).optional(),
    description: z.string().optional(),
    is_active: z.boolean().optional(),
    steps: z.array(alertPolicyStepSchema).min(1).optional()
  })
  .refine((input) => Object.keys(input).length > 0, "At least one field is required");

export const alertRuleCreateSchema = z.object({
  name: z.string().min(2),
  event_type: z.enum(["incident", "integration_error"]),
  policy_id: z.string().min(1),
  priority: z.coerce.number().int().min(1).max(1000).optional().default(100),
  is_active: z.boolean().optional().default(true),
  severity: alertSeveritySchema.optional(),
  category: z.string().optional(),
  site_id: z.string().optional(),
  conditions: z.record(z.string(), z.unknown()).optional().default({})
});

export const alertRulePatchSchema = z
  .object({
    name: z.string().min(2).optional(),
    policy_id: z.string().min(1).optional(),
    priority: z.coerce.number().int().min(1).max(1000).optional(),
    is_active: z.boolean().optional(),
    severity: alertSeveritySchema.optional().nullable(),
    category: z.string().optional().nullable(),
    site_id: z.string().optional().nullable(),
    conditions: z.record(z.string(), z.unknown()).optional()
  })
  .refine((input) => Object.keys(input).length > 0, "At least one field is required");

export const alertTestRouteSchema = z.object({
  event_type: z.enum(["incident", "integration_error"]),
  incident_id: z.string().optional(),
  integration_id: z.string().optional(),
  site_id: z.string().optional(),
  severity: alertSeveritySchema.optional(),
  category: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).optional().default({})
});

export const roleScopeOverridePatchSchema = z.object({
  role: roleSchema,
  allow_scopes: z.array(z.string().min(1)).optional().default([]),
  deny_scopes: z.array(z.string().min(1)).optional().default([])
});

export type RobotActionInput = z.infer<typeof robotActionSchema>;
export type MissionCreateInput = z.infer<typeof missionCreateSchema>;
export type IncidentResolveInput = z.infer<typeof incidentResolveSchema>;
export type CopilotMessageInput = z.infer<typeof copilotMessageSchema>;
export type TelemetryQueryInput = z.infer<typeof telemetryQuerySchema>;
export type RobotPathQueryInput = z.infer<typeof robotPathQuerySchema>;
export type RobotLastStateQueryInput = z.infer<typeof robotLastStateQuerySchema>;
export type VendorSiteMapQueryInput = z.infer<typeof vendorSiteMapQuerySchema>;
export type VendorSiteMapCreateInput = z.infer<typeof vendorSiteMapCreateSchema>;
export type VendorSiteMapPatchInput = z.infer<typeof vendorSiteMapPatchSchema>;
export type VendorSiteMapPreviewInput = z.infer<typeof vendorSiteMapPreviewSchema>;
export type SavedViewCreateInput = z.infer<typeof savedViewCreateSchema>;
export type SavedViewPatchInput = z.infer<typeof savedViewPatchSchema>;
export type RoleDefaultInput = z.infer<typeof roleDefaultSchema>;
export type IntegrationCreateInput = z.infer<typeof integrationCreateSchema>;
export type IntegrationPatchInput = z.infer<typeof integrationPatchSchema>;
export type DashboardConfigInput = z.infer<typeof dashboardConfigSchemaV1>;
export type DashboardConfigPatchInput = z.infer<typeof dashboardConfigPatchSchema>;
export type RobotStatePayloadInput = z.infer<typeof robotStatePayloadSchema>;
export type RobotEventPayloadInput = z.infer<typeof robotEventPayloadSchema>;
export type TaskStatusPayloadInput = z.infer<typeof taskStatusPayloadSchema>;
export type CanonicalMessageTypeInput = z.infer<typeof canonicalMessageTypeSchema>;
export type CanonicalEnvelopeInput = z.infer<typeof canonicalEnvelopeSchema>;
export type CrossSiteAnalyticsQueryInput = z.infer<typeof crossSiteAnalyticsQuerySchema>;
export type AdapterCaptureRecordRequestInput = z.infer<typeof adapterCaptureRecordRequestSchema>;
export type AdapterCaptureQueryInput = z.infer<typeof adapterCaptureQuerySchema>;
export type RawCaptureManifestInput = z.infer<typeof rawCaptureManifestSchema>;
export type RawCaptureEntryInput = z.infer<typeof rawCaptureEntrySchema>;
export type ReplayOptionsInput = z.infer<typeof replayOptionsSchema>;
export type AdapterReplayRequestInput = z.infer<typeof adapterReplayRequestSchema>;
export type AlertPolicyInput = z.infer<typeof alertPolicySchema>;
export type AlertPolicyPatchInput = z.infer<typeof alertPolicyPatchSchema>;
export type AlertRuleCreateInput = z.infer<typeof alertRuleCreateSchema>;
export type AlertRulePatchInput = z.infer<typeof alertRulePatchSchema>;
export type AlertTestRouteInput = z.infer<typeof alertTestRouteSchema>;
export type RoleScopeOverridePatchInput = z.infer<typeof roleScopeOverridePatchSchema>;
