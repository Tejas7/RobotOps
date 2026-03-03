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
- V1 Phase 6 primary subscription protocol:
  - client emits `subscribe` (`site_id`, `streams`, `cursor`)
  - server responds with `subscribed` or `subscribe.error`
  - client receives `delta` envelopes (`stream`, `cursor`, `upserts`, `deletes`, `snapshot`, batching fields)
- Reconciliation helper:
  - `apps/web/lib/live-reconcile.ts`
  - ignores stale/equal cursors and applies id-based upsert/delete merges.
- Dual-mode compatibility:
  - legacy channels are still accepted in `dual` mode, but migrated pages consume `delta`.

## Page-Level Technical Responsibilities

### `/overview`
- Site/time/saved-view controls are in-page and URL-synced.
- Uses:
  - `/sites`, `/saved-views?page=overview`
  - `/robots/last_state`, `/missions`, `/incidents`, `/floorplans`
- Features:
  - Save current view, apply saved view, set role default.
  - Applies role default view if URL has no explicit filter.
  - KPI cards and charts.
  - Live robot/incident updates via `delta` streams (`robot_last_state`, `incidents`).

### `/fleet`
- Filtered robot table and robot details drawer.
- Uses:
  - `/robots/last_state`, `/robots/:id`
  - `/missions`, `/incidents`
  - `/telemetry/robot/:id`, `/audit`
  - `/robots/:id/actions`
- Features:
  - Telemetry metric/range controls + CSV export.
  - RBAC-aware action controls.
  - Robot list state reconciles from `robot_last_state` deltas.

### `/facility`
- Facility map with layer toggles and playback controls.
- Uses:
  - `/floorplans`, `/robots/last_state`, `/rtls/assets`
  - `/robots/:id/path`
- Features:
  - Path playback scrubber/trails.
  - Proximity event panel.
  - Robot marker layer reconciles from `robot_last_state` deltas.

### `/missions`
- Mission table, mission detail drawer, create-mission drawer.
- Uses:
  - `/missions`, `/robots/last_state`, `/missions/:id`, `/missions` (POST).
- Uses shared `missionCreateSchema` for form validation.
- Mission table state reconciles from `missions` deltas.

### `/incidents`
- Incident table + detail drawer with workflows.
- Uses:
  - `/incidents`, `/incidents/:id/ack`, `/incidents/:id/resolve`
  - `/integrations`, `/alerts/events?incident_id=...`, `/alerts/events/:id/ack`
- Features:
  - Automation hook status panel.
  - Alert escalation timeline panel.
  - Incident list state reconciles from `incidents` deltas.

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
  - `/vendor-site-maps` + `/vendor-site-maps/preview`
  - `/rbac/scopes`, `/rbac/roles`, `/rbac/roles/:role`
  - `/alerts/policies`, `/alerts/rules`, `/alerts/test-route`
- Features:
  - Vendor map mapping list/create/edit/delete flows.
  - Visual transform editor with draggable origin/axis/sample handles.
  - Live preview of transformed output points from `/vendor-site-maps/preview`.

### `/developer`
- Platform diagnostics and tooling surface.
- Uses:
  - `/api-keys`, `/audit`, `/system/pipeline-status`
- Features:
  - WebSocket stream tester log for `subscribed`/`subscribe.error`/`delta`.
  - Structured audit diff drilldown.
  - Token-aware API explorer command snippets including `/robots/last_state`.

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
