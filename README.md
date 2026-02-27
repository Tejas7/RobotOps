# RobotOps

Robotics operations and orchestration dashboard for heterogeneous fleets.

## Monorepo layout
- `apps/web`: Next.js 16 frontend (TypeScript, Tailwind, NextAuth, TanStack Query, Zustand, Recharts, MapLibre)
- `apps/api`: NestJS backend (TypeScript, Prisma, WebSocket live gateway)
- `packages/shared`: shared RBAC constants, domain types, and Zod schemas

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
npm run qa:phase1
```

## Notes
- JWT tenant + role + permissions are issued by NextAuth credentials login.
- Backend enforces tenant scoping and RBAC for protected endpoints.
- Live channels emitted: `robots.live`, `incidents.live`, `missions.live`, `telemetry.live`.
- Phase 1 includes working page implementations plus integration/analytics/settings placeholders.
- Floorplan overlay assets use PNG files under `apps/web/public/static/floorplans`.
