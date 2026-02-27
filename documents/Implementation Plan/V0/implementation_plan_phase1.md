# RobotOps Implementation Plan

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
- Planner: no active task
- Implementer A: no active task
- Implementer B: no active task
- Implementer C: no active task
- Reviewer: no active task
- Tester: no active task

## Planner Lane
| ID | Task | Status |
|---|---|---|
| PL-001 | Parse JSON spec | done |
| PL-002 | Lock architecture decisions | done |
| PL-003 | Define multi-agent WIP policy | done |
| PL-004 | Write full execution plan to this file | done |
| PL-005 | Add status legend and tracking rules | done |
| PL-006 | Assign first runnable tasks | done |
| PL-007 | Keep dependencies and statuses updated | done |

## Wave 1 Foundation
| ID | Owner | Task | Depends On | Status |
|---|---|---|---|---|
| FND-001 | Implementer C | Initialize monorepo root (`apps/*`, `packages/*`, root configs) | PL-006 | done |
| FND-002 | Implementer B | Scaffold `apps/web` (Next.js 14, TS, Tailwind, shadcn-style primitives) | FND-001 | done |
| FND-003 | Implementer A | Scaffold `apps/api` (NestJS + config + env) | FND-001 | done |
| FND-004 | Implementer C | Create `packages/shared` (types + zod) | FND-001 | done |
| FND-005 | Implementer A | Add `docker-compose.yml` (Postgres + Redis) | FND-003 | done |
| FND-006 | Implementer C | Add `.env.example` for web/api | FND-002,FND-003 | done |
| FND-007 | Implementer A | Initialize Prisma | FND-005 | done |
| FND-008 | Implementer A | Add Prisma models for Phase 1 entities | FND-007 | done |
| FND-009 | Implementer A | Create initial migration | FND-008 | done |
| FND-010 | Implementer A | Seed deterministic dummy data | FND-009 | done |
| FND-011 | Implementer A | API bootstrap (validation/CORS/errors) | FND-003 | done |
| FND-012 | Implementer B | API client + TanStack Query provider | FND-002,FND-003 | done |
| FND-013 | Implementer B | Design tokens + global theme variables | FND-002 | done |

## Wave 2 Security and Access
| ID | Owner | Task | Depends On | Status |
|---|---|---|---|---|
| SEC-001 | Implementer C | NextAuth credentials with seeded users | FND-002,FND-010 | done |
| SEC-002 | Implementer C | JWT/session callbacks (`tenantId`, `role`, `permissions`) | SEC-001 | done |
| SEC-003 | Implementer A | Nest JWT auth guard | FND-011,SEC-002 | done |
| SEC-004 | Implementer A | Permissions decorator + RBAC guard | SEC-003 | done |
| SEC-005 | Implementer A | Tenant scoping in services | SEC-003,FND-008 | done |
| SEC-006 | Implementer A | Audit helper for critical actions | FND-008 | done |
| SEC-007 | Implementer B | Frontend RBAC helpers | SEC-002 | done |

## Wave 3 Backend API + Realtime
| ID | Owner | Task | Status |
|---|---|---|---|
| API-001 | Implementer A | `GET /tenants/me` | done |
| API-002 | Implementer A | `GET /sites` | done |
| API-003 | Implementer A | `GET /floorplans` | done |
| API-004 | Implementer A | `GET /robots` with filters | done |
| API-005 | Implementer A | `GET /robots/:id` | done |
| API-006 | Implementer A | `POST /robots/:id/actions` + validation + audit | done |
| API-007 | Implementer A | `GET /missions` | done |
| API-008 | Implementer A | `POST /missions` + zone ack rules | done |
| API-009 | Implementer A | `GET /missions/:id` | done |
| API-010 | Implementer A | `GET /incidents` | done |
| API-011 | Implementer A | `POST /incidents/:id/ack` | done |
| API-012 | Implementer A | `POST /incidents/:id/resolve` | done |
| API-013 | Implementer A | `GET /audit` | done |
| API-014 | Implementer A | `GET /telemetry/robot/:id` | done |
| API-015 | Implementer A | `GET /rtls/assets` | done |
| API-016 | Implementer A | `GET /copilot/thread/:id` | done |
| API-017 | Implementer A | `POST /copilot/thread` | done |
| API-018 | Implementer A | `POST /copilot/message` | done |
| API-019 | Implementer A | WebSocket gateway + auth | done |
| API-020 | Implementer A | Emit live channels | done |
| API-021 | Implementer A | Reconnect guidance heartbeat | done |

