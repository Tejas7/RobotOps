# RobotOps Technical Documents

## Purpose
This folder is the technical source of truth for RobotOps system behavior and implementation across all completed phases.

## Maintenance Policy (Required)
Every time a phase is completed, these documents must be updated in the same branch before phase sign-off.

Required updates per phase completion:
1. Update [phase_completion_log.md](./phase_completion_log.md) with completion date, scope, and verification commands.
2. Update impacted technical docs in this folder (API, data model, frontend, RBAC/security, ingestion/realtime, QA/runbook).
3. Update [README.md](./README.md) in this folder if document coverage or ownership changes.

## Document Map
- [system_design_diagram.md](./system_design_diagram.md): visual system design (architecture + ingest + alert flows).
- [system_architecture.md](./system_architecture.md): runtime architecture, services, startup flow, infrastructure.
- [backend_api_reference.md](./backend_api_reference.md): REST endpoint catalog and contract summary.
- [data_model_and_storage.md](./data_model_and_storage.md): Prisma models, migrations, indexes, storage behavior.
- [realtime_ingestion_and_alerting.md](./realtime_ingestion_and_alerting.md): canonical ingest, queue/consumer, live channels, alert engine.
- [frontend_architecture.md](./frontend_architecture.md): dashboard/page architecture, client data flow, shared UI patterns.
- [auth_rbac_and_security.md](./auth_rbac_and_security.md): auth flow, permission model, guards, role overrides.
- [testing_qa_and_operations.md](./testing_qa_and_operations.md): quality gates, QA scripts, operations runbook.
- [phase_completion_log.md](./phase_completion_log.md): phase-by-phase completion and verification history.

## Current Baseline
- Last synchronized from codebase: 2026-02-28
- Covered implementations:
  - V0 Phase 1, 2, 3
  - V1 Phase 1, 2, 3, 4, 5
