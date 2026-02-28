# RobotOps V1 Phase 4 Implementation Plan

## Status Legend
- `todo`: ready and not started
- `in_progress`: currently active for the assigned agent
- `review`: implemented and waiting reviewer pass
- `test`: reviewed and waiting tester verification
- `done`: implemented, reviewed, and verified
- `blocked`: cannot proceed due dependency/environment gap

## Agent Protocol
- Planner: one active task max
- Implementer A (Backend/API/Ingestion): one active task max
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

## Scope Summary
- Scope source: `documents/Implementation Plan/V1/V1Prompt.json` phase `4` ("Harden dedupe and ordering rules").
- Goal: prevent duplicate incidents/timeline rows and eliminate robot-state jitter from out-of-order telemetry.
- Outcome:
1. Deterministic per-message-type dedupe and ordering rules are enforced.
2. Per-robot and per-task processing cursors are persisted.
3. `robot_event` duplicates within window do not create duplicate incidents.
4. `task_status` duplicates/out-of-order updates do not duplicate mission timeline transitions.
5. Robot state does not move backward in time in live/read-model-driven UI.

## Locked Decisions
1. `robot_event.dedupe_key` becomes required (strict contract).
2. Message sequence support is additive via payload field `sequence?: int` for all three canonical payload types.
3. Robot-state allowed lateness is fixed at `5s` in this phase.
4. Dedupe windows are fixed: `robot_event=1800s`, `task_status=86400s`.
5. Window comparisons use event logical time (`occurred_at` / `updated_at` fallback to envelope `timestamp`).
6. Mapping from previous phases remains unchanged; this phase is ingestion semantics hardening only.

## Plan Artifact Changes
1. Create `documents/Implementation Plan/V1/implementation_plan_phase4.md` in same board style as V1 phase 1 to 3.
2. Keep `documents/Implementation Plan/V1/implementation_plan_phase1.md`, `phase2.md`, `phase3.md` unchanged.
3. On completion, update:
   - `documents/Technical Documents/phase_completion_log.md`
   - `documents/Technical Documents/backend_api_reference.md`
   - `documents/Technical Documents/data_model_and_storage.md`
   - `documents/Technical Documents/realtime_ingestion_and_alerting.md`
   - `documents/Technical Documents/testing_qa_and_operations.md`
   - `README.md` (add `qa:v1:phase4`)

## Public API, Interface, and Type Changes

### API endpoint changes
| Endpoint | Method | Permission | Change |
|---|---|---|---|
| `/ingest/telemetry` | POST | `telemetry.ingest` | Enforce Phase 4 dedupe/ordering semantics; same path/shape with additive payload sequence fields and stricter `robot_event.dedupe_key` requirement. |
| `robots.live` | WS push | authenticated tenant socket | Robot payloads remain from read model, now guaranteed monotonic by Phase 4 ordering cursor rules. |

### Canonical payload contract updates (additive except one strict field)
1. `robot_state.payload.sequence?: number` (positive int).
2. `robot_event.payload.sequence?: number` (positive int).
3. `task_status.payload.sequence?: number` (positive int).
4. `robot_event.payload.dedupe_key: string` becomes required.

### Shared schemas/types
1. Extend `RobotStatePayloadSchema`, `RobotEventPayloadSchema`, `TaskStatusPayloadSchema` with optional `sequence`.
2. Tighten `RobotEventPayloadSchema` to require `dedupe_key`.
3. Add internal ordering decision types:
   - `RobotStateOrderingDecision`
   - `TaskStatusOrderingDecision`
   - `DedupeWindowDecision`
4. Add shared constants export:
   - `ROBOT_STATE_ALLOWED_LATENESS_SECONDS = 5`
   - `ROBOT_EVENT_DEDUPE_WINDOW_SECONDS = 1800`
   - `TASK_STATUS_DEDUPE_WINDOW_SECONDS = 86400`

## Data Model and Migration Changes

### Prisma additions/changes
1. Extend `RobotLastState` with cursor fields:
   - `lastStateTimestamp DateTime?`
   - `lastStateSequence Int?`
   - `lastStateMessageId String?`
2. Add `TaskLastStatus` read model (one row per task):
   - key: unique `(tenantId, siteId, taskId)`
   - fields: `state`, `percentComplete`, `updatedAtLogical`, `lastSequence`, `lastMessageId`, `message`, timestamps.
3. Add `MessageDedupeWindow` table for semantic dedupe windows:
   - `tenantId`, `siteId`, `messageType`, `entityId`, `dedupeKey`
   - `windowSeconds`, `firstSeenAt`, `expiresAt`, `lastMessageId`
   - unique `(tenantId, siteId, messageType, entityId, dedupeKey)`
   - index `(tenantId, expiresAt)` for cleanup.
4. Optional enum for `messageType` reuse existing `MessageType` (`robot_event`, `task_status`) in dedupe table validation.

### Migration/backfill
1. Create migration for new table plus new columns plus indexes.
2. Backfill `RobotLastState.lastStateTimestamp = lastSeenAt` for existing rows.
3. Backfill `TaskLastStatus` from latest `MissionEvent(type=state_change)` per task where available.
4. Seed updates:
   - canonical fixtures with `sequence`
   - `robot_event` fixtures with required `dedupe_key`
   - duplicate and out-of-order fixtures for QA paths.

