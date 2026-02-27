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

interface ScopeCatalogResponse {
  version: number;
  scopes: string[];
  deprecatedScopes: string[];
}

interface RoleMatrixResponse {
  tenantId: string;
  roles: Array<{
    role: string;
    baseScopes: string[];
    effectiveScopes: string[];
    overrides: {
      allowScopes: string[];
      denyScopes: string[];
    } | null;
  }>;
}

interface AlertPolicy {
  id: string;
  name: string;
  isActive: boolean;
  updatedAt: string;
  steps: Array<{ id: string; orderIndex: number; delaySeconds: number; channel: string; target: string }>;
}

interface AlertRule {
  id: string;
  name: string;
  eventType: string;
  policyId: string;
  isActive: boolean;
  priority: number;
  severity: string | null;
  siteId: string | null;
  updatedAt: string;
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
  const scopeCatalogQuery = useAuthedQuery<ScopeCatalogResponse>(["rbac-scopes"], "/rbac/scopes");
  const roleMatrixQuery = useAuthedQuery<RoleMatrixResponse>(["rbac-roles"], "/rbac/roles");
  const alertPoliciesQuery = useAuthedQuery<AlertPolicy[]>(["alert-policies"], "/alerts/policies");
  const alertRulesQuery = useAuthedQuery<AlertRule[]>(["alert-rules"], "/alerts/rules");

  const createMutation = useAuthedMutation<DashboardConfig>();
  const patchMutation = useAuthedMutation<DashboardConfig>();
  const activateMutation = useAuthedMutation<DashboardConfig>();
  const validateMutation = useAuthedMutation<ValidationResponse>();

  const patchRoleMutation = useAuthedMutation();
  const createPolicyMutation = useAuthedMutation<AlertPolicy>();
  const createRuleMutation = useAuthedMutation<AlertRule>();
  const testRouteMutation = useAuthedMutation();

  const [selectedConfigId, setSelectedConfigId] = useState("");
  const [editorText, setEditorText] = useState(JSON.stringify(defaultConfigPayload(), null, 2));
  const [validation, setValidation] = useState<ValidationResponse | null>(null);

  const [selectedRole, setSelectedRole] = useState("OpsManager");
  const [allowScopesText, setAllowScopesText] = useState("");
  const [denyScopesText, setDenyScopesText] = useState("");

  const [newPolicyName, setNewPolicyName] = useState("Ops Escalation Policy");
  const [newPolicyTarget, setNewPolicyTarget] = useState("#robotops-alerts");

  const [newRuleName, setNewRuleName] = useState("Critical Incident Escalation");
  const [newRuleEventType, setNewRuleEventType] = useState<"incident" | "integration_error">("incident");
  const [newRuleSeverity, setNewRuleSeverity] = useState("major");
  const [newRuleCategory, setNewRuleCategory] = useState("safety");
  const [newRuleSiteId, setNewRuleSiteId] = useState("s1");
  const [selectedPolicyId, setSelectedPolicyId] = useState("");

  const selectedConfig = useMemo(
    () => (configsQuery.data ?? []).find((entry) => entry.id === selectedConfigId) ?? null,
    [configsQuery.data, selectedConfigId]
  );

  const selectedRoleRow = useMemo(
    () => roleMatrixQuery.data?.roles.find((row) => row.role === selectedRole) ?? null,
    [roleMatrixQuery.data, selectedRole]
  );

  useEffect(() => {
    if (!selectedConfig) {
      return;
    }
    setEditorText(JSON.stringify(toEditorPayload(selectedConfig), null, 2));
  }, [selectedConfig]);

  useEffect(() => {
    if (!selectedRoleRow) {
      return;
    }
    setAllowScopesText((selectedRoleRow.overrides?.allowScopes ?? []).join(", "));
    setDenyScopesText((selectedRoleRow.overrides?.denyScopes ?? []).join(", "));
  }, [selectedRoleRow]);

  useEffect(() => {
    if (selectedPolicyId || !(alertPoliciesQuery.data ?? []).length) {
      return;
    }
    setSelectedPolicyId(alertPoliciesQuery.data?.[0]?.id ?? "");
  }, [alertPoliciesQuery.data, selectedPolicyId]);

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

  async function saveRoleOverride() {
    const allowScopes = allowScopesText
      .split(",")
      .map((scope) => scope.trim())
      .filter(Boolean);
    const denyScopes = denyScopesText
      .split(",")
      .map((scope) => scope.trim())
      .filter(Boolean);

    await patchRoleMutation.mutateAsync({
      path: `/rbac/roles/${selectedRole}`,
      method: "PATCH",
      body: {
        role: selectedRole,
        allow_scopes: allowScopes,
        deny_scopes: denyScopes
      }
    });

    await roleMatrixQuery.refetch();
  }

