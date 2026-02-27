# Auth, RBAC, and Security

## Authentication Model
- Web authentication: NextAuth credentials provider (`apps/web/lib/auth.ts`).
- Seed users in auth provider:
  - `owner@demo.com` (Owner)
  - `ops@demo.com` (OpsManager)
  - `engineer@demo.com` (Engineer)
- On login, app issues JWT signed with `JWT_SECRET` and stores in session.

JWT/session payload fields:
- `sub`, `email`, `name`, `tenantId`, `role`
- `permissions` (normalized)
- `scope_version` / `scopeVersion` (current: `2`)

## API Guard Enforcement
- `JwtAuthGuard`
  - Requires `Authorization: Bearer <token>`.
  - Verifies token via `JWT_SECRET`.
- `PermissionsGuard`
  - Reads decorators:
    - `@RequirePermissions(...)` (all required)
    - `@RequireAnyPermissions(...)` (any required)
  - Uses shared permission normalization + alias implication logic.
  - Owner role bypasses permission failures.

## Permission Catalog
Defined in `packages/shared/src/rbac.ts`.

Action-level scopes include:
- Robot control: `robots.control.dock`, `robots.control.pause`, `robots.control.resume`, `robots.control.speed_limit`
- Missions: `missions.create`, `missions.update`
- Incidents: `incidents.resolve`, `incidents.ack`
- Telemetry: `telemetry.read`, `telemetry.ingest`
- Analytics: `analytics.read.site`, `analytics.read.cross_site`, `analytics.export`
- Integrations: `integrations.read`, `integrations.manage`, `integrations.test`
- Alerts: `alerts.read`, `alerts.manage`
- RBAC admin: `rbac.read`, `rbac.write`
- Config/admin: `config.read`, `config.write`

Legacy alias compatibility:
- `robots.control` -> all `robots.control.*`
- `missions.write` -> `missions.create` + `missions.update`
- `incidents.write` -> `incidents.resolve`
- `analytics.read` -> `analytics.read.site` + `analytics.read.cross_site` + `analytics.export`
- `integrations.manage` -> also implies `integrations.test`

## Roles
Role defaults are defined centrally (`ROLES` in shared RBAC module):
- `Owner` (`all` scopes)
- `OpsManager`
- `Engineer`
- `Operator`
- `Viewer`

Effective permissions are normalized and alias-expanded before enforcement.

## Tenant-Scoped Role Overrides (Phase 3)
Storage model: `RoleScopeOverride`.

APIs:
- `GET /rbac/roles`
- `PATCH /rbac/roles/:role`

Behavior:
1. Start with base role scopes.
2. Add normalized `allowScopes`.
3. Remove normalized `denyScopes`.
4. Persist override audit record.

## Tenant Isolation Controls
Implemented across services by explicit tenant filters:
- All data reads/writes scope to `tenantId` from JWT/session.
- Ingestion path checks `envelope.tenant_id` equals JWT tenant.
- Ingestion path also validates `site_id` ownership and robot/site consistency.
- Alert event/incident/integration linkage checks are tenant-scoped.
- Saved view ownership rules enforced (`owner`, `Owner`, or `config.write`).

## Audit Logging
Service: `AuditService.log(...)`

Write actions across platform record:
- `action`, `resourceType`, `resourceId`
- actor metadata (`actorType`, `actorId`)
- `diff` payload (Phase 2/3 and V1 canonical updates use `{before, after}` shape widely)

Audit API supports resource/action/actor/time filtering with cursor pagination.