## Processing Rules (Decision-Complete)

### `robot_state`
1. Parse `candidateTs = envelope.timestamp`; `candidateSeq = payload.sequence ?? null`.
2. Load cursor from `RobotLastState` (`lastStateTimestamp`, `lastStateSequence`).
3. Drop if `candidateTs < lastStateTimestamp - 5s`.
4. If both sequences exist:
   - drop when `candidateSeq < lastStateSequence`
   - drop when `candidateSeq == lastStateSequence && candidateTs <= lastStateTimestamp`
   - otherwise accept.
5. If sequence comparison unavailable:
   - accept only when `candidateTs >= lastStateTimestamp` (after lateness gate).
6. On accept:
   - update `Robot` and `RobotLastState`
   - cursor fields updated to accepted event
   - `lastSeenAt` in read model remains monotonic (never decreases).

### `robot_event`
1. Require `dedupe_key` at validation.
2. Compute event time `eventTs = payload.occurred_at ?? envelope.timestamp`.
3. Dedupe lookup key: `(tenantId, siteId, robotId, dedupe_key)` in `MessageDedupeWindow` with `messageType=robot_event`.
4. If entry exists and `eventTs <= expiresAt`, treat as semantic duplicate:
   - skip incident/timeline create
   - mark ingestion event processed (not failed), emit audit drop reason.
5. Otherwise create/refresh dedupe entry with `expiresAt = eventTs + 1800s`, then persist incident flow.
6. `message_id` idempotency remains enforced independently.

### `task_status`
1. Compute `logicalUpdatedAt = payload.updated_at ?? envelope.timestamp`; `candidateSeq = payload.sequence ?? null`.
2. Semantic dedupe key: `${task_id}:${state}:${logicalUpdatedAt}` with window `86400s` via `MessageDedupeWindow` (`messageType=task_status`, `entityId=task_id`).
3. Drop duplicate when key exists within active window.
4. Ordering cursor from `TaskLastStatus`:
   - drop if `logicalUpdatedAt < cursor.updatedAtLogical`
   - if equal timestamp: accept only when both seq present and `candidateSeq > cursor.lastSequence`
   - if greater timestamp: accept.
5. On accept:
   - append mission timeline event (`MissionEvent`) only once
   - update `Mission` state and duration as today
   - upsert `TaskLastStatus` cursor/read model.

### Operational cleanup
1. Add periodic cleanup for expired `MessageDedupeWindow` entries in ingestion tick loop.
2. Deduped/out-of-order drops produce structured audit entries (`before:null`, `after:{reason,...}`), not dead letters.

## Execution Waves

### Wave 0 Documentation Setup
| ID | Owner | Task | Depends On | Status |
|---|---|---|---|---|
| V1P4-DOC-001 | Planner | Create `implementation_plan_phase4.md` in V1 folder | - | done |
| V1P4-DOC-002 | Planner | Register Phase 4 planning entry in execution log section | V1P4-DOC-001 | done |

### Wave 1 Contracts and Core Logic
| ID | Owner | Task | Depends On | Status |
|---|---|---|---|---|
| V1P4-CTR-001 | Implementer C | Extend canonical payload schemas with optional `sequence` | V1P4-DOC-001 | done |
| V1P4-CTR-002 | Implementer C | Make `robot_event.dedupe_key` required and update shared types | V1P4-CTR-001 | done |
| V1P4-CTR-003 | Implementer C | Add deterministic ordering/dedupe helper utilities and constants | V1P4-CTR-001 | done |

### Wave 2 Data Model and Migration
| ID | Owner | Task | Depends On | Status |
|---|---|---|---|---|
| V1P4-DAT-001 | Implementer A | Add `TaskLastStatus` plus `MessageDedupeWindow` models | V1P4-CTR-003 | done |
| V1P4-DAT-002 | Implementer A | Extend `RobotLastState` with cursor columns | V1P4-DAT-001 | done |
| V1P4-DAT-003 | Implementer A | Create migration with indexes and backfill SQL | V1P4-DAT-002 | done |
| V1P4-DAT-004 | Implementer A | Update seed fixtures for sequence and duplicate/out-of-order cases | V1P4-DAT-003 | done |

### Wave 3 Backend Ingest Behavior Hardening
| ID | Owner | Task | Depends On | Status |
|---|---|---|---|---|
| V1P4-API-001 | Implementer A | Enforce new ingest contract checks (`dedupe_key`, sequence parsing) | V1P4-CTR-002 | done |
| V1P4-API-002 | Implementer A | Implement robot_state ordering plus allowed lateness drop plus cursor update | V1P4-DAT-003 | done |
| V1P4-API-003 | Implementer A | Implement robot_event dedupe window gate before incident creation | V1P4-DAT-003 | done |
| V1P4-API-004 | Implementer A | Implement task_status dedupe plus ordering with `TaskLastStatus` read model | V1P4-DAT-003 | done |
| V1P4-API-005 | Implementer A | Add dedupe-window expiry cleanup and structured audit drops | V1P4-API-003 | done |
| V1P4-API-006 | Implementer A | Ensure read-model and live payloads are monotonic (no backward time) | V1P4-API-002 | done |

