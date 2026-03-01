# RobotOps V1 Phase 5 Implementation Plan

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
- Planner: `V1P5-DOC-001`
- Implementer A: no active task
- Implementer B: no active task
- Implementer C: no active task
- Reviewer: no active task
- Tester: no active task

## Scope Summary
- Scope source: `documents/Implementation Plan/V1/V1Prompt.json` phase `5` ("Adapter interface plus replay and recording harness").
- Goal: establish a repeatable integration workflow with adapter contracts, raw payload recording, deterministic replay, and CI-safe verification against canonical ingest semantics.
- Outcome:
1. First-class adapter contracts are available for polling and streaming adapters.
2. Recorder captures raw vendor payload streams with required metadata.
3. Replayer deterministically regenerates canonical envelopes and runs them through the same ingest path.
4. CLI workflows exist for record, replay, and validate.
5. Adapter health surface reports last success and last error.

## Locked Decisions
1. Recorder storage backend for Phase 5 is local filesystem only (`.data/adapter-captures/`), not object storage.
2. Replay target path is `POST /ingest/telemetry` (same validation + persistence + routing path used in production).
3. Replay default mode is deterministic ordering by capture timestamp plus stable original index tie-break.
4. Adapter loading model is explicit module registration (no dynamic remote plugin loading in Phase 5).
5. Capture format is manifest JSON + JSONL entries to support large streams without full in-memory load.
6. Health endpoint is read-only and backed by durable DB state updates from adapter runs.

## Plan Artifact Changes
1. Create `documents/Implementation Plan/V1/implementation_plan_phase5.md` in same board style as V1 phases 1 to 4.
2. Keep `documents/Implementation Plan/V1/implementation_plan_phase1.md` through `implementation_plan_phase4.md` unchanged.
3. On phase completion, update:
   - `documents/Technical Documents/phase_completion_log.md`
   - `documents/Technical Documents/backend_api_reference.md`
   - `documents/Technical Documents/data_model_and_storage.md`
   - `documents/Technical Documents/realtime_ingestion_and_alerting.md`
   - `documents/Technical Documents/testing_qa_and_operations.md`
   - `README.md` (add `qa:v1:phase5` and adapter CLI usage)

## Public API, Interface, and Type Changes

### API endpoint additions
| Endpoint | Method | Permission | Notes |
|---|---|---|---|
| `/adapters/health` | GET | `integrations.read` or `config.read` | Returns adapter health summary per tenant/vendor/site (`status,last_success_at,last_error_at,last_error`). |
| `/adapters/captures` | GET | `integrations.read` | Lists recorded capture manifests available for replay (`capture_id,vendor,site_id,start,end,entries`). |
| `/adapters/replays` | POST | `integrations.manage` or `telemetry.ingest` | Triggers server-side deterministic replay run from a capture with replay options; returns run id and summary. |
| `/adapters/replays/:id` | GET | `integrations.read` | Returns replay run status, counts, and failure samples. |

### CLI commands to add
1. `npm run adapter:record -- --vendor <vendor> --site <site_id> --adapter <name> --duration <seconds> --out <capture_id>`
2. `npm run adapter:replay -- --capture <capture_id> --speed <multiplier> --from <iso?> --to <iso?> --deterministic true`
3. `npm run adapter:validate -- --capture <capture_id> --expected <path-to-golden-json>`

### Shared contracts/types
1. `PollingAdapter` interface:
   - `initialize(config)`
   - `poll(): Promise<RawAdapterRecord[]>`
   - `health(): Promise<AdapterHealthSnapshot>`
2. `StreamingAdapter` interface:
   - `initialize(config)`
   - `connect()`
   - `onMessage(rawPayload, context): Promise<CanonicalEnvelopeInput[]>`
   - `disconnect()`
   - `health(): Promise<AdapterHealthSnapshot>`
3. `RawCaptureManifestSchema` and `RawCaptureEntrySchema`.
4. `ReplayOptionsSchema` (`replay_speed_multiplier`, `time_window_filter`, `deterministic_ordering`).
5. `AdapterHealthResponse`, `ReplayRunSummary`, `CaptureListItem` types.

## Data Model and Migration Changes

### Prisma additions
1. `AdapterHealthState` model:
   - key: unique `(tenantId, siteId, vendor, adapterName)`
   - fields: `status`, `lastSuccessAt`, `lastErrorAt`, `lastError`, `lastRunId`, `updatedAt`.
2. `AdapterReplayRun` model:
   - fields: `id`, `tenantId`, `captureId`, `status`, `startedAt`, `endedAt`, `acceptedCount`, `duplicateCount`, `failedCount`, `options`, `errorSummary`.
