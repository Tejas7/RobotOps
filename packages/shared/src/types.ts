import type { Permission, Role } from "./rbac";

export type Status = "online" | "offline" | "degraded" | "maintenance" | "emergency_stop";

export interface Tenant {
  id: string;
  name: string;
  plan: "free" | "pro" | "enterprise";
  createdAt: string;
}

export interface Site {
  id: string;
  tenantId: string;
  name: string;
  address: string;
  timezone: string;
  createdAt: string;
}

export interface Floorplan {
  id: string;
  siteId: string;
  name: string;
  imageUrl: string;
  scaleMetersPerPixel: number;
  originX: number;
  originY: number;
  rotationDegrees: number;
}

export interface ZonePoint {
  x: number;
  y: number;
}

export interface Zone {
  id: string;
  floorplanId: string;
  name: string;
  type: "restricted" | "charging" | "staging" | "pickup" | "dropoff" | "pedestrian" | "hazard";
  polygon: ZonePoint[];
  maxSpeedMps: number;
  requiresOperatorAck: boolean;
  allowedRobotTags: string[];
}

export interface Robot {
  id: string;
  tenantId: string;
  siteId: string;
  vendorId: string;
  name: string;
  model: string;
  serial: string;
  tags: string[];
  status: Status;
  batteryPercent: number;
  lastSeenAt: string;
  floorplanId: string;
  x: number;
  y: number;
  headingDegrees: number;
  confidence: number;
  cpuPercent: number;
  memoryPercent: number;
  tempC: number;
  networkRssi: number;
  diskPercent: number;
  capabilities: string[];
  connection: "wifi" | "lte" | "ethernet";
  ip: string;
  firmware: string;
  agentVersion: string;
  edgeId: string | null;
  createdAt: string;
}

export interface SiteSetting {
  tenantId: string;
  siteId: string;
  robotOfflineAfterSeconds: number;
  robotStatePublishPeriodSeconds: number;
  createdAt: string;
  updatedAt: string;
}

export interface RobotOfflineComputationInput {
  reportedStatus: Status;
  lastSeenAt: string;
  robotOfflineAfterSeconds: number;
  now?: string;
}

export interface RobotOfflineComputationResult {
  status: Status;
  reportedStatus: Status;
  isOfflineComputed: boolean;
  offlineAfterSeconds: number;
}

export interface RobotLastStateResponse {
  robotId: string;
  tenantId: string;
  siteId: string;
  name: string;
  vendor: string;
  model: string;
  serial: string;
  tags: string[];
  status: Status;
  reportedStatus: Status;
  isOfflineComputed: boolean;
  batteryPercent: number;
  lastSeenAt: string;
  floorplanId: string;
  x: number;
  y: number;
  headingDegrees: number;
  confidence: number;
  healthScore: number;
  cpuPercent: number;
  memoryPercent: number;
  tempC: number;
  diskPercent: number;
  networkRssi: number;
  currentTaskId: string | null;
  currentTaskState: string | null;
  currentTaskPercentComplete: number | null;
  updatedAt: string;
}

export interface Mission {
  id: string;
  tenantId: string;
  siteId: string;
  name: string;
  type: "pickup_dropoff" | "patrol" | "inventory" | "cleaning" | "custom";
  priority: "low" | "normal" | "high" | "critical";
  createdByUserId: string;
  assignedRobotId: string | null;
  state: "queued" | "running" | "blocked" | "succeeded" | "failed" | "canceled";
  startTime: string | null;
  endTime: string | null;
  durationS: number;
  distanceM: number;
  stopsCount: number;
  interventionsCount: number;
  energyUsedWh: number;
  routeWaypoints: unknown;
  routePolyline: unknown;
  failureCode: string | null;
  failureMessage: string | null;
  lastEventId: string | null;
}

export interface MissionEvent {
  id: string;
  missionId: string;
  robotId: string;
  timestamp: string;
  type: "state_change" | "waypoint_reached" | "warning" | "error" | "operator_action" | "traffic_event";
  payload: unknown;
}

export interface Incident {
  id: string;
  tenantId: string;
  siteId: string;
  robotId: string | null;
  missionId: string | null;
  severity: "info" | "warning" | "major" | "critical";
  category: "navigation" | "traffic" | "battery" | "connectivity" | "hardware" | "safety" | "integration";
  status: "open" | "acknowledged" | "mitigated" | "resolved";
  title: string;
  description: string;
  createdAt: string;
  acknowledgedBy: string | null;
  resolvedAt: string | null;
}

export interface IncidentEvent {
  id: string;
  incidentId: string;
  timestamp: string;
  type: "created" | "acknowledged" | "note" | "automation" | "teleop_started" | "teleop_ended" | "resolved";
  message: string;
  meta: unknown;
}