  async function createPolicy() {
    const created = await createPolicyMutation.mutateAsync({
      path: "/alerts/policies",
      method: "POST",
      body: {
        name: newPolicyName,
        description: "Phase 3 deterministic escalation policy",
        is_active: true,
        steps: [
          {
            delay_seconds: 0,
            channel: "slack",
            target: newPolicyTarget,
            severity_min: "warning"
          },
          {
            delay_seconds: 300,
            channel: "email",
            target: "oncall@demo.com",
            severity_min: "major"
          }
        ]
      }
    });

    setSelectedPolicyId(created.id);
    await alertPoliciesQuery.refetch();
  }

  async function createRule() {
    if (!selectedPolicyId) {
      alert("Select or create a policy first.");
      return;
    }

    await createRuleMutation.mutateAsync({
      path: "/alerts/rules",
      method: "POST",
      body: {
        name: newRuleName,
        event_type: newRuleEventType,
        policy_id: selectedPolicyId,
        priority: 50,
        is_active: true,
        severity: newRuleSeverity,
        category: newRuleCategory,
        site_id: newRuleSiteId,
        conditions: {
          source: "settings_ui"
        }
      }
    });

    await alertRulesQuery.refetch();
  }

  async function runTestRoute() {
    await testRouteMutation.mutateAsync({
      path: "/alerts/test-route",
      method: "POST",
      body: {
        event_type: newRuleEventType,
        site_id: newRuleSiteId,
        severity: newRuleSeverity,
        category: newRuleCategory,
        payload: {
          triggered_from: "settings_test"
        }
      }
    });
  }

