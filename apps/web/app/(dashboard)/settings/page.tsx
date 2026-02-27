"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardMeta, CardTitle } from "@/components/ui/card";
import { PageTitle } from "@/components/pages/page-title";
import { useAuthedMutation } from "@/hooks/use-authed-mutation";
import { useAuthedQuery } from "@/hooks/use-authed-query";
import { formatDate } from "@/lib/utils";

interface DashboardConfig {
  id: string;
  name: string;
  schemaVersion: string;
  widgets: Array<Record<string, unknown>>;
  rules: Record<string, unknown>;
  appliesTo: Record<string, unknown>;
  isActive: boolean;
  updatedAt: string;
}

interface ValidationResponse {
  valid: boolean;
  errors: Array<{ path: string; message: string }>;
}

function defaultConfigPayload() {
  return {
    name: "New dashboard config",
    schema_version: "1",
    widgets: [{ id: "kpi_active_robots", type: "kpi", metric: "active_robots" }],
    rules: { refreshSeconds: 30 },
    applies_to: { robot_tags: [], site_ids: [], roles: [] }
  };
}

function toEditorPayload(config: DashboardConfig) {
  return {
    name: config.name,
    schema_version: config.schemaVersion,
    widgets: config.widgets,
    rules: config.rules,
    applies_to: config.appliesTo
  };
}

export default function SettingsPage() {
  const configsQuery = useAuthedQuery<DashboardConfig[]>(["dashboard-configs"], "/dashboard-configs");
  const createMutation = useAuthedMutation<DashboardConfig>();
  const patchMutation = useAuthedMutation<DashboardConfig>();
  const activateMutation = useAuthedMutation<DashboardConfig>();
  const validateMutation = useAuthedMutation<ValidationResponse>();

  const [selectedConfigId, setSelectedConfigId] = useState("");
  const [editorText, setEditorText] = useState(JSON.stringify(defaultConfigPayload(), null, 2));
  const [validation, setValidation] = useState<ValidationResponse | null>(null);

  const selectedConfig = useMemo(
    () => (configsQuery.data ?? []).find((entry) => entry.id === selectedConfigId) ?? null,
    [configsQuery.data, selectedConfigId]
  );

  useEffect(() => {
    if (!selectedConfig) {
      return;
    }
    setEditorText(JSON.stringify(toEditorPayload(selectedConfig), null, 2));
  }, [selectedConfig]);

  function parseEditor(): Record<string, unknown> | null {
    try {
      return JSON.parse(editorText) as Record<string, unknown>;
    } catch {
      alert("Editor content must be valid JSON.");
      return null;
    }
  }

  async function validateConfig() {
    const parsed = parseEditor();
    if (!parsed) {
      return;
    }

    const result = await validateMutation.mutateAsync({
      path: "/dashboard-configs/validate",
      method: "POST",
      body: parsed
    });

    setValidation(result);
  }

  async function saveConfig() {
    const parsed = parseEditor();
    if (!parsed) {
      return;
    }

    if (selectedConfigId) {
      await patchMutation.mutateAsync({
        path: `/dashboard-configs/${selectedConfigId}`,
        method: "PATCH",
        body: {
          name: parsed.name,
          widgets: parsed.widgets,
          rules: parsed.rules,
          applies_to: parsed.applies_to
        }
      });
    } else {
      await createMutation.mutateAsync({
        path: "/dashboard-configs",
        method: "POST",
        body: parsed
      });
    }

    await configsQuery.refetch();
  }

  async function activateConfig(id: string) {
    await activateMutation.mutateAsync({
      path: `/dashboard-configs/${id}/activate`,
      method: "POST"
    });
    await configsQuery.refetch();
  }

  return (
    <div className="space-y-6">
      <PageTitle title="Settings" subtitle="Tenant, role, dashboard, and policy settings with configuration-as-code workflow." />

      <section className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
        <Card>
          <div className="flex items-center gap-2">
            <CardTitle>Dashboard configs</CardTitle>
            <Button
              className="ml-auto"
              variant="secondary"
              onClick={() => {
                setSelectedConfigId("");
                setEditorText(JSON.stringify(defaultConfigPayload(), null, 2));
                setValidation(null);
              }}
            >
              New config
            </Button>
          </div>
          <CardMeta>Select, activate, and edit schema-driven dashboard documents</CardMeta>
          <div className="mt-3 space-y-2 text-sm">
            {(configsQuery.data ?? []).map((config) => (
              <button
                type="button"
                key={config.id}
                className={`w-full rounded-2xl border p-3 text-left ${selectedConfigId === config.id ? "border-primary bg-surface" : "border-border bg-white"}`}
                onClick={() => {
                  setSelectedConfigId(config.id);
                  setValidation(null);
                }}
              >
                <div className="flex items-center gap-2">
                  <p className="font-medium">{config.name}</p>
                  {config.isActive ? <span className="rounded-full border border-emerald-400 px-2 py-0.5 text-[11px]">active</span> : null}
                </div>
                <p className="text-xs text-muted">Updated {formatDate(config.updatedAt)}</p>
                <Button
                  variant="secondary"
                  className="mt-2 px-3 py-1.5 text-xs"
                  onClick={(event) => {
                    event.stopPropagation();
                    void activateConfig(config.id);
                  }}
                >
                  Activate
                </Button>
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <CardTitle>Configuration as code editor</CardTitle>
          <CardMeta>Schema version 1 with validation feedback before save</CardMeta>
          <textarea
            className="mt-3 h-[420px] w-full rounded-2xl border border-border bg-white p-3 font-mono text-xs"
            value={editorText}
            onChange={(event) => setEditorText(event.target.value)}
            aria-label="Dashboard config JSON"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void validateConfig()}>
              Validate
            </Button>
            <Button onClick={() => void saveConfig()}>{selectedConfigId ? "Save changes" : "Create config"}</Button>
          </div>
          {validation ? (
            <div className="mt-3 rounded-2xl border border-border bg-surface p-3 text-sm">
              <p className="font-medium">{validation.valid ? "Config is valid" : "Validation errors"}</p>
              {!validation.valid ? (
                <ul className="mt-2 space-y-1 text-xs text-muted">
                  {validation.errors.map((error, index) => (
                    <li key={`${error.path}-${index}`}>
                      {error.path || "root"}: {error.message}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </Card>
      </section>
    </div>
  );
}
