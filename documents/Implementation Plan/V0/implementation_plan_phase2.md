# RobotOps Phase 2 Implementation Plan

## Status Legend
- `todo`: ready and not started
- `in_progress`: currently active for the assigned agent
- `review`: implemented and waiting reviewer pass
- `test`: reviewed and waiting tester verification
- `done`: implemented, reviewed, and verified
- `blocked`: cannot proceed due dependency/environment gap

## Agent Protocol
- Planner: one active task max
- Implementer A (Backend/DB/Realtime): one active task max
- Implementer B (Frontend shell/Overview/Fleet/Incidents): one active task max
- Implementer C (Missions/Facility/Teleop/Developer/Copilot): one active task max
- Reviewer: one active task max
- Tester: one active task max

## Current Active Tasks
- Planner: DOC-001
- Implementer A: no active task
- Implementer B: no active task
- Implementer C: no active task
- Reviewer: no active task
- Tester: no active task

## Wave 0 Documentation Setup
| ID | Owner | Task | Depends On | Status |
|---|---|---|---|---|
| DOC-001 | Planner | Rename Phase 1 plan file to lowercase Phase 1 name | - | done |
| DOC-002 | Planner | Create Phase 2 board file with identical structure/style | DOC-001 | done |

## Wave 1 Data and Contracts
| ID | Owner | Task | Depends On | Status |
|---|---|---|---|---|
| P2-FND-001 | Implementer A | Add Prisma models/indexes for integrations, views, configs, path points | DOC-002 | done |
| P2-FND-002 | Implementer A | Create and apply migration for new Phase 2 entities | P2-FND-001 | done |
| P2-FND-003 | Implementer A | Extend seed data for integrations, test runs, saved views/defaults, path history | P2-FND-002 | done |
| P2-FND-004 | Implementer C | Add shared zod schemas/types for new API contracts | P2-FND-001 | done |

## Wave 2 Backend APIs
| ID | Owner | Task | Depends On | Status |
|---|---|---|---|---|
| P2-API-001 | Implementer A | Telemetry downsampling logic + extended `/telemetry/robot/:id` query handling | P2-FND-004 | done |
| P2-API-002 | Implementer A | Add `/robots/:id/path` playback endpoint from `RobotPathPoint` | P2-FND-003 | done |
| P2-API-003 | Implementer A | Saved views CRUD + role-default endpoint with RBAC/tenant guards | P2-FND-004 | done |
| P2-API-004 | Implementer A | Integrations CRUD + deterministic test flow + run logs | P2-FND-003 | done |
| P2-API-005 | Implementer A | Extend `/audit` filters/pagination and preserve tenant scoping | P2-FND-004 | done |
| P2-API-006 | Implementer A | Dashboard config validate/save/update/activate endpoints | P2-FND-004 | done |
| P2-API-007 | Implementer A | `/analytics/dashboard` and `/analytics/export` endpoints | P2-FND-003 | done |
| P2-API-008 | Implementer A | Ensure all Phase 2 writes emit audit with `{before,after}` diffs | P2-API-003 | done |

## Wave 3 Frontend Core Enhancements
| ID | Owner | Task | Depends On | Status |
|---|---|---|---|---|
| P2-WEB-001 | Implementer B | Add Saved Views control in top header (list/apply/save) | P2-API-003 | done |
| P2-WEB-002 | Implementer B | Apply role-default view on Overview/Analytics when URL has no explicit filters | P2-WEB-001 | done |
| P2-WEB-003 | Implementer B | Upgrade Fleet telemetry tab with metric picker, range, downsample indicator, CSV export | P2-API-001 | done |
| P2-WEB-004 | Implementer C | Replace Facility playback stub with real path playback scrubber and trails | P2-API-002 | done |
| P2-WEB-005 | Implementer C | Add reusable JSON diff renderer and wire into Developer audit panel | P2-API-005 | done |

## Wave 4 Broader Screen Expansion
| ID | Owner | Task | Depends On | Status |
|---|---|---|---|---|
| P2-WEB-006 | Implementer B | Replace Analytics placeholder with full dashboards + export actions | P2-API-007 | done |
| P2-WEB-007 | Implementer C | Replace Integrations stubs with catalog, connect wizard, test flow, status/error logs | P2-API-004 | done |
| P2-WEB-008 | Implementer C | Replace Settings placeholder with config-as-code editor + validation + activate flow | P2-API-006 | done |
| P2-WEB-009 | Implementer B | Add incident automation hook status cards sourced from integration test/sync status | P2-WEB-007 | done |
| P2-WEB-010 | Implementer C | Extend Developer page with queryable audit table and structured diff drilldown | P2-WEB-005 | done |

## Wave 5 Review and Verification
| ID | Owner | Task | Depends On | Status |
|---|---|---|---|---|
| P2-RV-001 | Reviewer | Backend contract and RBAC review for all new endpoints | P2-API-008 | done |
| P2-RV-002 | Reviewer | Frontend regression review across Overview/Fleet/Facility/Incidents/Analytics/Integrations/Settings/Developer | P2-WEB-010 | done |
| P2-QA-001 | Tester | Add API smoke coverage for new endpoints and tenant isolation | P2-RV-001 | done |
| P2-QA-002 | Tester | Add E2E `scripts/phase2-qa.mjs` for key Phase 2 flows | P2-RV-002 | done |
| P2-QA-003 | Tester | Performance and accessibility pass on new pages/components | P2-QA-002 | done |
| P2-QA-004 | Tester | Update root scripts with `qa:phase2` and run full build/typecheck/qa gates | P2-QA-003 | done |

## Scope Summary
- Scope source: `documents/OriginalPrompt.json` `implementation_plan.phase_2_enhancements` plus broader screen expansion.
- Outcome targets: telemetry downsampling, path playback, saved views with role defaults, integration test flows, audit diff rendering, configuration-as-code editor, and full Analytics/Integrations/Developer/Settings screens.

## Assumptions and Defaults
1. File naming/location is fixed to `documents/implementation_plan_phase1.md` and `documents/implementation_plan_phase2.md`.
2. Phase 2 excludes Phase 3 infrastructure changes.
3. Integration test flows are deterministic stubs and do not call external systems.
4. Role defaults apply to Overview and Analytics in Phase 2.
5. Telemetry API default `max_points` is `240`.
6. API timestamps remain UTC ISO-8601; UI formats locally.
7. Existing permissions remain unchanged.
8. Existing Phase 1 routes remain backward compatible with additive query params.

## Execution Log
- 2026-02-27: Phase 2 plan initialized and moved into execution.
- 2026-02-27: Prisma schema expanded for integrations, saved views/defaults, dashboard configs, and robot path points.
- 2026-02-27: Backend endpoints implemented for telemetry downsampling, path playback, saved views, integrations, dashboard configs, analytics, and cursor-ready audit queries.
- 2026-02-27: Frontend Phase 2 pages and flows implemented (Analytics, Integrations, Settings, Developer diff drilldown, Fleet telemetry upgrades, Facility playback, Incidents automation status cards, header saved views).
- 2026-02-27: Added `scripts/phase2-qa.mjs` and `npm run qa:phase2`; Phase 2 QA suite passed.
