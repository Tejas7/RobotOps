# RobotOps Phase 3 Implementation Plan

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
- Implementer B (Frontend shell/Overview/Fleet/Incidents/Analytics): one active task max
- Implementer C (Platform/Security/Developer tooling): one active task max
- Reviewer: one active task max
- Tester: one active task max

## Current Active Tasks
- Planner: no active task
- Implementer A: no active task
- Implementer B: no active task
- Implementer C: no active task
- Reviewer: no active task
- Tester: no active task

## Wave 0 Documentation Setup
| ID | Owner | Task | Depends On | Status |
|---|---|---|---|---|
| P3-DOC-001 | Planner | Create `documents/implementation_plan_phase3.md` with Phase 2 board structure | - | done |
| P3-DOC-002 | Planner | Add Phase 3 setup notes and script references to README | P3-DOC-001 | done |

## Wave 1 Infrastructure Foundation
| ID | Owner | Task | Depends On | Status |
|---|---|---|---|---|
| P3-INF-001 | Implementer C | Update `docker-compose.yml` for Timescale-enabled Postgres and NATS JetStream | P3-DOC-001 | done |
| P3-INF-002 | Implementer C | Add env template vars and API config loader for NATS/Timescale settings | P3-INF-001 | done |
| P3-INF-003 | Implementer C | Add NATS client provider, connection lifecycle, and health probes | P3-INF-002 | done |
| P3-INF-004 | Implementer C | Add `/system/pipeline-status` backend plumbing (connectivity + lag placeholders) | P3-INF-003 | done |

## Wave 2 Data and Contracts
| ID | Owner | Task | Depends On | Status |
|---|---|---|---|---|
| P3-DAT-001 | Implementer A | Add Prisma models for ingestion, rollups, alerts, role overrides | P3-INF-002 | done |
| P3-DAT-002 | Implementer A | Create migration with Timescale extension + hypertable conversion + aggregate SQL | P3-DAT-001 | done |
| P3-DAT-003 | Implementer A | Add indexes and retention/refresh policies for telemetry and rollups | P3-DAT-002 | done |
| P3-DAT-004 | Implementer A | Extend seed data for multi-site analytics, alert rules/policies/events, scope overrides | P3-DAT-002 | done |
| P3-DAT-005 | Implementer C | Add shared Zod schemas/types for ingestion, cross-site analytics, alerts, RBAC matrix | P3-DAT-001 | done |

## Wave 3 Ingestion and Analytics Backend
| ID | Owner | Task | Depends On | Status |
|---|---|---|---|---|
| P3-API-001 | Implementer A | Implement `POST /ingest/telemetry` validation + JetStream publish | P3-INF-003, P3-DAT-005 | done |
| P3-API-002 | Implementer A | Implement telemetry consumer with idempotency, dead-letter handling, and persistence | P3-API-001, P3-DAT-001 | done |
| P3-API-003 | Implementer A | Update telemetry query path to prefer Timescale rollups for long windows | P3-DAT-003 | done |
| P3-API-004 | Implementer A | Implement cross-site analytics endpoints with rollup-backed queries | P3-DAT-003, P3-DAT-005 | done |
| P3-API-005 | Implementer A | Add rollup refresh worker and freshness metadata for `/system/pipeline-status` | P3-API-004 | done |
| P3-API-006 | Implementer A | Extend analytics export to include cross-site datasets and permission split | P3-API-004 | done |

## Wave 4 RBAC Hardening and Alert Routing Backend
| ID | Owner | Task | Depends On | Status |
|---|---|---|---|---|
| P3-SEC-001 | Implementer C | Expand permission catalog + alias map + `scope_version=2` normalization | P3-DAT-005 | done |
| P3-SEC-002 | Implementer C | Replace ad hoc permission checks with strict guard/decorator patterns (`all`/`any`) | P3-SEC-001 | done |
| P3-SEC-003 | Implementer C | Add RBAC catalog/role endpoints with tenant overrides | P3-SEC-002, P3-DAT-001 | done |
| P3-ALT-001 | Implementer A | Implement alert rule/policy CRUD endpoints with validation and tenant scoping | P3-DAT-005, P3-DAT-001 | done |
| P3-ALT-002 | Implementer A | Implement alert evaluation engine (incident-driven + integration-error-driven) | P3-ALT-001 | done |
| P3-ALT-003 | Implementer A | Implement escalation scheduler + deterministic delivery run persistence | P3-ALT-002 | done |
| P3-ALT-004 | Implementer A | Emit alert audit events and `alerts.live` realtime channel updates | P3-ALT-003 | done |

