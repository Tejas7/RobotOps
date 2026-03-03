"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardMeta, CardTitle } from "@/components/ui/card";
import { JsonDiff } from "@/components/ui/json-diff";
import { PageTitle } from "@/components/pages/page-title";
import { DataTable, Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { useAuthedMutation } from "@/hooks/use-authed-mutation";
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
  live: {
    mode: "dual" | "delta_only";
    connected_clients: number;
    subscribed_clients: number;
    delta_messages_sent: number;
    legacy_messages_sent: number;
    delta_bytes_sent: number;
    legacy_bytes_sent: number;
    last_flush_at: string | null;
  };
  timescale: { extensionAvailable: boolean; hypertableReady: boolean; continuousAggregates: string[] };
}

interface AdapterHealthItem {
  id: string;
  site_id: string;
  vendor: string;
  adapter_name: string;
  status: "healthy" | "degraded" | "error" | "unknown";
  last_success_at: string | null;
  last_error_at: string | null;
  last_error: string | null;
  last_run_id: string | null;
  updated_at: string;
}

interface AdapterCaptureItem {
  capture_id: string;
  tenant_id: string;
  vendor: string;
  site_id: string;
  adapter_name: string;
  source_endpoint: string;
  start_time: string;
  end_time: string;
  capture_version: number;
  entry_count: number;
}

interface AdapterReplayRunDetail {
  id: string;
  capture_id: string;
  status: "started" | "running" | "completed" | "failed" | "canceled";
  started_at: string;
  ended_at: string | null;
  accepted_count: number;
  duplicate_count: number;
  failed_count: number;
  error_summary: string | null;
  events: Array<{
    id: string;
    message_id: string | null;
    message_type: string | null;
    result: "accepted" | "duplicate" | "failed";
    error: string | null;
    created_at: string;
  }>;
}

interface AdapterReplayResponse {
  run: {
    id: string;
    capture_id: string;
    status: "started" | "running" | "completed" | "failed" | "canceled";
    started_at: string;
    ended_at: string | null;
    accepted_count: number;
    duplicate_count: number;
    failed_count: number;
    error_summary: string | null;
  };
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
  "GET /adapters/health",
  "GET /adapters/captures?vendor=vendor_acme&site_id=s1",
  "POST /adapters/captures/record",
  "POST /adapters/replays",
  "GET /adapters/replays/{id}",
  "GET /alerts/events",
  "GET /rbac/scopes",
  "GET /system/pipeline-status"
];

