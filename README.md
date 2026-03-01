# RobotOps

Robotics operations and orchestration dashboard for heterogeneous fleets.

## Monorepo layout
- `apps/web`: Next.js 16 frontend (TypeScript, Tailwind, NextAuth, TanStack Query, Zustand, Recharts, MapLibre)
- `apps/api`: NestJS backend (TypeScript, Prisma, WebSocket live gateway)
- `packages/shared`: shared RBAC constants, domain types, and Zod schemas

## Product status (Phases 1-3)
- Phase 1: Core operations platform shipped (`Overview`, `Fleet`, `Missions`, `Incidents`, `Facility`, `Teleoperation`, `Developer`, `Copilot`) with tenant-scoped RBAC and live operations feeds.
- Phase 2: Telemetry downsampling, robot path playback, saved views with role defaults, integrations test flows, audit diff rendering, and full `Analytics`/`Integrations`/`Settings` experience.
- Phase 3: Timescale-ready telemetry model, NATS-backed ingestion path, fine-grained scope-based RBAC (with legacy aliases), cross-site analytics and export, alert rules/policies/escalation flow, and pipeline health/status surfaces.

## V1 hardening track
- V1 Phase 1: canonical envelope locked to `robot_state`, `robot_event`, `task_status`.
- V1 Phase 2: `RobotLastState` read model introduced as canonical robot live-state source (`/robots/last_state`) with compatibility overlays on `/robots` and `/robots/:id`.
- V1 Phase 3: `VendorSiteMap` mapping + ingest transform path to keep vendor pose in RobotOps floorplan coordinates, with Settings visual transform editor and preview API.
- V1 Phase 4: dedupe windows + deterministic ordering hardened (`robot_event` `dedupe_key` required, sequence-aware processing, robot/task cursors, and no-duplicate/no-jitter ingest side effects).
- V1 Phase 5: adapter capture/replay harness with deterministic replay through canonical ingest, adapter health APIs, replay diagnostics persistence, and adapter CLI workflows.

## Technical documentation
- Technical source of truth: `documents/Technical Documents/`
- Index and maintenance policy: `documents/Technical Documents/README.md`
- Phase completion log: `documents/Technical Documents/phase_completion_log.md`
- Requirement: when a phase is completed, update technical documents in `documents/Technical Documents/` in the same branch before sign-off.

## Prerequisites
- Node.js 20+
- npm 10+
- Docker (for Postgres + Redis) or an equivalent local Postgres/Redis setup

## Environment
Copy env templates:

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

## Start dependencies
```bash
docker compose up -d
```

Phase 3 local dependencies now include:
- Timescale-enabled PostgreSQL (via `timescale/timescaledb` image)
- NATS with JetStream (`localhost:4222`, monitor `localhost:8222`)

## Install dependencies
```bash
npm install
```

## Prisma setup
```bash
npm --workspace @robotops/api run prisma:generate
npm --workspace @robotops/api run prisma:migrate
npm --workspace @robotops/api run prisma:seed
```

The seed script is idempotent and safe to re-run during development.

## Run apps
In one terminal:
```bash
npm run dev
```

Or separately:
```bash
npm run dev:api
npm run dev:web
```

- Web: [http://localhost:3000](http://localhost:3000)
- API: [http://localhost:4000/api](http://localhost:4000/api)
- Health: [http://localhost:4000/api/health](http://localhost:4000/api/health)

## Seeded login users
- `owner@demo.com` / `password123`
- `ops@demo.com` / `password123`
- `engineer@demo.com` / `password123`

## Seed dataset snapshot
Current seed data includes richer cross-page coverage:
- 2 sites, 3 floorplans, 9 zones
- 3 robot vendors
- 12 robots across `online`, `offline`, `degraded`, `maintenance`, `emergency_stop`
- 10 missions + mission events
- 8 incidents + incident timeline events
- 6 RTLS assets + 8 proximity events
- 3 API keys, 8 audit log entries
- 3 copilot threads with seeded messages
- high-volume telemetry series for battery/temp/cpu/rssi

## Verification
```bash
npm run typecheck
npm run build
npm run qa:v1:phase1
npm run qa:v1:phase2
npm run qa:v1:phase3
npm run qa:v1:phase4
npm run qa:v1:phase5
npm run qa:phase1
npm run qa:phase2
npm run qa:phase3
```

## Adapter harness CLI (V1 Phase 5)
Set:

```bash
export ROBOTOPS_API_URL=http://localhost:4000/api
export ROBOTOPS_TOKEN=<jwt-token>
```

Record:

```bash
npm run adapter:record -- --vendor vendor_acme --site s1 --adapter demo_polling --duration 10 --out capture-demo-001
```

Replay:

```bash
npm run adapter:replay -- --capture capture-demo-001 --speed 1 --deterministic true
```

Validate against golden envelopes:

```bash
npm run adapter:validate -- --capture capture-demo-001 --expected ./path/to/golden-envelopes.json
```

Local capture files are written to `.data/adapter-captures/` (manifest + JSONL entries).

## Notes
- JWT tenant + role + permissions are issued by NextAuth credentials login.
- Backend enforces tenant scoping and RBAC for protected endpoints.
- Live channels emitted: `robots.live`, `incidents.live`, `missions.live`, `telemetry.live`.
- Phase 3 adds `alerts.live` plus `/system/pipeline-status` for ingestion/rollup readiness.
- Dashboard branding uses the RobotOps logo on login and shell navigation.
- Floorplan overlay assets use PNG files under `apps/web/public/static/floorplans`.
- New backend env vars for Phase 3: `NATS_URL`, `NATS_STREAM`, `NATS_SUBJECT_TELEMETRY`, `ROLLUP_JOB_INTERVAL_SECONDS`, `ALERT_ENGINE_INTERVAL_SECONDS`, `TIMESCALE_RAW_RETENTION_DAYS`, `TIMESCALE_ROLLUP_RETENTION_DAYS`.
