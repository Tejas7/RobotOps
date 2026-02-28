# RobotOps V1 Phase 3 Implementation Plan

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
- Scope source: `documents/Implementation Plan/V1/V1Prompt.json` phase `3` (vendor map mapping and deterministic coordinate transforms).
- Primary goal: guarantee robot live pose in RobotOps floorplan space by mapping vendor map references to floorplan transforms during ingest.
- Locked decisions:
  - mapping miss uses compatibility fallback (valid RobotOps floorplan passthrough only)
  - mapping updates are forward-only (no historical backfill)
  - settings includes full visual transform editor
  - rotation pivot fixed at origin `(0,0)`

## API and Contract Target
- Add vendor map management endpoints:
  - `GET /vendor-site-maps`
  - `POST /vendor-site-maps`
  - `PATCH /vendor-site-maps/:id`
  - `DELETE /vendor-site-maps/:id`
  - `POST /vendor-site-maps/preview`
- Extend canonical `robot_state.payload.pose` with optional:
  - `vendor_map_id`
  - `vendor_map_name`
- Extend ingest `robot_state` processing:
  - resolve vendor mapping in order: `vendor_map_id` -> `vendor_map_name` -> fallback
  - transform order fixed: scale -> rotation -> translation
  - heading normalization to `[0, 360)` after rotation

## Data Model Target
- Add `VendorSiteMap` model with tenant/site/vendor map bindings and transform parameters.
- Add index coverage:
  - `(tenantId, siteId, vendor, vendorMapId)`
  - `(tenantId, siteId, vendor, vendorMapName)`
- Add SQL partial unique indexes for nullable map keys:
  - unique when `vendorMapId IS NOT NULL`
  - unique when `vendorMapName IS NOT NULL`
- Seed representative mappings plus canonical fixtures for map-id, map-name, and unmapped dead-letter path.

## Execution Waves

### Wave 0 Documentation Setup
| ID | Owner | Task | Depends On | Status |
|---|---|---|---|---|
| V1P3-DOC-001 | Planner | Create `implementation_plan_phase3.md` in V1 folder | - | done |
| V1P3-DOC-002 | Planner | Register Phase 3 planning entry in execution log | V1P3-DOC-001 | done |

### Wave 1 Contracts and Transform Core
| ID | Owner | Task | Depends On | Status |
|---|---|---|---|---|
| V1P3-CTR-001 | Implementer C | Extend canonical `robot_state.pose` schema with `vendor_map_id` and `vendor_map_name` | V1P3-DOC-001 | done |
| V1P3-CTR-002 | Implementer C | Add `VendorSiteMap` CRUD/preview schemas and shared types | V1P3-CTR-001 | done |
| V1P3-CTR-003 | Implementer C | Implement pure transform utility (`scale->rotate->translate`, heading normalization) | V1P3-CTR-001 | done |

### Wave 2 Data Model and Migration
| ID | Owner | Task | Depends On | Status |
|---|---|---|---|---|
| V1P3-DAT-001 | Implementer A | Add Prisma `VendorSiteMap` model and relations | V1P3-CTR-002 | done |
| V1P3-DAT-002 | Implementer A | Create migration with indexes and partial unique constraints | V1P3-DAT-001 | done |
| V1P3-DAT-003 | Implementer A | Update seed data for mappings and transform fixtures | V1P3-DAT-002 | done |

### Wave 3 Backend Ingest and Mapping APIs
| ID | Owner | Task | Depends On | Status |
|---|---|---|---|---|
| V1P3-API-001 | Implementer A | Add `/vendor-site-maps` CRUD + tenant/site/floorplan validation | V1P3-DAT-002 | done |
| V1P3-API-002 | Implementer A | Add `/vendor-site-maps/preview` endpoint using shared transform utility | V1P3-CTR-003 | done |
| V1P3-API-003 | Implementer A | Integrate mapping resolution + transform into `handleRobotStateMessage` ingest path | V1P3-API-001 | done |
| V1P3-API-004 | Implementer A | Implement compat fallback behavior for unmapped maps | V1P3-API-003 | done |
| V1P3-API-005 | Implementer A | Emit audit logs for mapping CRUD and transform-miss failures | V1P3-API-001 | done |

