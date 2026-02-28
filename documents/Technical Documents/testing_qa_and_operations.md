# Testing, QA, and Operations

## Local Setup Runbook
1. Copy env templates:
   - `cp .env.example .env`
   - `cp apps/api/.env.example apps/api/.env`
   - `cp apps/web/.env.example apps/web/.env.local`
2. Start dependencies:
   - `docker compose up -d`
3. Install deps:
   - `npm install`
4. Prisma setup:
   - `npm --workspace @robotops/api run prisma:generate`
   - `npm --workspace @robotops/api run prisma:migrate`
   - `npm --workspace @robotops/api run prisma:seed`
5. Run apps:
   - `npm run dev`

## Build and Type Gates
- `npm run typecheck`
- `npm run build`

## Phase QA Commands
- `npm run qa:v1:phase1`
  - Canonical envelope ingest validation, schema/version rejections, routing and side effects.
- `npm run qa:v1:phase2`
  - Read-model endpoint filtering/offline checks, robot_state upsert checks, and non-state message immutability checks.
- `npm run qa:v1:phase3`
  - Vendor map CRUD + preview checks, ingest transform resolution/fallback/dead-letter behavior, and transform-miss audit checks.
- `npm run qa:v1:phase4`
  - Dedupe window and ordering checks (`robot_event`/`task_status` duplicate suppression, `robot_state` monotonic ordering, sequence validation, and dropped-event audit/dead-letter behavior).
- `npm run qa:phase1`
  - Core dashboard smoke (overview/fleet/facility + a11y smoke subset).
- `npm run qa:phase2`
  - Saved views, telemetry downsampling UI, path playback, integrations, developer/settings/analytics/incidents flows.
- `npm run qa:phase3`
  - Cross-site analytics mode, RBAC/settings alert workflows, incidents escalation panel, pipeline status, a11y smoke.

## QA Script Locations
- `scripts/v1-phase1-qa.mjs`
- `scripts/v1-phase2-qa.mjs`
- `scripts/v1-phase3-qa.mjs`
- `scripts/v1-phase4-qa.mjs`
- `scripts/phase1-qa.mjs`
- `scripts/phase2-qa.mjs`
- `scripts/phase3-qa.mjs`

## Deterministic Test Behavior Notes
- Integration tests are deterministic stubs (no outbound network calls).
- Alert delivery is deterministic stubbed scheduler behavior.
- NATS service currently uses in-memory publish/pull queue abstraction plus connectivity probing.

## Operational Endpoints for Health/Debug
- Health: `GET /api/health`
- Pipeline status: `GET /api/system/pipeline-status`
- Audit explorer data: `GET /api/audit`
- Live channel connectivity: Socket.IO on API host

## Troubleshooting
- API fails auth:
  - Verify `JWT_SECRET` consistency between web and API env.
- Ingestion accepted but not reflected:
  - Check `/api/system/pipeline-status` ingestion counters.
  - Check `TelemetryDeadLetter` records for failures.
- Cross-site analytics empty:
  - Trigger or wait for rollup refresh tick.
  - Verify site rollup rows exist for selected time window.
- Alerts not escalating:
  - Verify active policy and rule linkage.
  - Check `AlertDelivery` records for scheduled state and timestamps.

## Phase Completion Checklist (Mandatory)
When closing any phase:
1. Run applicable gates: `typecheck`, `build`, and relevant `qa:*` scripts.
2. Update technical docs in `documents/Technical Documents`.
3. Add completion entry to [phase_completion_log.md](./phase_completion_log.md).
4. Confirm README and plan docs point to latest phase state.