  return (
    <div className="space-y-6">
      <PageTitle title="Settings" subtitle="Tenant, role scopes, alerting policies, and configuration-as-code workflows." />

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
              <div
                key={config.id}
                role="button"
                tabIndex={0}
                aria-pressed={selectedConfigId === config.id}
                className={`w-full cursor-pointer rounded-2xl border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  selectedConfigId === config.id ? "border-primary bg-surface" : "border-border bg-white"
                }`}
                onClick={() => {
                  setSelectedConfigId(config.id);
                  setValidation(null);
                }}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) {
                    return;
                  }
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedConfigId(config.id);
                    setValidation(null);
                  }
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
              </div>
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

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardTitle>Role scope matrix</CardTitle>
          <CardMeta>
            Scope catalog v{scopeCatalogQuery.data?.version ?? 2} with deprecated aliases: {(scopeCatalogQuery.data?.deprecatedScopes ?? []).join(", ") || "none"}
          </CardMeta>
          <div className="mt-3 grid gap-2 md:grid-cols-[220px_1fr]">
            <label htmlFor="role-matrix-selector" className="sr-only">
              Select role
            </label>
            <select
              id="role-matrix-selector"
              value={selectedRole}
              onChange={(event) => setSelectedRole(event.target.value)}
              className="rounded-2xl border border-border bg-white px-3 py-2 text-sm"
              aria-label="Select role"
            >
              {(roleMatrixQuery.data?.roles ?? []).map((roleRow) => (
                <option key={roleRow.role} value={roleRow.role}>
                  {roleRow.role}
                </option>
              ))}
            </select>
            <div className="rounded-2xl border border-border bg-surface p-3 text-xs text-muted">
              Effective scopes: {selectedRoleRow?.effectiveScopes.length ?? 0}
            </div>
          </div>

          <label htmlFor="allow-scopes-input" className="mt-3 block text-xs text-muted">
            Allow scopes (comma separated)
          </label>
          <textarea
            id="allow-scopes-input"
            className="mt-1 h-20 w-full rounded-2xl border border-border bg-white p-3 text-xs"
            value={allowScopesText}
            onChange={(event) => setAllowScopesText(event.target.value)}
            aria-label="Allow scopes"
          />

          <label htmlFor="deny-scopes-input" className="mt-3 block text-xs text-muted">
            Deny scopes (comma separated)
          </label>
          <textarea
            id="deny-scopes-input"
            className="mt-1 h-20 w-full rounded-2xl border border-border bg-white p-3 text-xs"
            value={denyScopesText}
            onChange={(event) => setDenyScopesText(event.target.value)}
            aria-label="Deny scopes"
          />

          <div className="mt-3 flex gap-2">
            <Button onClick={() => void saveRoleOverride()}>Apply override</Button>
            <Button variant="secondary" onClick={() => roleMatrixQuery.refetch()}>
              Refresh matrix
            </Button>
          </div>
        </Card>

        <Card>
          <CardTitle>Alert policies and rules</CardTitle>
          <CardMeta>Create deterministic routing and escalation behaviors</CardMeta>

          <div className="mt-3 space-y-2">
            <label htmlFor="alert-policy-name" className="text-xs text-muted">
              Policy name
            </label>
            <input
              id="alert-policy-name"
              className="w-full rounded-2xl border border-border bg-white px-3 py-2 text-sm"
              value={newPolicyName}
              onChange={(event) => setNewPolicyName(event.target.value)}
              aria-label="Policy name"
            />
            <label htmlFor="alert-policy-target" className="text-xs text-muted">
              Primary target
            </label>
            <input
              id="alert-policy-target"
              className="w-full rounded-2xl border border-border bg-white px-3 py-2 text-sm"
              value={newPolicyTarget}
              onChange={(event) => setNewPolicyTarget(event.target.value)}
              aria-label="Primary target"
            />
            <Button variant="secondary" onClick={() => void createPolicy()}>
              Create policy
            </Button>
          </div>

          <div className="mt-4 grid gap-2">
            <label htmlFor="alert-rule-name" className="text-xs text-muted">
              Rule name
            </label>
            <input
              id="alert-rule-name"
              className="rounded-2xl border border-border bg-white px-3 py-2 text-sm"
              value={newRuleName}
              onChange={(event) => setNewRuleName(event.target.value)}
              aria-label="Rule name"
            />
            <label htmlFor="policy-selector" className="sr-only">
              Select policy
            </label>
            <select
              id="policy-selector"
              value={selectedPolicyId}
              onChange={(event) => setSelectedPolicyId(event.target.value)}
              className="rounded-2xl border border-border bg-white px-3 py-2 text-sm"
              aria-label="Select policy"
            >
              {(alertPoliciesQuery.data ?? []).map((policy) => (
                <option key={policy.id} value={policy.id}>
                  {policy.name}
                </option>
              ))}
            </select>
            <label htmlFor="event-type-selector" className="sr-only">
              Select event type
            </label>
            <select
              id="event-type-selector"
              value={newRuleEventType}
              onChange={(event) => setNewRuleEventType(event.target.value as "incident" | "integration_error")}
              className="rounded-2xl border border-border bg-white px-3 py-2 text-sm"
              aria-label="Select event type"
            >
              <option value="incident">incident</option>
              <option value="integration_error">integration_error</option>
            </select>
            <div className="grid gap-2 md:grid-cols-3">
              <input
                className="rounded-2xl border border-border bg-white px-3 py-2 text-sm"
                value={newRuleSeverity}
                onChange={(event) => setNewRuleSeverity(event.target.value)}
                placeholder="severity"
              />
              <input
                className="rounded-2xl border border-border bg-white px-3 py-2 text-sm"
                value={newRuleCategory}
                onChange={(event) => setNewRuleCategory(event.target.value)}
                placeholder="category"
              />
              <input
                className="rounded-2xl border border-border bg-white px-3 py-2 text-sm"
                value={newRuleSiteId}
                onChange={(event) => setNewRuleSiteId(event.target.value)}
                placeholder="site_id"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => void createRule()}>Create rule</Button>
              <Button variant="secondary" onClick={() => void runTestRoute()}>
                Test route
              </Button>
            </div>
          </div>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardTitle>Policy catalog</CardTitle>
          <div className="mt-2 space-y-2 text-sm">
            {(alertPoliciesQuery.data ?? []).map((policy) => (
              <div key={policy.id} className="rounded-2xl border border-border bg-surface p-3">
                <p className="font-medium">{policy.name}</p>
                <p className="text-xs text-muted">
                  {policy.isActive ? "active" : "disabled"} • {policy.steps.length} steps • updated {formatDate(policy.updatedAt)}
                </p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardTitle>Rule catalog</CardTitle>
          <div className="mt-2 space-y-2 text-sm">
            {(alertRulesQuery.data ?? []).map((rule) => (
              <div key={rule.id} className="rounded-2xl border border-border bg-surface p-3">
                <p className="font-medium">{rule.name}</p>
                <p className="text-xs text-muted">
                  {rule.eventType} • {rule.severity ?? "any"} • policy {rule.policyId} • priority {rule.priority}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}
