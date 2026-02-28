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
- `20260227220000_v1_phase2_robot_last_state`
  - Read-model tables: `RobotLastState`, `SiteSetting` with backfill from `Robot`.
- `20260227233000_v1_phase3_vendor_site_map`
  - Adds `VendorSiteMap` model for vendor-to-floorplan mapping and transform parameters.
  - Adds partial unique indexes for nullable vendor map keys (`vendorMapId`, `vendorMapName`).
- `20260228170000_v1_phase4_dedupe_ordering`
  - Extends `RobotLastState` with ordering cursor columns (`lastStateTimestamp`, `lastStateSequence`, `lastStateMessageId`).
  - Adds `TaskLastStatus` read-model cursor table.
  - Adds `MessageDedupeWindow` semantic dedupe-window table for `robot_event`/`task_status`.
  - Includes backfill SQL for `RobotLastState.lastStateTimestamp` and `TaskLastStatus` from latest mission state-change events.

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

## V1 Phase 2 Read-Model Models
- `RobotLastState`
  - Composite primary key: `(tenantId, siteId, robotId)`.
  - Contains last reported robot pose/state/task/health fields for read-time fanout.
  - Indexed for filtering and freshness:
    - `(tenantId, siteId, status)`
    - `(tenantId, siteId, vendor)`
    - `(tenantId, siteId, floorplanId)`
    - `(tenantId, siteId, updatedAt)`
- `SiteSetting`
  - Composite primary key: `(tenantId, siteId)`.
  - Defaults:
    - `robotOfflineAfterSeconds = 15`
    - `robotStatePublishPeriodSeconds = 2`
  - Used for offline-status computation and robot broadcast cadence defaults.

## V1 Phase 3 Mapping Model
- `VendorSiteMap`
  - Source of truth for vendor map bindings and transform params.
  - Key fields:
    - `tenantId`, `siteId`, `vendor`
    - `vendorMapId` (nullable)
    - `vendorMapName` (nullable)
    - `robotopsFloorplanId`
    - `scale`, `rotationDegrees`, `translateX`, `translateY`
    - `createdBy`, `updatedBy`, timestamps
  - Validation invariants in API/service layer:
    - at least one of `vendorMapId` or `vendorMapName`
    - `scale > 0`
    - `robotopsFloorplanId` belongs to same tenant/site
    - vendor normalized to lower-case for case-insensitive matching

## V1 Phase 4 Dedupe and Ordering Models
- `RobotLastState` additions:
  - `lastStateTimestamp` (accepted robot_state cursor timestamp)
  - `lastStateSequence` (optional sequence cursor)
  - `lastStateMessageId` (last accepted message id)
- `TaskLastStatus`:
  - Composite key `(tenantId, siteId, taskId)`
  - Stores latest accepted task status cursor/state fields:
    - `state`, `percentComplete`, `updatedAtLogical`
    - `lastSequence`, `lastMessageId`, `message`
- `MessageDedupeWindow`:
  - Unique key `(tenantId, siteId, messageType, entityId, dedupeKey)`
  - Stores semantic dedupe TTL materialization:
    - `windowSeconds`, `firstSeenAt`, `expiresAt`, `lastMessageId`

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
- Phase 4 dedupe/order indexes:
  - `TaskLastStatus(tenantId, siteId, updatedAtLogical)`
  - `TaskLastStatus(tenantId, taskId)`
  - `MessageDedupeWindow(tenantId, expiresAt)`
  - `MessageDedupeWindow(tenantId, siteId, messageType, entityId)`
  - `MessageDedupeWindow` unique `(tenantId, siteId, messageType, entityId, dedupeKey)`
- Vendor map lookups:
  - `VendorSiteMap(tenantId, siteId, vendor, vendorMapId)`
  - `VendorSiteMap(tenantId, siteId, vendor, vendorMapName)`
  - Partial unique index on `(tenantId, siteId, vendor, vendorMapId)` where `vendorMapId IS NOT NULL`
  - Partial unique index on `(tenantId, siteId, vendor, vendorMapName)` where `vendorMapName IS NOT NULL`

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
- V1 read-model fixtures: per-site `SiteSetting` defaults and seeded `RobotLastState` rows.
- V1 Phase 3 fixtures:
  - representative `VendorSiteMap` rows for seeded sites/floorplans
  - canonical `robot_state` examples for map-id and map-name routing
  - negative unmapped transform fixture with failed ingestion + dead-letter
- V1 Phase 4 fixtures:
  - canonical envelopes include `sequence` support for all message types
  - canonical `robot_event` fixture includes required `dedupe_key`
  - seeded `TaskLastStatus` baseline rows from mission state timeline
  - seeded `MessageDedupeWindow` samples for robot-event and task-status windows