export interface Asset {
  id: string;
  tenantId: string;
  siteId: string;
  type: "forklift" | "pallet_jack" | "cart" | "person" | "door" | "conveyor" | "station";
  name: string;
  tags: string[];
  floorplanId: string;
  x: number;
  y: number;
  headingDegrees: number;
  confidence: number;
  lastSeenAt: string;
}

export interface ProximityEvent {
  id: string;
  tenantId: string;
  siteId: string;
  timestamp: string;
  robotId: string;
  assetId: string;
  distanceM: number;
  riskLevel: "low" | "medium" | "high";
  zoneId: string | null;
}

export interface ApiKey {
  id: string;
  tenantId: string;
  name: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface Integration {
  id: string;
  tenantId: string;
  type: "wms" | "erp" | "wes" | "webhook" | "slack" | "teams" | "email" | "sso" | "rtls_partner";
  name: string;
  status: "active" | "disabled" | "error";
  config: Record<string, unknown>;
  lastSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IntegrationTestRun {
  id: string;
  integrationId: string;
  tenantId: string;
  status: "success" | "error";
  message: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface SavedView {
  id: string;
  tenantId: string;
  createdBy: string;
  page: string;
  name: string;
  filters: Record<string, unknown>;
  layout: Record<string, unknown>;
  isShared: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RoleDashboardDefault {
  id: string;
  tenantId: string;
  role: Role;
  page: string;
  savedViewId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardConfig {
  id: string;
  tenantId: string;
  name: string;
  schemaVersion: "1";
  widgets: Array<Record<string, unknown>>;
  rules: Record<string, unknown>;
  appliesTo: Record<string, unknown>;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  tenantId: string;
  timestamp: string;
  actorType: "user" | "api_key" | "system";
  actorId: string;
  action: string;
  resourceType: "robot" | "mission" | "incident" | "integration" | "config";
  resourceId: string;
  diff: unknown;
  ip: string;
  userAgent: string;
}

export interface DashboardConfigValidationError {
  path: string;
  message: string;
}

export type CanonicalMessageType = "robot_state" | "robot_event" | "task_status";
export type CanonicalSeverity = "info" | "warning" | "major" | "critical";
export type CanonicalCategory =
  | "navigation"
  | "traffic"
  | "battery"
  | "connectivity"
  | "hardware"
  | "safety"
  | "integration";

export interface CanonicalEnvelopeSource {
  sourceType: "edge" | "adapter" | "simulator";
  sourceId: string;
  vendor: string;
  protocol: "http" | "websocket" | "internal";
}

export interface CanonicalEnvelopeEntity {
  entityType: "robot";
  robotId: string;
}

export interface RobotStatePayload {
  status?: Status;
  batteryPercent?: number;
  pose?: {
    floorplanId?: string;
    x: number;
    y: number;
    headingDegrees?: number;
    confidence?: number;
  };
  telemetry?: {
    cpuPercent?: number;
    memoryPercent?: number;
    tempC?: number;
    diskPercent?: number;
    networkRssi?: number;
  };
  metrics?: Record<string, number>;
  task?: {
    taskId?: string;
    state?: string;
    percentComplete?: number;
  };
  meta?: Record<string, unknown>;
}

export interface RobotEventPayload {
  eventId?: string;
  dedupeKey?: string;
  eventType: string;
  severity: CanonicalSeverity;
  category: CanonicalCategory;
  title: string;
  message?: string;
  createIncident?: boolean;
  occurredAt?: string;
  meta?: Record<string, unknown>;
}

export interface TaskStatusPayload {
  taskId: string;
  state: "queued" | "running" | "blocked" | "succeeded" | "failed" | "canceled";
  percentComplete?: number;
  updatedAt?: string;
  message?: string;
  meta?: Record<string, unknown>;
}

export interface CanonicalEnvelope {
  messageId: string;
  schemaVersion: number;
  tenantId: string;
  siteId: string;
  messageType: CanonicalMessageType;
  timestamp: string;
  source: CanonicalEnvelopeSource;
  entity: CanonicalEnvelopeEntity;
  payload: RobotStatePayload | RobotEventPayload | TaskStatusPayload;
}

export interface CanonicalIngestResponse {
  accepted: number;
  duplicate: number;
  queued: number;
  source: string;
  schemaVersion: number;
  messageType: CanonicalMessageType;
  messageId: string;
}

export type TelemetryIngestResponse = CanonicalIngestResponse;

export interface TelemetryBucket {
  timestamp: string;
  value: number;
  count: number;
  min?: number;
  max?: number;
}

export interface TelemetrySeriesResponse {
  robotId: string;
  metric: string;
  from: string;
  to: string;
  totalPoints: number;
  downsampled: boolean;
  aggregation: "avg" | "min" | "max" | "last";
  bucketSeconds: number | null;
  maxPoints: number;
  points: TelemetryBucket[];
}

export interface RobotPathPoint {
  id: string;
  robotId: string;
  floorplanId: string;
  x: number;
  y: number;
  headingDegrees: number;
  confidence: number;
  timestamp: string;
}

export interface CrossSiteAnalyticsSitePoint {
  siteId: string;
  missionsTotal: number;
  missionsSucceeded: number;
  incidentsOpen: number;
  interventionsPer100Missions: number;
  uptimePercent: number;
}

export interface CrossSiteAnalyticsTrendPoint {
  bucketStart: string;
  siteId: string;
  missionsTotal: number;
  incidentsOpen: number;
}

export interface CrossSiteAnalyticsResponse {
  window: {
    from: string;
    to: string;
    granularity: "hour" | "day";
  };
  totals: {
    sites: number;
    missionsTotal: number;
    missionsSucceeded: number;
    incidentsOpen: number;
  };
  bySite: CrossSiteAnalyticsSitePoint[];
  trend: CrossSiteAnalyticsTrendPoint[];
}

export interface AlertPolicyStep {
  id: string;
  policyId: string;
  orderIndex: number;
  delaySeconds: number;
  channel: "slack" | "teams" | "email" | "webhook" | "pager";
  target: string;
  severityMin: "info" | "warning" | "major" | "critical" | null;
  template: string | null;
}

export interface AlertPolicy {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  steps: AlertPolicyStep[];
}

export interface AlertRule {
  id: string;
  tenantId: string;
  name: string;
  eventType: "incident" | "integration_error";
  policyId: string;
  priority: number;
  isActive: boolean;
  severity: "info" | "warning" | "major" | "critical" | null;
  category: string | null;
  siteId: string | null;
  conditions: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AlertDeliveryResponse {
  id: string;
  alertEventId: string;
  policyStepId: string | null;
  state: "scheduled" | "sent" | "failed" | "canceled";
  attempt: number;
  channel: "slack" | "teams" | "email" | "webhook" | "pager";
  target: string;
  scheduledFor: string;
  sentAt: string | null;
  message: string;
  error: string | null;
  details: Record<string, unknown>;
}

export interface AlertEventResponse {
  id: string;
  tenantId: string;
  incidentId: string | null;
  ruleId: string | null;
  policyId: string | null;
  state: "open" | "acknowledged" | "resolved";
  severity: "info" | "warning" | "major" | "critical";
  title: string;
  payload: Record<string, unknown>;
  triggeredAt: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  resolvedAt: string | null;
  deliveries: AlertDeliveryResponse[];
}

export interface ScopeCatalog {
  version: number;
  scopes: Permission[];
  deprecatedScopes: Permission[];
  aliases: Partial<Record<Permission, Permission[]>>;
}

export interface RoleScopeOverride {
  role: Role;
  allowScopes: Permission[];
  denyScopes: Permission[];
}

export interface RoleScopeMatrix {
  tenantId: string;
  roles: Array<{
    role: Role;
    baseScopes: Permission[];
    effectiveScopes: Permission[];
    overrides: RoleScopeOverride | null;
  }>;
}

export interface PipelineStatusResponse {
  timestamp: string;
  nats: {
    connected: boolean;
    stream: string;
    subject: string;
  };
  ingestion: {
    queued: number;
    processed: number;
    failed: number;
    deadLetters: number;
  };
  rollups: {
    siteHourlyLatest: string | null;
    tenantHourlyLatest: string | null;
    freshnessSeconds: number | null;
  };
  timescale: {
    extensionAvailable: boolean;
    hypertableReady: boolean;
    continuousAggregates: string[];
  };
}

export interface CopilotThread {
  id: string;
  tenantId: string;
  siteId: string | null;
  createdBy: string;
  createdAt: string;
}

export interface CopilotMessage {
  id: string;
  threadId: string;
  timestamp: string;
  role: "user" | "assistant" | "tool";
  content: string;
  toolCalls: unknown;
  citations: unknown;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  tenantId: string;
  role: Role;
  permissions: Permission[];
  scopeVersion?: number;
}

export interface AuditEventInput {
  action: string;
  resourceType: "robot" | "mission" | "incident" | "integration" | "config";
  resourceId: string;
  diff?: unknown;
  actorType: "user" | "api_key" | "system";
  actorId: string;
}

export type LiveChannel = "robots.live" | "incidents.live" | "missions.live" | "telemetry.live" | "alerts.live";

export interface LiveEvent<T = unknown> {
  channel: LiveChannel;
  data: T;
  timestamp: string;
}
