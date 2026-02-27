"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardMeta, CardTitle } from "@/components/ui/card";
import { PageTitle } from "@/components/pages/page-title";
import { DataTable, Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { useAuthedQuery } from "@/hooks/use-authed-query";
import { useLiveSocket } from "@/hooks/use-live-socket";
import { useSession } from "next-auth/react";

interface ApiKey {
  id: string;
  name: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
}

const REST_ENDPOINTS = [
  "GET /tenants/me",
  "GET /sites",
  "GET /floorplans?site_id={id}",
  "GET /robots?site_id={id}&status=online&tag=amr",
  "GET /robots/{id}",
  "POST /robots/{id}/actions",
  "GET /missions?site_id={id}&state=running",
  "POST /missions",
  "GET /missions/{id}",
  "GET /incidents?site_id={id}&status=open",
  "POST /incidents/{id}/ack",
  "POST /incidents/{id}/resolve",
  "GET /audit?resource_type=robot&resource_id={id}",
  "GET /telemetry/robot/{id}?metric=battery&from=...&to=...",
  "GET /rtls/assets?site_id={id}",
  "GET /copilot/thread/{id}",
  "POST /copilot/thread",
  "POST /copilot/message"
];

export default function DeveloperPage() {
  const { data: session } = useSession();
  const apiKeysQuery = useAuthedQuery<ApiKey[]>(["api-keys"], "/api-keys");
  const { socket, connected } = useLiveSocket();
  const [selectedEndpoint, setSelectedEndpoint] = useState(REST_ENDPOINTS[0]);
  const [streamLogs, setStreamLogs] = useState<string[]>([]);

  useMemo(() => {
    if (!socket) {
      return;
    }

    const channels = ["robots.live", "incidents.live", "missions.live", "telemetry.live"] as const;
    channels.forEach((channel) => {
      socket.on(channel, (payload) => {
        setStreamLogs((current) => [`${channel}: ${JSON.stringify(payload).slice(0, 140)}...`, ...current].slice(0, 12));
      });
    });

    return () => {
      channels.forEach((channel) => socket.off(channel));
    };
  }, [socket]);

  return (
    <div className="space-y-6">
      <PageTitle title="Developer" subtitle="API keys, endpoint explorer, WebSocket stream tester, and configuration guidance." />

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
                    <Td>{new Date(apiKey.createdAt).toLocaleString()}</Td>
                    <Td>{apiKey.lastUsedAt ? new Date(apiKey.lastUsedAt).toLocaleString() : "-"}</Td>
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
          <CardMeta>Read-only endpoint index with sample cURL</CardMeta>
          <select
            className="mt-3 w-full rounded-2xl border border-border bg-white px-3 py-2 text-sm"
            value={selectedEndpoint}
            onChange={(event) => setSelectedEndpoint(event.target.value)}
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
        <CardTitle>CLI setup guide</CardTitle>
        <CardMeta>Sandbox mode with dummy robot data</CardMeta>
        <pre className="mt-3 overflow-auto rounded-2xl border border-border bg-slate-950 p-3 text-xs text-slate-100">
{`export ROBOTOPS_API_URL=http://localhost:4000/api
export ROBOTOPS_TOKEN=<jwt-token>

curl "$ROBOTOPS_API_URL/robots?site_id=s1" -H "Authorization: Bearer $ROBOTOPS_TOKEN"

# WebSocket channel test (using socket.io-client)
# npm i socket.io-client
`}
        </pre>
      </Card>
    </div>
  );
}
