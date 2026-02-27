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
}

export interface AuditEventInput {
  action: string;
  resourceType: "robot" | "mission" | "incident" | "integration" | "config";
  resourceId: string;
  diff?: unknown;
  actorType: "user" | "api_key" | "system";
  actorId: string;
}

export type LiveChannel = "robots.live" | "incidents.live" | "missions.live" | "telemetry.live";

export interface LiveEvent<T = unknown> {
  channel: LiveChannel;
  data: T;
  timestamp: string;
}
