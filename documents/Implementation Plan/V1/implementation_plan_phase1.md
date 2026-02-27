# RobotOps V1 Phase 1 Implementation Plan

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
- Scope source: `documents/Implementation Plan/V1/V1Prompt.json` phase `1` ("Lock canonical envelope into three message types").
- Primary goal: formalize ingestion into strict canonical envelope types:
  - `robot_state`
  - `robot_event`
  - `task_status`
- Constraints:
  - no MQTT in this phase
  - clean-room implementation
  - no breaking changes without migrations

## API and Contract Target
- Endpoint: `POST /ingest/telemetry`
- Canonical required envelope fields:
  - `message_id`, `schema_version`, `tenant_id`, `site_id`, `message_type`, `timestamp`, `source`, `entity`, `payload`
- Routing rule:
  - `message_type` drives validation + consumer handling path.
- Compatibility rule:
  - strict schema validation with explicit `schema_version` acceptance/rejection logic.

## Data Model Target
- Add `canonical_message` persistence for validated raw envelopes (or references if offloaded later).
- Add enums used by canonical processing:
  - `message_type`
  - `severity`
  - `category`
- Add indexes for tenant/site/time/message_type retrieval and replay diagnostics.

## Execution Waves

### Wave 0 Documentation Setup
| ID | Owner | Task | Depends On | Status |
|---|---|---|---|---|
| V1P1-DOC-001 | Planner | Create Phase 1 board file under `documents/Implementation Plan/V1/` | - | done |

### Wave 1 Shared Contracts and Validation
| ID | Owner | Task | Depends On | Status |
|---|---|---|---|---|
| V1P1-CTR-001 | Implementer C | Add canonical envelope schema with `message_type` and `schema_version` | V1P1-DOC-001 | done |
| V1P1-CTR-002 | Implementer C | Define strict payload schemas for `robot_state`, `robot_event`, `task_status` | V1P1-CTR-001 | done |
| V1P1-CTR-003 | Implementer C | Add compatibility guardrail function for accepted schema versions | V1P1-CTR-001 | done |
| V1P1-CTR-004 | Implementer C | Export shared TS types for ingest endpoint, queue payload, and consumer routing | V1P1-CTR-002 | done |

### Wave 2 Database and Migration
| ID | Owner | Task | Depends On | Status |
|---|---|---|---|---|
| V1P1-DAT-001 | Implementer A | Add Prisma enums: `MessageType`, `Severity`, `Category` | V1P1-CTR-004 | done |
| V1P1-DAT-002 | Implementer A | Add `CanonicalMessage` model for validated envelope storage | V1P1-DAT-001 | done |
| V1P1-DAT-003 | Implementer A | Create migration with indexes for tenant/site/message_type/timestamp | V1P1-DAT-002 | done |
| V1P1-DAT-004 | Implementer A | Seed representative canonical messages for all 3 message types | V1P1-DAT-003 | done |

### Wave 3 Ingest API and Queue Routing
| ID | Owner | Task | Depends On | Status |
|---|---|---|---|---|
| V1P1-API-001 | Implementer A | Update `POST /ingest/telemetry` to accept canonical envelope contract | V1P1-CTR-004, V1P1-DAT-002 | done |
| V1P1-API-002 | Implementer A | Enforce strict `message_type` routing and payload validation | V1P1-API-001 | done |
| V1P1-API-003 | Implementer A | Reject unknown/unsupported schema versions with deterministic error payloads | V1P1-API-001 | done |
| V1P1-API-004 | Implementer A | Persist validated envelope to `canonical_message` before publish/processing | V1P1-API-001 | done |
| V1P1-API-005 | Implementer A | Split old event-array behavior: only `robot_event` can carry event semantics | V1P1-API-002 | done |

### Wave 4 Consumer Behavior and Domain Effects
| ID | Owner | Task | Depends On | Status |
|---|---|---|---|---|
| V1P1-CNS-001 | Implementer A | Route consumer handlers by `message_type` (`robot_state`, `robot_event`, `task_status`) | V1P1-API-002 | done |
| V1P1-CNS-002 | Implementer A | Ensure `robot_state` path updates state only and does not emit incidents directly | V1P1-CNS-001 | done |
| V1P1-CNS-003 | Implementer A | Ensure `robot_event` path handles incident/event append semantics | V1P1-CNS-001 | done |
| V1P1-CNS-004 | Implementer A | Ensure `task_status` path updates task-status persistence path only | V1P1-CNS-001 | done |

### Wave 5 Review and Verification
| ID | Owner | Task | Depends On | Status |
|---|---|---|---|---|
| V1P1-RV-001 | Reviewer | Contract review: strict schema enforcement + version checks | V1P1-API-005 | done |
| V1P1-RV-002 | Reviewer | Data review: canonical message persistence and indexes | V1P1-DAT-004 | done |
| V1P1-RV-003 | Reviewer | Behavior review: routing and separation of state vs event effects | V1P1-CNS-004 | done |
| V1P1-QA-001 | Tester | Add API tests for invalid `message_type` and invalid payloads | V1P1-RV-001 | done |
| V1P1-QA-002 | Tester | Add consumer routing tests for all 3 message types | V1P1-RV-003 | done |
| V1P1-QA-003 | Tester | Add regression tests proving `robot_state` does not create incidents | V1P1-QA-002 | done |
| V1P1-QA-004 | Tester | Add version-compatibility tests for accepted/rejected schema versions | V1P1-QA-001 | done |

## Acceptance Tests (Phase 1)
1. Ingest rejects unknown `message_type`.
2. Ingest rejects payloads that do not match the selected `message_type` schema.
3. Consumer routes valid messages correctly by `message_type`.
4. `robot_state` updates do not create incidents unless a separate `robot_event` is emitted.

## Assumptions and Defaults
1. In this phase, existing endpoint path remains `POST /ingest/telemetry` and contract changes are additive/migrated safely.
2. `schema_version` accepted set initially contains only `1`.
3. Ingestion remains HTTPS + internal queue abstraction (no MQTT changes in Phase 1).
4. Existing UI live updates remain Socket.io and are out of scope for structural changes in this phase.

## Execution Log
- 2026-02-27: Phase 1 plan initialized from `documents/Implementation Plan/V1/V1Prompt.json`.
- 2026-02-27: Scope, waves, and acceptance criteria aligned to canonical envelope hardening goals.
- 2026-02-27: Implemented canonical envelope schemas and strict message_type payload validation in `packages/shared`.
- 2026-02-27: Added Prisma enums/model/indexes and migration for `CanonicalMessage` plus `IngestionEvent` linkage.
- 2026-02-27: Refactored `POST /ingest/telemetry` and consumer processing to deterministic routing by `message_type`.
- 2026-02-27: Implemented `robot_state` (state update), `robot_event` (incident path), and `task_status` (mission status path) handlers.
- 2026-02-27: Added and executed `scripts/v1-phase1-qa.mjs` (`npm run qa:v1:phase1`) with all checks passing.
- 2026-02-27: Re-ran regression checks (`typecheck`, `build`, `qa:phase3`) and confirmed pass.
