# RobotOps V1 Phase 6 Implementation Plan

## Summary
Scope source: `documents/Implementation Plan/V1/V1Prompt.json` Phase 6 (`Optimize Socket.io live updates using diffs and cursors`).

Goal:
1. Replace full-array live broadcasts with cursor-based delta streams.
2. Keep rollout safe with dual mode (`delta` + temporary legacy compatibility).
3. Reduce live bandwidth and server query load while preserving tenant/RBAC isolation.

Locked decisions:
1. Rollout mode: `dual`.
2. Cursor format: opaque base64url cursor (`v=1`, timestamp + id sort keys).

Expected outcome:
1. Clients subscribe with stream cursors and receive upserts/deletes.
2. Overview/Fleet/Facility/Missions/Incidents reconcile from deltas.
3. Incident and mission updates become event-driven.
4. Live delivery metrics are available in `/system/pipeline-status`.

## Status Legend
- `todo`: ready and not started
- `in_progress`: currently active for the assigned agent
- `review`: implemented and waiting reviewer pass
- `test`: reviewed and waiting tester verification
- `done`: implemented, reviewed, and verified
- `blocked`: cannot proceed due dependency/environment gap

## Agent Protocol
- Planner: one active task max
- Implementer A (Backend/API/Realtime): one active task max
- Implementer B (Frontend/UI): one active task max
- Implementer C (Contracts/Platform/DB): one active task max
- Reviewer: one active task max
- Tester: one active task max

## Current Active Tasks
- Planner: no active task
- Implementer A: no active task
- Implementer B: no active task
- Implementer C: no active task
- Reviewer: no active task
- Tester: no active task

## Plan Artifact Changes
1. Create `documents/Implementation Plan/V1/implementation_plan_phase6.md` in V1 folder.
2. Keep phase 1 through phase 5 plan docs unchanged.
3. On completion update:
   - `README.md`
   - `documents/Technical Documents/phase_completion_log.md`
   - `documents/Technical Documents/backend_api_reference.md`
   - `documents/Technical Documents/realtime_ingestion_and_alerting.md`
   - `documents/Technical Documents/frontend_architecture.md`
   - `documents/Technical Documents/testing_qa_and_operations.md`

## Public APIs, Interfaces, and Type Changes
1. New socket events:
   - `subscribe`
   - `delta`
   - `subscribed`
   - `subscribe.error`
2. Legacy socket compatibility event remains accepted during dual mode:
   - `live.subscribe`
3. Extend `GET /system/pipeline-status` with:
   - live mode
   - connected/subscribed clients
   - delta/legacy message and byte counters
   - last flush timestamp
4. Add shared schema/type contracts:
   - `LiveStreamName`
   - `LiveSubscribeSchema`
   - `LiveDeltaEnvelopeSchema`
   - cursor encode/decode/compare helpers (`LiveCursorV1`)
   - client reconciliation helpers

## Data Model and Migration Changes
1. Add `updatedAt DateTime @updatedAt` to `Mission`.
2. Add `updatedAt DateTime @updatedAt` to `Incident`.
3. Add indexes:
   - `Mission(tenantId, siteId, updatedAt, id)`
   - `Incident(tenantId, siteId, updatedAt, id)`
4. Migration backfill:
   - initialize both `updatedAt` columns from `createdAt`.

## Processing Rules
1. `subscribe` validates tenant/site scope and stream permissions.
2. Initial subscribe sends catch-up/snapshot delta batches (batch size `250`).
3. Cursors are opaque base64url JSON `{"v":1,"t":"<iso>","id":"<id>"}`.
4. Coalescing windows:
   - `robot_last_state`: `250ms`
   - `incidents`: `500ms`
   - `missions`: `500ms`
5. Dual mode behavior:
   - delta protocol is primary
   - legacy full-array broadcasts are sent only to legacy subscribers
   - `LIVE_UPDATES_MODE=delta_only` disables legacy full-array broadcasts
6. Producer emission points:
   - robot state ingest accepted path -> `robot_last_state` upsert
   - incident create/ack/resolve -> `incidents` upsert
   - mission create/task-status update -> `missions` upsert

## Execution Waves

### Wave 0 Documentation Setup
| ID | Owner | Task | Depends On | Status |
|---|---|---|---|---|
| V1P6-DOC-001 | Planner | Create `implementation_plan_phase6.md` in V1 folder | - | done |
| V1P6-DOC-002 | Planner | Add Phase 6 planning entry to execution log section | V1P6-DOC-001 | done |

### Wave 1 Contracts and Realtime Core
| ID | Owner | Task | Depends On | Status |
|---|---|---|---|---|
| V1P6-CTR-001 | Implementer C | Add shared socket schemas/types for subscribe/delta/cursors | V1P6-DOC-001 | done |
| V1P6-CTR-002 | Implementer C | Implement cursor encode/decode/compare helpers | V1P6-CTR-001 | done |
| V1P6-CTR-003 | Implementer C | Add reusable client/server reconcile helper contracts | V1P6-CTR-001 | done |

### Wave 2 Data Model for Cursor Correctness
| ID | Owner | Task | Depends On | Status |
|---|---|---|---|---|
| V1P6-DAT-001 | Implementer A | Add `updatedAt` fields to `Mission` and `Incident` | V1P6-CTR-002 | done |
| V1P6-DAT-002 | Implementer A | Create migration with backfill and indexes | V1P6-DAT-001 | done |
| V1P6-DAT-003 | Implementer A | Update seed/runtime expectations for new non-null fields | V1P6-DAT-002 | done |

