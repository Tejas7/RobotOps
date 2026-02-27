# Backend API Reference

Base URL: `http://localhost:4000/api`

## Authentication
- API routes are protected by JWT bearer auth unless explicitly public.
- Guard chain on protected controllers: `JwtAuthGuard` + `PermissionsGuard`.
- JWT payload fields used by API: `sub`, `tenantId`, `role`, `permissions`, `scope_version`.

## Public
| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/health` | public | Liveness payload (`ok`, `service`, `timestamp`). |

## Tenant/Facility/Fleet/Missions/Incidents
| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/tenants/me` | authenticated | Current tenant metadata. |
| GET | `/sites` | `robots.read` | Tenant site list. |
| GET | `/floorplans` | `robots.read` | Query: `site_id` (`all` supported). Includes zones. |
| GET | `/robots/last_state` | `robots.read` | Read-model route. Filters: `site_id,status,vendor,tag`. Returns `status`, `reported_status`, `is_offline_computed`. |
| GET | `/robots` | `robots.read` | Compatibility route (read-model sourced). Filters: `site_id,status,tag,vendor,capability,battery_min,battery_max`. |
| GET | `/robots/:id` | `robots.read` | Robot detail with dynamic live-state overlay from read model. |
| POST | `/robots/:id/actions` | `robots.control.*` or `robots.control` | Action request (`dock,pause,resume,speed_limit`). |
| GET | `/missions` | `missions.read` | Filters: `site_id,state`. |
| POST | `/missions` | `missions.create` or `missions.write` | Mission creation with route + zone ack checks. |
| GET | `/missions/:id` | `missions.read` | Mission detail + timeline + incidents. |
| GET | `/incidents` | `incidents.read` | Filters: `site_id,status,severity,category,robot`. |
| POST | `/incidents/:id/ack` | `incidents.ack` or `incidents.resolve` or `incidents.write` | Marks acknowledged + timeline append. |
| POST | `/incidents/:id/resolve` | `incidents.resolve` or `incidents.write` | Marks resolved + note + timeline append. |
| GET | `/rtls/assets` | `robots.read` | RTLS assets + recent proximity events. |

## Audit/Telemetry/Robot Path
| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/audit` | `audit.read` | Filters: `resource_type,resource_id,actor_id,action,from,to,cursor,limit`; cursor pagination. |
| GET | `/telemetry/robot/:id` | `telemetry.read` or `robots.read` | Query: `metric,from,to,max_points,bucket_seconds,aggregation`; downsample metadata included. |
| GET | `/robots/:id/path` | `robots.read` | Query: `from,to,interval_seconds,floorplan_id`; sampled playback points. |

## Saved Views
| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/saved-views` | authenticated | Query: `page`; returns `{items, defaults}` for current role. |
| POST | `/saved-views` | authenticated | Creates view (`page,name,filters,layout,is_shared`). |
| PATCH | `/saved-views/:id` | owner or `config.write` or Owner role | Partial update. |
| DELETE | `/saved-views/:id` | owner or `config.write` or Owner role | Also removes role defaults pointing to view. |
| POST | `/saved-views/:id/set-default` | `config.write` or Owner role | Sets role/page default view. |

## Integrations and Dashboard Config
| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/integrations` | `integrations.read` | Includes latest test runs. |
| POST | `/integrations` | `integrations.manage` | Create integration stub. |
| PATCH | `/integrations/:id` | `integrations.manage` | Update name/status/config. |
| POST | `/integrations/:id/test` | `integrations.test` or `integrations.manage` | Deterministic test run + status update. |
| GET | `/integrations/:id/test-runs` | `integrations.read` | Recent test run logs. |
| GET | `/api-keys` | `integrations.read` | Tenant API key metadata. |
| GET | `/dashboard-configs` | `config.read` | List dashboard config documents. |
| POST | `/dashboard-configs` | `config.write` | Create config doc (`schema_version=1`). |
| POST | `/dashboard-configs/validate` | `config.write` | Returns `{valid, errors[]}` from schema validation. |
| PATCH | `/dashboard-configs/:id` | `config.write` | Patch name/widgets/rules/applies_to. |
| POST | `/dashboard-configs/:id/activate` | `config.write` | Single-active config switch for tenant. |

## Analytics
| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/analytics/dashboard` | `analytics.read.site` or `analytics.read.cross_site` or `analytics.read` | Query: `site_id,site_ids,from,to,granularity,use_rollups`. |
| GET | `/analytics/cross-site` | `analytics.read.cross_site` or `analytics.read` | Cross-site rollup response by site/trend. |
| GET | `/analytics/export` | `analytics.export` | Query: `format=csv|pdf`, `dataset=dashboard|cross_site`, + window/site params. |

## Canonical Ingestion (V1 Phase 1 + Phase 3)
| Method | Path | Permission | Notes |
|---|---|---|---|
| POST | `/ingest/telemetry` | `telemetry.ingest` | Accepts strict canonical envelope only. `schema_version=1` accepted. Persists `CanonicalMessage` + `IngestionEvent`, publishes to NATS stub. |

Canonical envelope required fields:
- `message_id` (UUID)
- `schema_version`
- `tenant_id`
- `site_id`
- `message_type` (`robot_state|robot_event|task_status`)
- `timestamp` (RFC3339)
- `source` (`source_type,source_id,vendor,protocol`)
- `entity` (`entity_type=robot,robot_id`)
- `payload` (validated by `message_type`)

## Alerting and RBAC Phase 3 APIs
| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/alerts/rules` | `alerts.read` | List alert rules with policy context. |
| POST | `/alerts/rules` | `alerts.manage` | Create rule (`incident` or `integration_error`). |
| PATCH | `/alerts/rules/:id` | `alerts.manage` | Patch rule. |
| DELETE | `/alerts/rules/:id` | `alerts.manage` | Delete rule. |
| GET | `/alerts/policies` | `alerts.read` | List policies with ordered steps. |
| POST | `/alerts/policies` | `alerts.manage` | Create policy + steps. |
| PATCH | `/alerts/policies/:id` | `alerts.manage` | Transactional policy update. |
| DELETE | `/alerts/policies/:id` | `alerts.manage` | Blocked when active rules reference policy. |
| GET | `/alerts/events` | `alerts.read` | Filters: `state,severity,site_id,incident_id,cursor,limit`. |
| POST | `/alerts/events/:id/ack` | `alerts.manage` | Acknowledge event and cancel pending deliveries. |
| POST | `/alerts/test-route` | `alerts.manage` | Deterministic dry-run rule matching + simulated events/deliveries. |
| GET | `/rbac/scopes` | `rbac.read` | Scope catalog, aliases, deprecated scopes, version. |
| GET | `/rbac/roles` | `rbac.read` | Role base/effective scope matrix with tenant overrides. |
| PATCH | `/rbac/roles/:role` | `rbac.write` | Upsert role scope overrides (`allow_scopes`,`deny_scopes`). |
| GET | `/system/pipeline-status` | `config.read` | NATS, ingestion queue, rollup freshness, Timescale status. |

## Copilot APIs
Controller prefix: `/copilot`

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/copilot/thread/:id` | `missions.read` | Thread + messages. |
| POST | `/copilot/thread` | `missions.read` | Create thread (optional `site_id`). |
| POST | `/copilot/message` | `missions.read` | Add user message and generate assistant response using tenant-scoped internal queries. |
