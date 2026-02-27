# Frontend Architecture

Frontend app root: `apps/web` (Next.js 16, App Router, TypeScript, Tailwind).

## Route and Layout Structure
- Auth route group: `app/(auth)`
  - `/login` (credentials sign-in).
- Dashboard route group: `app/(dashboard)`
  - Shared shell via `app/(dashboard)/layout.tsx`:
    - Left sidebar navigation.
    - Top header (search, notification icon, profile menu with `Profile` + `Sign out`).
    - Per-page main content.

## Navigation Pages
Primary pages under dashboard:
- `/overview`
- `/fleet`
- `/missions`
- `/facility`
- `/incidents`
- `/teleoperation`
- `/analytics`
- `/integrations`
- `/developer`
- `/settings`
- `/copilot`
- `/profile`

Navigation source: `apps/web/lib/constants.ts`

## State and Data Flow
- Session/auth state:
  - `next-auth` session from credentials provider.
  - Access token attached to each API request.
- Global UI filters:
  - Zustand store `useGlobalFilters` (`siteId`, `timeRange`).
  - URL sync using search params in pages and header.
- Data fetching/mutations:
  - `useAuthedQuery` and `useAuthedMutation` wrappers over `apiFetch`.
  - Base API URL from `NEXT_PUBLIC_API_BASE_URL`.

## Realtime Client
Hook: `apps/web/hooks/use-live-socket.ts`
- Connects to `NEXT_PUBLIC_SOCKET_URL` via Socket.IO.
- Sends JWT in `auth.token`.
- Subscribes to channels:
  - `robots.live`, `incidents.live`, `missions.live`, `telemetry.live`, `alerts.live`.

## Page-Level Technical Responsibilities

### `/overview`
- Site/time/saved-view controls are in-page and URL-synced.
- Uses:
  - `/sites`, `/saved-views?page=overview`
  - `/robots`, `/missions`, `/incidents`, `/floorplans`
- Features:
  - Save current view, apply saved view, set role default.
  - Applies role default view if URL has no explicit filter.
  - KPI cards and charts.
  - Live robot/incident updates.

### `/fleet`
- Filtered robot table and robot details drawer.
- Uses:
  - `/robots`, `/robots/:id`
  - `/missions`, `/incidents`
  - `/telemetry/robot/:id`, `/audit`
  - `/robots/:id/actions`
- Features:
  - Telemetry metric/range controls + CSV export.
  - RBAC-aware action controls.

### `/facility`
- Facility map with layer toggles and playback controls.
- Uses:
  - `/floorplans`, `/robots`, `/rtls/assets`
  - `/robots/:id/path`
- Features:
  - Path playback scrubber/trails.
  - Proximity event panel.

### `/missions`
- Mission table, mission detail drawer, create-mission drawer.
- Uses:
  - `/missions`, `/robots`, `/missions/:id`, `/missions` (POST).
- Uses shared `missionCreateSchema` for form validation.

### `/incidents`
- Incident table + detail drawer with workflows.
- Uses:
  - `/incidents`, `/incidents/:id/ack`, `/incidents/:id/resolve`
  - `/integrations`, `/alerts/events?incident_id=...`, `/alerts/events/:id/ack`
- Features:
  - Automation hook status panel.
  - Alert escalation timeline panel.

### `/analytics`
- Dashboard KPIs/charts and export actions.
- Uses:
  - `/analytics/dashboard`
  - `/analytics/cross-site` when `site_id=all`
  - `/analytics/export` (CSV/PDF).

### `/integrations`
- Connector catalog + create wizard + deterministic test flow.
- Uses:
  - `/integrations` (GET/POST/PATCH)
  - `/integrations/:id/test`
  - `/integrations/:id/test-runs`

### `/settings`
- Configuration-as-code editor and platform settings.
- Uses:
  - `/dashboard-configs` + `/dashboard-configs/validate` + activation path
  - `/rbac/scopes`, `/rbac/roles`, `/rbac/roles/:role`
  - `/alerts/policies`, `/alerts/rules`, `/alerts/test-route`

### `/developer`
- Platform diagnostics and tooling surface.
- Uses:
  - `/api-keys`, `/audit`, `/system/pipeline-status`
- Features:
  - WebSocket stream tester log.
  - Structured audit diff drilldown.
  - Token-aware API explorer command snippets.

### `/copilot`
- Threaded copilot UI with citations and suggestion confirmations.
- Uses:
  - `/copilot/thread/:id`, `/copilot/thread` (POST), `/copilot/message`.

### `/profile`
- Displays account identity, role, permissions, tenant details.
- Uses:
  - `/tenants/me`.

## Branding Components
- Logo component: `apps/web/components/brand/robotops-logo.tsx`.
- Assets: `apps/web/public/static/brand/robotops-mark.svg`.
- Login page places enlarged RobotOps logo/title above sign-in card.