## Wave 4 Web Shell + Shared UI
| ID | Owner | Task | Status |
|---|---|---|---|
| WEB-001 | Implementer B | Sidebar + sticky top header | done |
| WEB-002 | Implementer B | Site/time range selectors | done |
| WEB-003 | Implementer B | Search, notifications, user menu | done |
| WEB-004 | Implementer B | Status chip component | done |
| WEB-005 | Implementer B | Table primitive | done |
| WEB-006 | Implementer B | Drawer primitive | done |
| WEB-007 | Implementer B | Confirmation dialog primitive | done |
| WEB-008 | Implementer B | Skeleton/empty state primitives | done |
| WEB-009 | Implementer B | WebSocket client with reconnect hooks | done |

## Wave 5 Phase 1 Pages
| ID | Owner | Feature Slice | Status |
|---|---|---|---|
| OV-001..OV-006 | Implementer B | Overview page widgets and copilot entry | done |
| FL-001..FL-009 | Implementer B | Fleet list + robot detail tabs + controls | done |
| MI-001..MI-007 | Implementer C | Missions list/detail/create and validation | done |
| IN-001..IN-006 | Implementer B | Incidents list/detail/ack/resolve + stubs | done |
| FA-001..FA-006 | Implementer C | Facility map layers/tools | done |
| TE-001..TE-005 | Implementer C | Teleoperation page and gated controls | done |
| DV-001..DV-004 | Implementer C | Developer page and endpoint snippets | done |
| CP-001..CP-007 | A/C | Copilot UI + backend tool routing + safety | done |

## Wave 6 Review and Testing
| ID | Owner | Task | Status |
|---|---|---|---|
| RV-001..RV-005 | Reviewer | Wave reviews + regression review | done |
| QA-001 | Tester | API smoke tests (health + key endpoints) | done |
| QA-002 | Tester | RBAC tests for forbidden actions | done |
| QA-003 | Tester | Tenant isolation tests | done |
| QA-004 | Tester | WebSocket reconnect checks | done |
| QA-005 | Tester | E2E: site/time range updates overview | done |
| QA-006 | Tester | E2E: fleet filters + robot drawer tabs | done |
| QA-007 | Tester | E2E: mission create appears in list | done |
| QA-008 | Tester | E2E: incident ack/resolve + timeline update | done |
| QA-009 | Tester | E2E: facility layers and toggles | done |
| QA-010 | Tester | E2E: copilot handles example prompts | done |
| QA-011 | Tester | Performance check (<2s with seed) | done |
| QA-012 | Tester | Accessibility smoke checks | done |

## Execution Log
- 2026-02-27: Plan moved from proposal to execution-tracked board.
- 2026-02-27: Monorepo scaffold completed (`apps/web`, `apps/api`, `packages/shared`).
- 2026-02-27: NestJS API, Prisma schema/seed, RBAC/tenancy/audit, REST endpoints, and WebSocket gateway implemented.
- 2026-02-27: Next.js frontend shell, auth, global filters, pages (Overview/Fleet/Missions/Facility/Incidents/Teleoperation/Developer/Copilot) implemented.
- 2026-02-27: Typecheck and production build pass for all workspaces.
- 2026-02-27: Installed local PostgreSQL 16, created `robotops` role/db, applied Prisma migration, and executed seed data.
- 2026-02-27: Completed automated QA suites for API smoke, RBAC, tenant isolation, WebSocket reconnect, copilot prompt coverage, and perf checks.
- 2026-02-27: Completed browser automation for remaining Phase 1 QA (`QA-005`, `QA-006`, `QA-009`, `QA-012`) via `scripts/phase1-qa.mjs` with Playwright + axe; no serious/critical accessibility blockers remained.