export default function DeveloperPage() {
  const { data: session } = useSession();
  const apiKeysQuery = useAuthedQuery<ApiKey[]>(["api-keys"], "/api-keys");
  const pipelineStatusQuery = useAuthedQuery<PipelineStatus>(["pipeline-status"], "/system/pipeline-status");
  const adapterHealthQuery = useAuthedQuery<AdapterHealthItem[]>(["adapter-health"], "/adapters/health");
  const adapterCapturesQuery = useAuthedQuery<AdapterCaptureItem[]>(["adapter-captures"], "/adapters/captures");
  const replayMutation = useAuthedMutation<AdapterReplayResponse>();
  const { socket, connected } = useLiveSocket({
    siteId: "all",
    streams: ["robot_last_state", "incidents", "missions"]
  });

  const [selectedEndpoint, setSelectedEndpoint] = useState(REST_ENDPOINTS[0]);
  const [streamLogs, setStreamLogs] = useState<string[]>([]);
  const [auditResourceType, setAuditResourceType] = useState("all");
  const [auditAction, setAuditAction] = useState("");
  const [selectedAuditId, setSelectedAuditId] = useState("");
  const [selectedCaptureId, setSelectedCaptureId] = useState("");
  const [selectedReplayRunId, setSelectedReplayRunId] = useState("");

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
  const replayRunPath = selectedReplayRunId ? `/adapters/replays/${selectedReplayRunId}` : undefined;
  const replayRunQuery = useAuthedQuery<AdapterReplayRunDetail>(["adapter-replay-run", selectedReplayRunId], replayRunPath, {
    enabled: Boolean(replayRunPath)
  });

  useEffect(() => {
    if (!socket) {
      return;
    }

    socket.on("subscribed", (payload) => {
      setStreamLogs((current) => [`subscribed: ${JSON.stringify(payload).slice(0, 220)}...`, ...current].slice(0, 20));
    });
    socket.on("subscribe.error", (payload) => {
      setStreamLogs((current) => [`subscribe.error: ${JSON.stringify(payload).slice(0, 220)}...`, ...current].slice(0, 20));
    });
    socket.on("delta", (payload) => {
      setStreamLogs((current) => [`delta: ${JSON.stringify(payload).slice(0, 220)}...`, ...current].slice(0, 20));
    });

    return () => {
      socket.off("subscribed");
      socket.off("subscribe.error");
      socket.off("delta");
    };
  }, [socket]);

  useEffect(() => {
    if (!selectedCaptureId && (adapterCapturesQuery.data?.length ?? 0) > 0) {
      setSelectedCaptureId(adapterCapturesQuery.data?.[0]?.capture_id ?? "");
    }
  }, [adapterCapturesQuery.data, selectedCaptureId]);

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
        <CardMeta>Ingestion, bus, live transport, rollup freshness, and Timescale readiness</CardMeta>
        <div className="mt-3 grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-5">
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
            <p className="font-medium">Live transport</p>
            <p className="text-xs text-muted">
              {pipelineStatusQuery.data?.live.mode ?? "dual"} • subs {pipelineStatusQuery.data?.live.subscribed_clients ?? 0}
            </p>
            <p className="text-xs text-muted">
              delta {pipelineStatusQuery.data?.live.delta_messages_sent ?? 0} / legacy {pipelineStatusQuery.data?.live.legacy_messages_sent ?? 0}
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

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardTitle>Adapter capture and replay</CardTitle>
          <CardMeta>Record raw payload streams and run deterministic replay diagnostics</CardMeta>
          <label htmlFor="developer-capture-selector" className="sr-only">
            Select capture
          </label>
          <select
            id="developer-capture-selector"
            className="mt-3 w-full rounded-2xl border border-border bg-white px-3 py-2 text-sm"
            value={selectedCaptureId}
            onChange={(event) => setSelectedCaptureId(event.target.value)}
          >
            {(adapterCapturesQuery.data ?? []).map((capture) => (
              <option key={capture.capture_id} value={capture.capture_id}>
                {capture.capture_id} ({capture.vendor} / {capture.adapter_name} / {capture.entry_count} entries)
              </option>
            ))}
          </select>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => adapterCapturesQuery.refetch()}
              disabled={adapterCapturesQuery.isLoading}
            >
              Refresh captures
            </Button>
            <Button
              variant="secondary"
              disabled={!selectedCaptureId || replayMutation.isPending}
              onClick={() =>
                replayMutation.mutate(
                  {
                    path: "/adapters/replays",
                    method: "POST",
                    body: {
                      capture_id: selectedCaptureId,
                      deterministic_ordering: true,
                      replay_speed_multiplier: 1,
                      validation_only: true
                    }
                  },
                  {
                    onSuccess: (result) => setSelectedReplayRunId(result.run.id)
                  }
                )
              }
            >
              Validation replay
            </Button>
            <Button
              disabled={!selectedCaptureId || replayMutation.isPending}
              onClick={() =>
                replayMutation.mutate(
                  {
                    path: "/adapters/replays",
                    method: "POST",
                    body: {
                      capture_id: selectedCaptureId,
                      deterministic_ordering: true,
                      replay_speed_multiplier: 1
                    }
                  },
                  {
                    onSuccess: (result) => setSelectedReplayRunId(result.run.id)
                  }
                )
              }
            >
              Ingest replay
            </Button>
          </div>

          <div className="mt-3 rounded-2xl border border-border bg-surface p-3 text-sm">
            {replayMutation.isPending ? (
              <p className="text-muted">Running replay...</p>
            ) : replayMutation.error ? (
              <p className="text-rose-600">{String(replayMutation.error)}</p>
            ) : replayMutation.data ? (
              <div className="space-y-1 text-xs text-muted">
                <p>Run: {replayMutation.data.run.id}</p>
                <p>
                  status {replayMutation.data.run.status} • accepted {replayMutation.data.run.accepted_count} • duplicate{" "}
                  {replayMutation.data.run.duplicate_count} • failed {replayMutation.data.run.failed_count}
                </p>
              </div>
            ) : (
              <p className="text-muted">Select a capture and run replay.</p>
            )}
          </div>

          {replayRunQuery.data ? (
            <div className="mt-3 rounded-2xl border border-border bg-white p-3 text-xs text-muted">
              <p>
                Latest run detail: {replayRunQuery.data.id} ({replayRunQuery.data.status})
              </p>
              <p>
                events {replayRunQuery.data.events.length} • accepted {replayRunQuery.data.accepted_count} • duplicate{" "}
                {replayRunQuery.data.duplicate_count} • failed {replayRunQuery.data.failed_count}
              </p>
            </div>
          ) : null}
        </Card>

        <Card>
          <CardTitle>Adapter health</CardTitle>
          <CardMeta>Last success/error snapshots per tenant vendor adapter site</CardMeta>
          <div className="mt-3">
            <DataTable>
              <Table>
                <THead>
                  <tr>
                    <Th>Vendor / Adapter</Th>
                    <Th>Site</Th>
                    <Th>Status</Th>
                    <Th>Last success</Th>
                    <Th>Last error</Th>
                  </tr>
                </THead>
                <tbody>
                  {(adapterHealthQuery.data ?? []).map((row) => (
                    <Tr key={row.id}>
                      <Td>
                        {row.vendor} / {row.adapter_name}
                      </Td>
                      <Td>{row.site_id}</Td>
                      <Td>{row.status}</Td>
                      <Td>{row.last_success_at ? formatDate(row.last_success_at) : "-"}</Td>
                      <Td className="max-w-sm whitespace-normal text-xs text-muted">
                        {row.last_error_at ? `${formatDate(row.last_error_at)} ${row.last_error ? `- ${row.last_error}` : ""}` : "-"}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </DataTable>
          </div>
        </Card>
      </div>

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
