"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardMeta, CardTitle } from "@/components/ui/card";
import { PageTitle } from "@/components/pages/page-title";
import { useAuthedMutation } from "@/hooks/use-authed-mutation";
import { useAuthedQuery } from "@/hooks/use-authed-query";
import { formatDate } from "@/lib/utils";

interface IntegrationTestRun {
  id: string;
  status: "success" | "error";
  message: string;
  details: Record<string, unknown>;
  createdAt: string;
}

interface Integration {
  id: string;
  type: string;
  name: string;
  status: "active" | "disabled" | "error";
  config: Record<string, unknown>;
  lastSyncAt: string | null;
  testRuns: IntegrationTestRun[];
}

export default function IntegrationsPage() {
  const integrationsQuery = useAuthedQuery<Integration[]>(["integrations"], "/integrations");
  const createMutation = useAuthedMutation<Integration>();
  const patchMutation = useAuthedMutation<Integration>();
  const testMutation = useAuthedMutation<{ integration: Integration; run: IntegrationTestRun }>();

  const [name, setName] = useState("New Connector");
  const [type, setType] = useState("webhook");
  const [configText, setConfigText] = useState('{"endpoint":"https://example.internal/hook"}');
  const [selectedIntegrationId, setSelectedIntegrationId] = useState("");

  const selectedIntegration = useMemo(
    () => (integrationsQuery.data ?? []).find((entry) => entry.id === selectedIntegrationId) ?? null,
    [integrationsQuery.data, selectedIntegrationId]
  );

  const testRunsQuery = useAuthedQuery<IntegrationTestRun[]>(
    ["integration-test-runs", selectedIntegrationId],
    selectedIntegrationId ? `/integrations/${selectedIntegrationId}/test-runs` : undefined
  );

  async function createIntegration() {
    let config: Record<string, unknown>;
    try {
      config = JSON.parse(configText) as Record<string, unknown>;
    } catch {
      alert("Config must be valid JSON.");
      return;
    }

    await createMutation.mutateAsync({
      path: "/integrations",
      method: "POST",
      body: {
        type,
        name,
        config
      }
    });

    await integrationsQuery.refetch();
  }

  async function testConnection(integrationId: string) {
    await testMutation.mutateAsync({
      path: `/integrations/${integrationId}/test`,
      method: "POST"
    });
    await integrationsQuery.refetch();
    if (selectedIntegrationId === integrationId) {
      await testRunsQuery.refetch();
    }
  }

  async function toggleStatus(integration: Integration) {
    await patchMutation.mutateAsync({
      path: `/integrations/${integration.id}`,
      method: "PATCH",
      body: {
        status: integration.status === "disabled" ? "active" : "disabled"
      }
    });
    await integrationsQuery.refetch();
  }

  return (
    <div className="space-y-6">
      <PageTitle title="Integrations" subtitle="Connector catalog, connect wizard, test connection, and sync status/error logs." />

      <Card>
        <CardTitle>Connect wizard</CardTitle>
        <CardMeta>Create deterministic integration stubs for platform workflows</CardMeta>
        <div className="mt-3 grid gap-2 md:grid-cols-4">
          <input
            className="rounded-2xl border border-border bg-white px-3 py-2 text-sm"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Connector name"
            aria-label="Connector name"
          />
          <select
            className="rounded-2xl border border-border bg-white px-3 py-2 text-sm"
            value={type}
            onChange={(event) => setType(event.target.value)}
            aria-label="Connector type"
          >
            {[
              "webhook",
              "wms",
              "erp",
              "wes",
              "slack",
              "teams",
              "email",
              "sso",
              "rtls_partner"
            ].map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
          <Button onClick={() => void createIntegration()}>Create connector</Button>
        </div>
        <textarea
          className="mt-3 h-28 w-full rounded-2xl border border-border bg-white p-3 font-mono text-xs"
          value={configText}
          onChange={(event) => setConfigText(event.target.value)}
          aria-label="Connector config JSON"
        />
      </Card>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardTitle>Integration catalog</CardTitle>
          <CardMeta>Connection state and deterministic test run actions</CardMeta>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {(integrationsQuery.data ?? []).map((integration) => (
              <div
                key={integration.id}
                className={`rounded-2xl border p-4 text-left ${selectedIntegrationId === integration.id ? "border-primary bg-surface" : "border-border bg-white"}`}
                onClick={() => setSelectedIntegrationId(integration.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedIntegrationId(integration.id);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-pressed={selectedIntegrationId === integration.id}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{integration.name}</p>
                  <span className="rounded-full border border-border px-2 py-0.5 text-[11px]">{integration.status}</span>
                </div>
                <p className="mt-1 text-xs text-muted">{integration.type}</p>
                <p className="mt-1 text-xs text-muted">
                  Last sync: {integration.lastSyncAt ? formatDate(integration.lastSyncAt) : "Never"}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button
                    className="px-3 py-1.5 text-xs"
                    onClick={(event) => {
                      event.stopPropagation();
                      void testConnection(integration.id);
                    }}
                  >
                    Test connection
                  </Button>
                  <Button
                    variant="secondary"
                    className="px-3 py-1.5 text-xs"
                    onClick={(event) => {
                      event.stopPropagation();
                      void toggleStatus(integration);
                    }}
                  >
                    {integration.status === "disabled" ? "Enable" : "Disable"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardTitle>Sync status and error logs</CardTitle>
          <CardMeta>
            {selectedIntegration ? `Recent test runs for ${selectedIntegration.name}` : "Select an integration card to inspect runs"}
          </CardMeta>
          <div className="mt-3 space-y-2 text-sm">
            {(testRunsQuery.data ?? []).map((run) => (
              <div key={run.id} className="rounded-2xl border border-border bg-surface p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{run.status}</p>
                  <p className="text-xs text-muted">{formatDate(run.createdAt)}</p>
                </div>
                <p className="mt-1 text-xs text-muted">{run.message}</p>
              </div>
            ))}
            {!selectedIntegration ? <p className="text-xs text-muted">No integration selected.</p> : null}
          </div>
        </Card>
      </section>
    </div>
  );
}