### Wave 3 Backend Realtime Protocol and Emission
| ID | Owner | Task | Depends On | Status |
|---|---|---|---|---|
| V1P6-API-001 | Implementer A | Refactor gateway for subscribe/subscribed/subscribe.error and keep live.subscribe compatibility | V1P6-CTR-001 | done |
| V1P6-API-002 | Implementer A | Add cursor catch-up query and snapshot batching | V1P6-DAT-002 | done |
| V1P6-API-003 | Implementer A | Add coalescing buffers and scheduled flush for deltas | V1P6-API-002 | done |
| V1P6-API-004 | Implementer A | Wire robot/incident/mission producer emission points to delta buffers | V1P6-API-003 | done |
| V1P6-API-005 | Implementer A | Restrict legacy full-array broadcasts to legacy subscribers in dual mode | V1P6-API-001 | done |
| V1P6-API-006 | Implementer A | Extend `/system/pipeline-status` with live transport metrics | V1P6-API-003 | done |

### Wave 4 Frontend Migration to Delta Reconciliation
| ID | Owner | Task | Depends On | Status |
|---|---|---|---|---|
| V1P6-WEB-001 | Implementer B | Update `useLiveSocket` to send subscribe payload with site/streams/cursors | V1P6-API-001 | done |
| V1P6-WEB-002 | Implementer B | Add reusable live delta reconciliation helper | V1P6-CTR-003 | done |
| V1P6-WEB-003 | Implementer B | Migrate Overview robots/incidents to delta reconciliation | V1P6-WEB-002 | done |
| V1P6-WEB-004 | Implementer B | Migrate Fleet robots to delta reconciliation | V1P6-WEB-002 | done |
| V1P6-WEB-005 | Implementer B | Migrate Facility robot layer to delta reconciliation | V1P6-WEB-002 | done |
| V1P6-WEB-006 | Implementer B | Migrate Missions and Incidents lists to delta reconciliation | V1P6-WEB-002 | done |
| V1P6-WEB-007 | Implementer B | Update Developer stream tester to delta protocol and cursors | V1P6-WEB-001 | done |

### Wave 5 Review and Verification
| ID | Owner | Task | Depends On | Status |
|---|---|---|---|---|
| V1P6-RV-001 | Reviewer | Protocol review (auth, tenant/site guards, cursor semantics, compatibility) | V1P6-API-005 | done |
| V1P6-RV-002 | Reviewer | Data/index review for catch-up query performance | V1P6-DAT-002 | done |
| V1P6-RV-003 | Reviewer | Frontend reconciliation review across migrated pages | V1P6-WEB-007 | done |
| V1P6-QA-001 | Tester | Unit tests for cursor parse/compare and reconcile helpers | V1P6-CTR-003 | done |
| V1P6-QA-002 | Tester | Socket integration tests for subscribe/catch-up/delta/coalescing | V1P6-API-003 | done |
| V1P6-QA-003 | Tester | Add `scripts/v1-phase6-qa.mjs` for live-update behavior and regressions | V1P6-WEB-007 | done |
| V1P6-QA-004 | Tester | Add `qa:v1:phase6` and run type/build/qa gates | V1P6-QA-003 | done |

## Test Cases and Scenarios
1. `subscribe` rejects tenant mismatch.
2. `subscribe` rejects unauthorized streams.
3. `subscribe` rejects invalid cursor format.
4. Snapshot on empty cursor returns valid batch envelope.
5. Catch-up with valid cursor returns only records after cursor.
6. Coalescer collapses rapid updates per id within stream window.
7. Incident ack/resolve emits incident stream upserts.
8. Mission task-status updates emit mission stream upserts.
9. Legacy `live.subscribe` still receives legacy messages in dual mode.
10. `delta_only` mode suppresses legacy full-array broadcasts.
11. Reconnect with latest cursor avoids replaying already-applied delta.

## Assumptions and Defaults
1. Default rollout mode is `LIVE_UPDATES_MODE=dual`.
2. Cursor format is opaque and versioned (`v=1`).
3. Snapshot batch size default is `250`.
4. Coalescing windows default to `250ms`/`500ms` as defined above.
5. Deletes are supported by envelope shape but expected to be rare in this phase.
6. Existing REST endpoints remain backward compatible.
7. Completion includes `qa:v1:phase6` plus regression gates.

## Execution Log
- 2026-03-01: Phase 6 plan drafted from V1 prompt and aligned to existing V0/V1 codebase.
- 2026-03-01: Locked defaults selected for dual-mode rollout and opaque cursor protocol.
- 2026-03-01: Reviewer pass completed for protocol guards, cursor semantics, and frontend reconciliation behavior.
- 2026-03-01: Tester pass completed via `npm run typecheck`, `npm run build`, `npm run qa:phase1`, `npm run qa:phase2`, `npm run qa:phase3`, `npm run qa:v1:phase1`, `npm run qa:v1:phase2`, `npm run qa:v1:phase3`, `npm run qa:v1:phase4`, `npm run qa:v1:phase5`, `npm run qa:v1:phase6`.