### Wave 4 Frontend Settings Visual Editor
| ID | Owner | Task | Depends On | Status |
|---|---|---|---|---|
| V1P3-WEB-001 | Implementer B | Add Settings map-mapping list/create/edit/delete flows | V1P3-API-001 | done |
| V1P3-WEB-002 | Implementer B | Build visual editor canvas with draggable origin + axis handles and derived transform params | V1P3-WEB-001 | done |
| V1P3-WEB-003 | Implementer B | Wire preview flow to `/vendor-site-maps/preview` and render transformed output | V1P3-WEB-002, V1P3-API-002 | done |
| V1P3-WEB-004 | Implementer B | Add validation UX for invalid mappings and save constraints | V1P3-WEB-001 | done |
| V1P3-WEB-005 | Implementer B | Update Developer API explorer examples for map-mapping endpoints | V1P3-API-001 | done |

### Wave 5 Review and Verification
| ID | Owner | Task | Depends On | Status |
|---|---|---|---|---|
| V1P3-RV-001 | Reviewer | Contract review for mapping APIs and ingest transform behavior | V1P3-API-004 | done |
| V1P3-RV-002 | Reviewer | Data/index review for mapping lookup performance and uniqueness correctness | V1P3-DAT-002 | done |
| V1P3-RV-003 | Reviewer | Frontend review of Settings visual editor interactions and failure states | V1P3-WEB-004 | done |
| V1P3-QA-001 | Tester | Unit/API checks for transform math and deterministic preview output | V1P3-CTR-003 | done |
| V1P3-QA-002 | Tester | API tests for mapping CRUD/preview and tenant isolation | V1P3-RV-001 | done |
| V1P3-QA-003 | Tester | Ingest tests for mapped transform, passthrough fallback, dead-letter rejection | V1P3-API-004 | done |
| V1P3-QA-004 | Tester | E2E-style Settings visual editor + Facility placement validation | V1P3-WEB-003 | done |
| V1P3-QA-005 | Tester | Add `scripts/v1-phase3-qa.mjs`, wire `qa:v1:phase3`, run gates | V1P3-QA-004 | done |

## Acceptance Tests (Phase 3)
1. Mapping CRUD enforces map-key requirements and duplicate protections.
2. Preview endpoint computes deterministic transformed output.
3. Ingest resolves by `vendor_map_id` then `vendor_map_name` and writes transformed pose.
4. Compat fallback passes through only with valid tenant/site floorplan.
5. Invalid unmapped pose paths fail asynchronously and record dead-letter + transform-miss audit.
6. Settings visual editor supports handle drag, derived transform, and preview output overlay.

## Assumptions and Defaults
1. Transform order fixed to `scale -> rotate -> translate`.
2. Rotation pivot remains origin-only for this phase.
3. Mapping edits are forward-only (no historical backfill).
4. Existing endpoint paths remain backward-compatible and additive.
5. Existing live socket channel names are unchanged.

## Execution Log
- 2026-02-27: Added shared schema/type extensions for vendor pose map keys and preview contracts.
- 2026-02-27: Added shared transform utility for deterministic pose conversion and heading normalization.
- 2026-02-27: Added Prisma `VendorSiteMap` model, migration, partial unique indexes, and seed fixtures.
- 2026-02-27: Implemented `vendor-site-maps` CRUD/preview APIs and tenant/site/floorplan validation.
- 2026-02-27: Integrated mapping resolution + compat fallback into ingest `robot_state` processing with audit-on-transform-miss.
- 2026-02-27: Added Settings visual map mapping editor and updated Developer API explorer endpoint catalog.
- 2026-02-27: Added V1 Phase 3 QA harness (`scripts/v1-phase3-qa.mjs`) and root script `qa:v1:phase3`.
