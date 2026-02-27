# RobotOps V1 Phase 2 Implementation Plan

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
- Scope source: `documents/Implementation Plan/V1/V1Prompt.json` phase `2` ("read-model first robot state").
- Primary goal: make `RobotLastState` the canonical read path for robot state/pose consumers.
- Locked decisions:
  - offline policy is computed at read time (no sweeper)
  - all robot-state consumers migrate now
  - site settings stored in new `SiteSetting` model

## API and Contract Target
- Add `GET /robots/last_state` with filters: `site_id,status,vendor,tag`.
- Refactor compatibility routes:
  - `GET /robots` sourced from `RobotLastState`.
  - `GET /robots/:id` overlays dynamic state from `RobotLastState`.
- `robots.live` emits from read-model data with offline status computed at emit time.

## Data Model Target
- Add `RobotLastState` keyed by `(tenantId, siteId, robotId)` with indexed filter/query columns.
- Add `SiteSetting` keyed by `(tenantId, siteId)` with defaults:
  - `robotOfflineAfterSeconds = 15`
  - `robotStatePublishPeriodSeconds = 2`
- Backfill `RobotLastState` and site settings via migration + seed updates.

## Execution Waves

### Wave 0 Documentation Setup
| ID | Owner | Task | Depends On | Status |
|---|---|---|---|---|
| V1P2-DOC-001 | Planner | Create `implementation_plan_phase2.md` in V1 folder | - | done |
| V1P2-DOC-002 | Planner | Register Phase 2 planning entry in execution log section | V1P2-DOC-001 | done |

### Wave 1 Contracts and Types
| ID | Owner | Task | Depends On | Status |
|---|---|---|---|---|
| V1P2-CTR-001 | Implementer C | Add `RobotLastStateQuerySchema` and response/shared types | V1P2-DOC-001 | done |
| V1P2-CTR-002 | Implementer C | Add offline computation helper contract and type exports | V1P2-CTR-001 | done |

### Wave 2 Data Model and Migration
| ID | Owner | Task | Depends On | Status |
|---|---|---|---|---|
| V1P2-DAT-001 | Implementer A | Add Prisma `RobotLastState` model + indexes | V1P2-CTR-001 | done |
| V1P2-DAT-002 | Implementer A | Add Prisma `SiteSetting` model + defaults | V1P2-DAT-001 | done |
| V1P2-DAT-003 | Implementer A | Create migration and backfill from `Robot` to `RobotLastState` | V1P2-DAT-002 | done |
| V1P2-DAT-004 | Implementer A | Update seed to include `SiteSetting` and read-model baseline rows | V1P2-DAT-003 | done |

### Wave 3 Ingestion and Backend Read Path
| ID | Owner | Task | Depends On | Status |
|---|---|---|---|---|
| V1P2-API-001 | Implementer A | Upsert `RobotLastState` in `robot_state` ingest handler only | V1P2-DAT-004 | done |
| V1P2-API-002 | Implementer A | Add `GET /robots/last_state` with filters and offline computation | V1P2-API-001 | done |
| V1P2-API-003 | Implementer A | Refactor `GET /robots` to source from read model for compatibility | V1P2-API-002 | done |
| V1P2-API-004 | Implementer A | Refactor `GET /robots/:id` dynamic fields to use read-model overlay | V1P2-API-003 | done |
| V1P2-API-005 | Implementer A | Update analytics/rollup robot-status consumers to read-model data | V1P2-API-003 | done |

### Wave 4 Realtime and Frontend Migration
| ID | Owner | Task | Depends On | Status |
|---|---|---|---|---|
| V1P2-RT-001 | Implementer A | Switch `LiveGateway` robot broadcasts to read-model query + offline compute | V1P2-API-002 | done |
| V1P2-WEB-001 | Implementer B | Migrate `/overview` robots query to `/robots/last_state` | V1P2-API-002 | done |
| V1P2-WEB-002 | Implementer B | Migrate `/fleet` list to `/robots/last_state` and keep detail flow compatible | V1P2-WEB-001 | done |
| V1P2-WEB-003 | Implementer B | Migrate `/facility` robot layer source to `/robots/last_state` | V1P2-WEB-001 | done |
| V1P2-WEB-004 | Implementer B | Migrate `/missions` robot picker and `/teleoperation` robot list to `/robots/last_state` | V1P2-WEB-001 | done |
| V1P2-WEB-005 | Implementer B | Update Developer API explorer examples to include `/robots/last_state` | V1P2-WEB-001 | done |

### Wave 5 Review and Verification
| ID | Owner | Task | Depends On | Status |
|---|---|---|---|---|
| V1P2-RV-001 | Reviewer | Contract review for `/robots/last_state` + `/robots` compatibility behavior | V1P2-API-004 | done |
| V1P2-RV-002 | Reviewer | Data/index review for read-model performance | V1P2-DAT-003 | done |
| V1P2-RV-003 | Reviewer | Consumer migration review across API/live/web | V1P2-WEB-005 | done |
| V1P2-QA-001 | Tester | API tests: filters, offline compute, invalid params | V1P2-RV-001 | done |
| V1P2-QA-002 | Tester | Ingest tests: `robot_state` upserts, other message types do not | V1P2-API-001 | done |
| V1P2-QA-003 | Tester | E2E/API checks for Fleet and Facility read-model sourcing | V1P2-WEB-003 | done |
| V1P2-QA-004 | Tester | Load/perf smoke with indexed filter paths | V1P2-RV-002 | done |

## Acceptance Tests (Phase 2)
1. `/robots/last_state` validates filters and returns tenant-scoped rows.
2. Offline status is computed from `lastSeenAt` and site timeout at read time.
3. `robot_state` updates `RobotLastState`; `robot_event` and `task_status` do not.
4. `robots.live` source is read-model state.
5. Overview/Fleet/Facility/Missions/Teleoperation robot selectors use `/robots/last_state`.
6. Legacy `/robots` remains functional on read-model source.

## Assumptions and Defaults
1. `robotOfflineAfterSeconds` default is `15`.
2. `robotStatePublishPeriodSeconds` default is `2`.
3. Existing route paths remain backward compatible (`/robots` retained).
4. No destructive changes were made to existing `Robot` schema data model.

## Execution Log
- 2026-02-27: Implemented shared query schema/types for `RobotLastState` and site settings contracts.
- 2026-02-27: Added Prisma `RobotLastState` + `SiteSetting` models, indexes, migration, and seed backfill.
- 2026-02-27: Implemented `GET /robots/last_state`; refactored `/robots` and `/robots/:id` read paths to use read model overlays.
- 2026-02-27: Updated `robot_state` ingest handling to upsert `RobotLastState` and preserve non-state message boundaries.
- 2026-02-27: Migrated live robot broadcast and dashboard web consumers to `/robots/last_state`.
- 2026-02-27: Added and ran `scripts/v1-phase2-qa.mjs` (`npm run qa:v1:phase2`) with pass.