## Wave 5 Frontend Phase 3 Experiences
| ID | Owner | Task | Depends On | Status |
|---|---|---|---|---|
| P3-WEB-001 | Implementer B | Add `All sites` support in global filters/header and URL sync | P3-API-004 | done |
| P3-WEB-002 | Implementer B | Upgrade Analytics page with cross-site comparison/rollup visualizations | P3-API-004, P3-API-006 | done |
| P3-WEB-003 | Implementer C | Add Settings RBAC scope matrix editor and role override management | P3-SEC-003 | done |
| P3-WEB-004 | Implementer C | Add Settings alert rules/policies editor + test-route flow | P3-ALT-001 | done |
| P3-WEB-005 | Implementer B | Add Incidents alert timeline/escalation status panel | P3-ALT-003 | done |
| P3-WEB-006 | Implementer C | Extend Developer page with pipeline status, dead-letter, and rollup freshness panels | P3-API-005, P3-INF-004 | done |
| P3-WEB-007 | Implementer B | Update client-side RBAC checks for fine-grained scopes and fallback aliases | P3-SEC-001 | done |

## Wave 6 Review and Verification
| ID | Owner | Task | Depends On | Status |
|---|---|---|---|---|
| P3-RV-001 | Reviewer | Backend architecture review: ingestion reliability, Timescale queries, alert engine correctness | P3-ALT-004, P3-API-006 | done |
| P3-RV-002 | Reviewer | Security review: scope enforcement, legacy alias behavior, tenant isolation | P3-SEC-003 | done |
| P3-RV-003 | Reviewer | Frontend regression review across Overview/Fleet/Incidents/Analytics/Settings/Developer | P3-WEB-007 | done |
| P3-QA-001 | Tester | Add API smoke tests for new ingestion, analytics, alerts, and RBAC endpoints | P3-RV-001 | done |
| P3-QA-002 | Tester | Add E2E script `scripts/phase3-qa.mjs` for core Phase 3 journeys | P3-RV-003 | done |
| P3-QA-003 | Tester | Add performance tests for telemetry ingest throughput and rollup latency targets | P3-QA-001 | done |
| P3-QA-004 | Tester | Accessibility + keyboard pass on new Settings/Analytics/Incidents/Developer flows | P3-QA-002 | done |
| P3-QA-005 | Tester | Add root script `qa:phase3` and run `typecheck`, `build`, `qa:phase3` gates | P3-QA-004 | done |

## Scope Summary
- Scope source: `documents/OriginalPrompt.json` `implementation_plan.phase_3_scaling`.
- Delivery targets: Timescale-ready telemetry storage, NATS-backed ingestion queue semantics, fine-grained RBAC scopes with legacy aliases, multi-site rollups/cross-site analytics, and deterministic alert routing/escalation.

## Assumptions and Defaults
1. Message bus implementation in this phase is deterministic local queue semantics with NATS connectivity checks and subject/stream configuration support.
2. Timescale SQL is applied idempotently; the API falls back gracefully when Timescale extension/catalogs are unavailable.
3. Alert delivery remains deterministic and persisted (`scheduled/sent/failed`) with no outbound network calls.
4. Existing Phase 1/2 routes remain backward compatible with additive query parameters and alias scope support.
5. API timestamps remain UTC ISO-8601.

## Execution Log
- 2026-02-27: Phase 3 documentation, infrastructure config, and env templates added.
- 2026-02-27: Prisma schema and migration expanded for ingestion, rollups, alerts, and role scope overrides.
- 2026-02-27: Added Phase 3 backend services and endpoints for ingestion, analytics cross-site/export, alerts, RBAC catalog/matrix, and pipeline status.
- 2026-02-27: Updated frontend Analytics, Settings, Incidents, Developer, and shared RBAC logic for Phase 3 capabilities.
- 2026-02-27: Added `scripts/phase3-qa.mjs` and root `qa:phase3` script.
- 2026-02-27: Remediated Phase 3 accessibility blockers on Settings/Incidents/Developer and re-ran `typecheck`, `build`, and `qa:phase3` successfully.