### Wave 4 Frontend and Developer Surface Alignment
| ID | Owner | Task | Depends On | Status |
|---|---|---|---|---|
| V1P4-WEB-001 | Implementer B | Update Developer API explorer examples for `sequence` and required `dedupe_key` | V1P4-API-001 | done |
| V1P4-WEB-002 | Implementer B | Validate Fleet and Facility and Mission timeline behavior against hardened backend semantics | V1P4-API-006 | done |

### Wave 5 Review and Verification
| ID | Owner | Task | Depends On | Status |
|---|---|---|---|---|
| V1P4-RV-001 | Reviewer | Contract review for canonical payload changes and backward compatibility | V1P4-API-001 | done |
| V1P4-RV-002 | Reviewer | Data/index review for dedupe lookup and cursor writes under load | V1P4-DAT-003 | done |
| V1P4-RV-003 | Reviewer | Behavior review for no-duplicate incidents/timelines and robot monotonicity | V1P4-API-006 | done |
| V1P4-QA-001 | Tester | Unit tests for ordering decisions and window dedupe edge cases | V1P4-CTR-003 | done |
| V1P4-QA-002 | Tester | API tests for ingest rejects, dedupe_key enforcement, idempotency | V1P4-RV-001 | done |
| V1P4-QA-003 | Tester | Ingest flow tests for robot_event and task_status duplicate suppression | V1P4-API-004 | done |
| V1P4-QA-004 | Tester | E2E checks for Fleet and Facility and Incidents and Missions no-jitter/no-dup outcomes | V1P4-WEB-002 | done |
| V1P4-QA-005 | Tester | Add `scripts/v1-phase4-qa.mjs`, wire `qa:v1:phase4`, run type and build and qa gates | V1P4-QA-004 | done |

## Test Cases and Scenarios

### Backend and contract tests
1. `robot_event` without `dedupe_key` is rejected at ingest validation.
2. `sequence` accepts positive ints and rejects invalid values.
3. Duplicate `message_id` remains idempotent for all message types.
4. `robot_state` older than `lastStateTimestamp - 5s` is dropped and does not mutate read model.
5. `robot_state` same timestamp with lower/equal sequence is dropped; higher sequence is accepted.
6. `robot_event` duplicate `dedupe_key` within 1800s does not create a second incident/timeline entry.
7. `robot_event` same key after window expiry is accepted again.
8. `task_status` duplicate `(task_id,state,updated_at)` within 86400s does not create duplicate mission events.
9. `task_status` out-of-order `updated_at` is dropped even with new message_id.
10. `TaskLastStatus` cursor/read model updates only on accepted task events.
11. Tenant/site isolation is preserved for dedupe and cursor reads/writes.
12. Dropped dedupe/ordering events are processed (not failed/dead-lettered) and audited with reason.

### Frontend and E2E scenarios
1. Replayed duplicate `robot_event` stream shows exactly one incident in list/detail timeline.
2. Out-of-order `robot_state` replay does not cause Facility and Fleet robot time regression.
3. Mission timeline does not show repeated identical state transitions under duplicate replay.
4. Live updates remain stable with high-frequency mixed in-order/out-of-order messages.

### Performance and reliability checks
1. Dedupe lookup remains indexed and low-latency under burst ingest.
2. Cursor writes do not create lock contention under expected single-node local processing.
3. Cleanup process removes expired dedupe rows without blocking ingest path.

## Assumptions and Defaults
1. Plan artifact path is `documents/Implementation Plan/V1/implementation_plan_phase4.md`.
2. `sequence` is optional and producer-provided; absence falls back to timestamp-only behavior.
3. Allowed lateness for `robot_state` is fixed at `5s` in Phase 4.
4. Dedupe window times are fixed (`1800s`, `86400s`) and not user-configurable in this phase.
5. Existing endpoint paths remain unchanged; changes are additive and validation-tightening.
6. Existing Socket.IO channel names remain unchanged.
7. No MQTT changes are included.
8. Existing canonical schema version remains `1`; Phase 4 changes are additive within that version.
9. System continues to run with local single consumer tick model (no multi-writer distributed locking changes in this phase).

## Execution Log
- 2026-02-28: V1 Phase 4 plan drafted from `V1Prompt.json` and aligned to current V1 phase 1 to 3 implementation state.
- 2026-02-28: Locked decisions set for sequence field placement, strict robot-event dedupe_key, and fixed lateness/window constants.
- 2026-02-28: Implemented schema/migration updates (`TaskLastStatus`, `MessageDedupeWindow`, `RobotLastState` cursor fields) and ingest ordering/dedupe enforcement in `Phase3Service`.
- 2026-02-28: Added `scripts/v1-phase4-qa.mjs` and root script `qa:v1:phase4`.
- 2026-02-28: Verification passed: `typecheck`, `build`, `qa:v1:phase1`, `qa:v1:phase2`, `qa:v1:phase3`, `qa:v1:phase4`.
