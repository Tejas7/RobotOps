"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardMeta, CardTitle } from "@/components/ui/card";
import { JsonDiff } from "@/components/ui/json-diff";
import { PageTitle } from "@/components/pages/page-title";
import { DataTable, Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { useAuthedQuery } from "@/hooks/use-authed-query";
import { useLiveSocket } from "@/hooks/use-live-socket";
import { useSession } from "next-auth/react";
import { formatDate } from "@/lib/utils";

interface ApiKey {
  id: string;
  name: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
}

interface AuditItem {
  id: string;
  timestamp: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  diff: unknown;
}

interface AuditResponse {
  items: AuditItem[];
  next_cursor: string | null;
}

interface PipelineStatus {
  timestamp: string;
  nats: { connected: boolean; stream: string; subject: string };
  ingestion: { queued: number; processed: number; failed: number; deadLetters: number };
  rollups: { siteHourlyLatest: string | null; tenantHourlyLatest: string | null; freshnessSeconds: number | null };
  timescale: { extensionAvailable: boolean; hypertableReady: boolean; continuousAggregates: string[] };
}

const REST_ENDPOINTS = [
  "GET /tenants/me",
  "GET /sites",
  "GET /floorplans?site_id={id}",
  "GET /robots/last_state?site_id={id}&status=online&tag=amr",
  "GET /robots/{id}",
  "GET /robots/{id}/path",
  "POST /robots/{id}/actions",
  "GET /missions?site_id={id}&state=running",
  "POST /missions",
  "GET /missions/{id}",
  "GET /incidents?site_id={id}&status=open",
  "POST /incidents/{id}/ack",
  "POST /incidents/{id}/resolve",
  "GET /audit?resource_type=robot&resource_id={id}",
  "GET /telemetry/robot/{id}?metric=battery&from=...&to=...",
  "GET /saved-views?page=overview",
  "POST /saved-views",
  "GET /integrations",
  "POST /integrations/{id}/test",
  "GET /dashboard-configs",
  "POST /dashboard-configs/validate",
  "GET /vendor-site-maps?site_id={id}&vendor=vendor_acme",
  "POST /vendor-site-maps",
  "POST /vendor-site-maps/preview",
  "GET /analytics/dashboard",
  "GET /analytics/cross-site?site_id=all",
  "POST /ingest/telemetry (robot_event payload requires dedupe_key; sequence supported)",
  "GET /alerts/events",
  "GET /rbac/scopes",
  "GET /system/pipeline-status"
];

export default function DeveloperPage() {
  const { data: session } = useSession();
  const apiKeysQuery = useAuthedQuery<ApiKey[]>(["api-keys"], "/api-keys");
  const pipelineStatusQuery = useAuthedQuery<PipelineStatus>(["pipeline-status"], "/system/pipeline-status");
  const { socket, connected } = useLiveSocket();

  const [selectedEndpoint, setSelectedEndpoint] = useState(REST_ENDPOINTS[0]);
  const [streamLogs, setStreamLogs] = useState<string[]>([]);
  const [auditResourceType, setAuditResourceType] = useState("all");
  const [auditAction, setAuditAction] = useState("");
  const [selectedAuditId, setSelectedAuditId] = useState("");

  const auditPath = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", "100");
    if (auditResourceType !== "all") {
      params.set("resource_type", auditResourceType);
    }
    if (auditAction.trim()) {
      params.set("action", auditAction.trim());
    }
    return `/audit?${params.toString()}`;
  }, [auditAction, auditResourceType]);

  const auditQuery = useAuthedQuery<AuditResponse>(["developer-audit", auditPath], auditPath);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const channels = ["robots.live", "incidents.live", "missions.live", "telemetry.live", "alerts.live"] as const;
    channels.forEach((channel) => {
      socket.on(channel, (payload) => {
        setStreamLogs((current) => [`${channel}: ${JSON.stringify(payload).slice(0, 180)}...`, ...current].slice(0, 20));
      });
    });

    return () => {
      channels.forEach((channel) => socket.off(channel));
    };
  }, [socket]);

  const selectedAudit = (auditQuery.data?.items ?? []).find((entry) => entry.id === selectedAuditId) ?? null;

  return (
    <div className="space-y-6">
      <PageTitle title="Developer" subtitle="API keys, endpoint explorer, stream tester, and audit diff drilldowns." />

      <Card>
        <CardTitle>API keys and scopes</CardTitle>
        <CardMeta>Tenant-scoped key metadata for integrations and automation</CardMeta>
        <div className="mt-3">
          <DataTable>
            <Table>
              <THead>
                <tr>
                  <Th>Name</Th>
                  <Th>Scopes</Th>
                  <Th>Created</Th>
                  <Th>Last used</Th>
                </tr>
              </THead>
              <tbody>
                {(apiKeysQuery.data ?? []).map((apiKey) => (
                  <Tr key={apiKey.id}>
                    <Td>{apiKey.name}</Td>
                    <Td className="max-w-sm whitespace-normal text-xs text-muted">{apiKey.scopes.join(", ")}</Td>
                    <Td>{formatDate(apiKey.createdAt)}</Td>
                    <Td>{apiKey.lastUsedAt ? formatDate(apiKey.lastUsedAt) : "-"}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </DataTable>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardTitle>API explorer (REST)</CardTitle>
          <CardMeta>Endpoint index with token-aware cURL</CardMeta>
          <label htmlFor="developer-endpoint-selector" className="sr-only">
            Select API endpoint
          </label>
          <select
            id="developer-endpoint-selector"
            className="mt-3 w-full rounded-2xl border border-border bg-white px-3 py-2 text-sm"
            value={selectedEndpoint}
            onChange={(event) => setSelectedEndpoint(event.target.value)}
            aria-label="Select API endpoint"
          >
            {REST_ENDPOINTS.map((endpoint) => (
              <option key={endpoint} value={endpoint}>
                {endpoint}
              </option>
            ))}
          </select>
          <pre className="mt-3 overflow-auto rounded-2xl border border-border bg-slate-950 p-3 text-xs text-slate-100">
{`curl -X ${selectedEndpoint.split(" ")[0]} \\
  "http://localhost:4000/api${selectedEndpoint.split(" ")[1]}" \\
  -H "Authorization: Bearer ${session?.accessToken ?? "<token>"}" \\
  -H "Content-Type: application/json"`}
          </pre>
        </Card>

        <Card>
          <CardTitle>WebSocket stream tester</CardTitle>
          <CardMeta>Connection status and sample channel payloads</CardMeta>
          <div className="mt-3 flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${connected ? "bg-green-500" : "bg-rose-500"}`} />
            <p className="text-sm">{connected ? "Connected" : "Disconnected"}</p>
            <Button variant="secondary" onClick={() => setStreamLogs([])} className="ml-auto">
              Clear logs
            </Button>
          </div>

          <div className="mt-3 h-64 overflow-auto rounded-2xl border border-border bg-slate-950 p-3 font-mono text-xs text-slate-100">
            {streamLogs.length ? streamLogs.map((line, index) => <p key={`${line}-${index}`}>{line}</p>) : <p>No stream messages yet.</p>}
          </div>
        </Card>
      </div>

      <Card>
        <CardTitle>Pipeline status</CardTitle>
        <CardMeta>Ingestion, bus, rollup freshness, and Timescale readiness</CardMeta>
        <div className="mt-3 grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-border bg-surface p-3">
            <p className="font-medium">NATS</p>
            <p className="text-xs text-muted">
              {pipelineStatusQuery.data?.nats.connected ? "Connected" : "Disconnected"} • {pipelineStatusQuery.data?.nats.stream ?? "-"}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-3">
            <p className="font-medium">Ingestion queue</p>
            <p className="text-xs text-muted">
              queued {pipelineStatusQuery.data?.ingestion.queued ?? 0} • failed {pipelineStatusQuery.data?.ingestion.failed ?? 0}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-3">
            <p className="font-medium">Rollups</p>
            <p className="text-xs text-muted">
              freshness {pipelineStatusQuery.data?.rollups.freshnessSeconds ?? "-"}s
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-3">
            <p className="font-medium">Timescale</p>
            <p className="text-xs text-muted">
              ext {pipelineStatusQuery.data?.timescale.extensionAvailable ? "on" : "off"} • hypertable{" "}
              {pipelineStatusQuery.data?.timescale.hypertableReady ? "ready" : "pending"}
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle>Audit log explorer</CardTitle>
        <CardMeta>Queryable audit records with structured diff rendering</CardMeta>
        <div className="mt-3 grid gap-2 md:grid-cols-[220px_1fr_auto]">
          <label htmlFor="developer-audit-resource-filter" className="sr-only">
            Filter audit by resource
          </label>
          <select
            id="developer-audit-resource-filter"
            className="rounded-2xl border border-border bg-white px-3 py-2 text-sm"
            value={auditResourceType}
            onChange={(event) => setAuditResourceType(event.target.value)}
            aria-label="Filter audit by resource"
          >
            <option value="all">All resources</option>
            <option value="robot">Robot</option>
            <option value="mission">Mission</option>
            <option value="incident">Incident</option>
            <option value="integration">Integration</option>
            <option value="config">Config</option>
          </select>
          <input
            className="rounded-2xl border border-border bg-white px-3 py-2 text-sm"
            value={auditAction}
            onChange={(event) => setAuditAction(event.target.value)}
            placeholder="Filter action contains..."
          />
          <Button variant="secondary" onClick={() => auditQuery.refetch()}>
            Refresh
          </Button>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_1fr]">
          <DataTable>
            <Table>
              <THead>
                <tr>
                  <Th>Timestamp</Th>
                  <Th>Action</Th>
                  <Th>Resource</Th>
                  <Th>Actor</Th>
                </tr>
              </THead>
              <tbody>
                {(auditQuery.data?.items ?? []).map((entry) => (
                  <Tr
                    key={entry.id}
                    className={`cursor-pointer ${selectedAuditId === entry.id ? "bg-surface" : ""}`}
                    onClick={() => setSelectedAuditId(entry.id)}
                  >
                    <Td>{formatDate(entry.timestamp)}</Td>
                    <Td>{entry.action}</Td>
                    <Td>
                      {entry.resourceType} / {entry.resourceId}
                    </Td>
                    <Td>{entry.actorId}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </DataTable>

          <div className="space-y-2">
            <CardTitle>Audit diff</CardTitle>
            {selectedAudit ? (
              <JsonDiff diff={selectedAudit.diff} />
            ) : (
              <p className="text-sm text-muted">Select an audit row to inspect structured before/after data.</p>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle>CLI setup guide</CardTitle>
        <CardMeta>Sandbox mode with dummy robot data</CardMeta>
        <pre className="mt-3 overflow-auto rounded-2xl border border-border bg-slate-950 p-3 text-xs text-slate-100">
{`export ROBOTOPS_API_URL=http://localhost:4000/api
export ROBOTOPS_TOKEN=<jwt-token>

curl "$ROBOTOPS_API_URL/robots/last_state?site_id=s1" -H "Authorization: Bearer $ROBOTOPS_TOKEN"
curl "$ROBOTOPS_API_URL/audit?resource_type=robot&limit=25" -H "Authorization: Bearer $ROBOTOPS_TOKEN"
`}
        </pre>
      </Card>
    </div>
  );
}