3. `AdapterReplayRunEvent` model:
   - normalized replay event outcomes for diagnostics (`runId`, `messageId`, `messageType`, `result`, `error`).

### Filesystem capture layout (non-DB)
1. `.data/adapter-captures/<capture_id>/manifest.json`
2. `.data/adapter-captures/<capture_id>/entries.jsonl`
3. Manifest metadata required fields:
   - `vendor`, `site_id`, `start_time`, `end_time`, `source_endpoint`, `capture_version`, `adapter_name`, `entry_count`.
4. Entry fields:
   - `timestamp`, `raw_payload`, optional `raw_headers`, optional `raw_path`, optional `sequence_hint`.

### Migration and backfill
1. Create migration for adapter health and replay-run tables plus indexes:
   - `AdapterHealthState(tenantId,updatedAt)`
   - `AdapterReplayRun(tenantId,startedAt)`
   - `AdapterReplayRunEvent(runId,messageId)`.
2. No destructive changes and no backfill required for historical domain tables.

## Processing Rules (Decision-Complete)

### Recording
1. Recorder invokes adapter contract (`poll` loop or streaming callback) and writes each raw record to JSONL with monotonic `capture_index`.
2. Manifest is finalized atomically at stop/end with computed `entry_count` and time bounds.
3. Recorder never mutates operational tables except updating `AdapterHealthState` success/error fields.

### Replay
1. Replayer loads manifest and entries, applies optional time-window filter.
2. Deterministic mode sorts by `(timestamp asc, capture_index asc)` before envelope generation.
3. Each raw entry is passed to adapter transformation logic to produce canonical envelopes.
4. Each generated envelope is sent through `POST /ingest/telemetry` with tenant-auth context.
5. Replay run accumulates accepted/duplicate/failed counts and stores per-message results in `AdapterReplayRunEvent`.

### Validation
1. `adapter:validate` compares produced canonical envelopes against expected golden output:
   - strict equality for required canonical fields
   - sorted deterministic comparison by `(message_type,timestamp,message_id)`.
2. Validation fails on missing/extra envelopes or field mismatches and writes summary artifact.

### Health reporting
1. `AdapterHealthState.status` values: `healthy|degraded|error|unknown`.
2. Last success updates on successful record/replay cycle completion.
3. Last error updates on adapter init/connect/transform/replay failures.

## Execution Waves

### Wave 0 Documentation Setup
| ID | Owner | Task | Depends On | Status |
|---|---|---|---|---|
| V1P5-DOC-001 | Planner | Create `implementation_plan_phase5.md` in V1 folder | - | todo |
| V1P5-DOC-002 | Planner | Register Phase 5 planning entry in execution log section | V1P5-DOC-001 | todo |

### Wave 1 Contracts and Harness Core
| ID | Owner | Task | Depends On | Status |
|---|---|---|---|---|
| V1P5-CTR-001 | Implementer C | Add adapter interfaces (`PollingAdapter`,`StreamingAdapter`) and shared run/capture types | V1P5-DOC-001 | todo |
| V1P5-CTR-002 | Implementer C | Add capture/replay schemas (`manifest`,`entry`,`options`) and validators | V1P5-CTR-001 | todo |
| V1P5-CTR-003 | Implementer C | Add deterministic ordering utilities and golden comparison helpers | V1P5-CTR-002 | todo |

### Wave 2 Data and Storage Foundation
| ID | Owner | Task | Depends On | Status |
|---|---|---|---|---|
| V1P5-DAT-001 | Implementer A | Add Prisma models for adapter health and replay runs/events | V1P5-CTR-001 | todo |
| V1P5-DAT-002 | Implementer A | Create migration with required indexes | V1P5-DAT-001 | todo |
| V1P5-DAT-003 | Implementer A | Add filesystem capture repository module (`.data/adapter-captures`) with manifest/jsonl IO | V1P5-CTR-002 | todo |
| V1P5-DAT-004 | Implementer A | Seed minimal adapter health and replay fixtures for local QA | V1P5-DAT-002 | todo |

### Wave 3 Backend Adapter Runtime and APIs
| ID | Owner | Task | Depends On | Status |
|---|---|---|---|---|
| V1P5-API-001 | Implementer A | Implement adapter registry + runtime service for polling/streaming adapters | V1P5-CTR-001 | todo |
| V1P5-API-002 | Implementer A | Implement recorder service for raw payload capture and manifest finalization | V1P5-DAT-003 | todo |
| V1P5-API-003 | Implementer A | Implement replayer service that regenerates canonical envelopes and posts to `/ingest/telemetry` | V1P5-CTR-003 | todo |
| V1P5-API-004 | Implementer A | Add `/adapters/health`, `/adapters/captures`, `/adapters/replays`, `/adapters/replays/:id` endpoints | V1P5-DAT-002 | todo |
| V1P5-API-005 | Implementer A | Persist replay run events/results and update adapter health on success/failure | V1P5-API-003 | todo |

