# Data Model and Storage

Primary schema file: `apps/api/prisma/schema.prisma`

## Storage Stack
- Primary DB: PostgreSQL (Timescale-enabled image in local compose).
- ORM: Prisma Client.
- Timescale features in migration are safe no-op when extension is unavailable.

## Migration Timeline
- `20260227025301_init`
  - Baseline operational entities (tenant/site/fleet/missions/incidents/assets/audit/copilot/telemetry).
- `20260227100000_phase2`
  - Integrations, saved views + role defaults, dashboard configs, robot path points, telemetry indexes.
- `20260227123000_phase3`
  - Ingestion events, dead letters, analytics rollups, alerts model, role scope overrides, Timescale setup SQL.
- `20260227180000_v1_phase1_canonical_envelope`
  - Canonical envelope enums/model (`CanonicalMessage`) and ingestion linkage.

## Core Domain Models
- Tenant context: `Tenant`, `User`, `Site`, `Floorplan`, `Zone`.
- Fleet state: `RobotVendor`, `Robot`, `TelemetryPoint`, `RobotPathPoint`.
- Work orchestration: `Mission`, `MissionEvent`.
- Exception management: `Incident`, `IncidentEvent`.
- RTLS context: `Asset`, `ProximityEvent`.
- Platform/admin: `ApiKey`, `AuditLog`, `CopilotThread`, `CopilotMessage`.

## Phase 2 Models
- `Integration`
- `IntegrationTestRun`
- `SavedView`
- `RoleDashboardDefault`
- `DashboardConfig`
- `RobotPathPoint`

## Phase 3 Models
- `IngestionEvent`
- `TelemetryDeadLetter`
- `SiteAnalyticsRollupHourly`
- `TenantAnalyticsRollupHourly`
- `AlertPolicy`
- `AlertPolicyStep`
- `AlertRule`
- `AlertEvent`
- `AlertDelivery`
- `RoleScopeOverride`

## V1 Phase 1 Canonical Envelope Models
- Enums:
  - `MessageType` (`robot_state`, `robot_event`, `task_status`)
  - `Severity` (`info`, `warning`, `major`, `critical`)
  - `Category` (`navigation`, `traffic`, `battery`, `connectivity`, `hardware`, `safety`, `integration`)
- `CanonicalMessage`
  - Stores normalized routing fields + `payload` + `rawEnvelope`.
  - Unique: `(tenantId, messageId)`.
  - Indexed for replay/diagnostics:
    - `(tenantId, siteId, messageType, timestamp)`
    - `(tenantId, sourceId, timestamp)`
- `IngestionEvent.canonicalMessageId`
  - Optional linkage to canonical persisted message.

## Key Indexes (Operational)
- Telemetry query/read-path:
  - `TelemetryPoint(tenantId, robotId, metric, timestamp)`
  - `TelemetryPoint(tenantId, metric, timestamp)`
  - Descending timestamp indexes added in Phase 3 migration SQL.
- Path playback:
  - `RobotPathPoint(tenantId, robotId, timestamp)`
  - `RobotPathPoint(tenantId, floorplanId, timestamp)`
- Audit and ingestion:
  - `IngestionEvent(tenantId, status, createdAt)`
  - `IngestionEvent(tenantId, dedupeKey)` unique
  - `TelemetryDeadLetter(tenantId, createdAt)`

## Rollup Tables
- `SiteAnalyticsRollupHourly`
  - Unique key: `(tenantId, siteId, bucketStart)`
- `TenantAnalyticsRollupHourly`
  - Unique key: `(tenantId, bucketStart)`

Used for cross-site analytics and pipeline freshness reporting.

## Alerting Tables
- Policy/step definitions:
  - `AlertPolicy`
  - `AlertPolicyStep` (unique `(policyId, orderIndex)`)
- Rule definitions:
  - `AlertRule` (indexed by tenant + active + priority and event type)
- Runtime events:
  - `AlertEvent` (indexed by tenant/state/triggeredAt and tenant/incidentId)
  - `AlertDelivery` (indexed by tenant/state/scheduledFor and tenant/alertEventId)

## Timescale SQL in Phase 3 Migration
When Timescale is available:
1. Creates extension if available.
2. Converts `TelemetryPoint` into hypertable on `timestamp`.
3. Creates continuous aggregates:
   - `telemetry_rollup_5m`
   - `telemetry_rollup_1h`
4. Adds aggregate refresh policies.
5. Adds raw retention policy for `TelemetryPoint`.

If Timescale is not available, migration continues with NOTICE-based fallback.

## Seed Data Characteristics
Seed script (`apps/api/prisma/seed.ts`) is idempotent and includes:
- Multi-site data with floorplans/zones.
- Diverse robot status coverage.
- Missions, incidents, RTLS assets/proximity events.
- Integrations + deterministic test run history.
- Saved views/defaults and dashboard configs.
- Rollup and alerting-related fixtures.
- Canonical envelope fixtures for all 3 `message_type` values and an invalid dead-letter scenario.