### Wave 4 CLI and Developer Experience
| ID | Owner | Task | Depends On | Status |
|---|---|---|---|---|
| V1P5-CLI-001 | Implementer C | Add `adapter:record` CLI command and argument parser | V1P5-API-002 | todo |
| V1P5-CLI-002 | Implementer C | Add `adapter:replay` CLI command with deterministic/time-window controls | V1P5-API-003 | todo |
| V1P5-CLI-003 | Implementer C | Add `adapter:validate` CLI command for golden-envelope comparison | V1P5-CTR-003 | todo |
| V1P5-WEB-001 | Implementer B | Extend Developer page with adapter capture/replay status and health panel | V1P5-API-004 | todo |

### Wave 5 Review and Verification
| ID | Owner | Task | Depends On | Status |
|---|---|---|---|---|
| V1P5-RV-001 | Reviewer | Contract review for adapter interfaces and replay determinism guarantees | V1P5-CTR-003 | todo |
| V1P5-RV-002 | Reviewer | Storage review for capture format stability and replay-run persistence | V1P5-DAT-003 | todo |
| V1P5-RV-003 | Reviewer | API/CLI review for tenant isolation and permission boundaries | V1P5-API-004 | todo |
| V1P5-QA-001 | Tester | Unit tests for adapter contract compliance and ordering helper determinism | V1P5-CTR-003 | todo |
| V1P5-QA-002 | Tester | API tests for adapter health/captures/replays endpoints and RBAC | V1P5-RV-003 | todo |
| V1P5-QA-003 | Tester | End-to-end replay tests using canned capture streams through `/ingest/telemetry` | V1P5-API-003 | todo |
| V1P5-QA-004 | Tester | Add `scripts/v1-phase5-qa.mjs`, wire `qa:v1:phase5`, run type/build/qa gates | V1P5-QA-003 | todo |

## Test Cases and Scenarios

### Backend and contract tests
1. Polling adapter contract rejects implementations missing `initialize/poll/health`.
2. Streaming adapter contract rejects implementations missing `connect/onMessage/disconnect/health`.
3. Recorder writes valid manifest and JSONL entries with correct `entry_count` and metadata.
4. Replay deterministic mode produces identical canonical envelope order across repeated runs.
5. Replay with `time_window_filter` includes only entries in range.
6. Replay posts generated envelopes to `/ingest/telemetry` and receives expected `accepted/duplicate` counts.
7. Replay run persistence writes `AdapterReplayRun` and per-message `AdapterReplayRunEvent` rows.
8. Adapter health updates `lastSuccessAt` and `lastErrorAt` correctly for success/failure runs.
9. `/adapters/health` and replay endpoints enforce tenant isolation and permissions.
10. `adapter:validate` fails with clear diff output on golden mismatch.

### Frontend and CLI scenarios
1. Operator runs `adapter:record` and capture appears in `/adapters/captures` list.
2. Operator runs `adapter:replay` for the capture and gets run summary with counts.
3. Developer page shows adapter health status and latest replay runs without UI errors.
4. CI runs deterministic replay twice and obtains identical validation output.

### Performance and reliability checks
1. Recorder handles sustained input without unbounded memory growth (streamed JSONL writes).
2. Replay can process large capture files in chunked mode.
3. Replay failure in one entry does not abort whole run unless fail-fast option is enabled.

## Assumptions and Defaults
1. Plan artifact path is `documents/Implementation Plan/V1/implementation_plan_phase5.md`.
2. Capture storage is local filesystem under `.data/adapter-captures/` for Phase 5.
3. Replay defaults: `replay_speed_multiplier=1`, `deterministic_ordering=true`, no time filter.
4. Adapter module registry is static and local to repo; no dynamic external plugin execution.
5. Replay uses existing canonical ingest API path rather than direct DB writes.
6. Existing phase 1 to 4 APIs remain backward compatible.
7. No MQTT transport implementation is introduced in this phase.
8. All timestamps remain UTC ISO-8601 at API and capture boundaries.

## Execution Log
- 2026-02-28: Phase 5 plan drafted from `V1Prompt.json` and aligned to current V1 Phase 4 codebase.
- 2026-02-28: Locked defaults selected for local capture storage, deterministic replay ordering, and ingest-path replay execution.
