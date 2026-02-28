"use client";

import { type PointerEvent as ReactPointerEvent, useEffect, useMemo, useState } from "react";
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

interface SiteOption {
  id: string;
  name: string;
}

interface FloorplanOption {
  id: string;
  name: string;
  siteId: string;
}

interface VendorSiteMapRow {
  id: string;
  siteId: string;
  vendor: string;
  vendorMapId: string | null;
  vendorMapName: string | null;
  robotopsFloorplanId: string;
  scale: number;
  rotationDegrees: number;
  translateX: number;
  translateY: number;
  updatedAt: string;
  robotopsFloorplan?: {
    id: string;
    name: string;
    siteId: string;
  };
}

interface VendorMapPreviewResponse {
  floorplan_id: string | null;
  points: Array<{
    input: { x: number; y: number; heading_degrees?: number; confidence?: number };
    output: { x: number; y: number; heading_degrees?: number; confidence?: number };
  }>;
}

interface MappingEditorForm {
  site_id: string;
  vendor: string;
  vendor_map_id: string;
  vendor_map_name: string;
  robotops_floorplan_id: string;
  scale: number;
  rotation_degrees: number;
  translate_x: number;
  translate_y: number;
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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

const CANVAS_WIDTH = 420;
const CANVAS_HEIGHT = 240;
const DERIVE_BASE_AXIS = 80;

export default function SettingsPage() {
  const configsQuery = useAuthedQuery<DashboardConfig[]>(["dashboard-configs"], "/dashboard-configs");
  const scopeCatalogQuery = useAuthedQuery<ScopeCatalogResponse>(["rbac-scopes"], "/rbac/scopes");
  const roleMatrixQuery = useAuthedQuery<RoleMatrixResponse>(["rbac-roles"], "/rbac/roles");
  const alertPoliciesQuery = useAuthedQuery<AlertPolicy[]>(["alert-policies"], "/alerts/policies");
  const alertRulesQuery = useAuthedQuery<AlertRule[]>(["alert-rules"], "/alerts/rules");
  const sitesQuery = useAuthedQuery<SiteOption[]>(["settings-sites"], "/sites");
  const floorplansQuery = useAuthedQuery<FloorplanOption[]>(["settings-floorplans"], "/floorplans?site_id=all");
  const vendorMapsQuery = useAuthedQuery<VendorSiteMapRow[]>(["vendor-site-maps"], "/vendor-site-maps");

  const createMutation = useAuthedMutation<DashboardConfig>();
  const patchMutation = useAuthedMutation<DashboardConfig>();
  const activateMutation = useAuthedMutation<DashboardConfig>();
  const validateMutation = useAuthedMutation<ValidationResponse>();

  const patchRoleMutation = useAuthedMutation();
  const createPolicyMutation = useAuthedMutation<AlertPolicy>();
  const createRuleMutation = useAuthedMutation<AlertRule>();
  const testRouteMutation = useAuthedMutation();

  const createVendorMapMutation = useAuthedMutation<VendorSiteMapRow>();
  const patchVendorMapMutation = useAuthedMutation<VendorSiteMapRow>();
  const deleteVendorMapMutation = useAuthedMutation<{ deleted: boolean; id: string }>();
  const previewVendorMapMutation = useAuthedMutation<VendorMapPreviewResponse>();

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

  const [selectedMapId, setSelectedMapId] = useState("");
  const [mapForm, setMapForm] = useState<MappingEditorForm>({
    site_id: "",
    vendor: "vendor_acme",
    vendor_map_id: "",
    vendor_map_name: "",
    robotops_floorplan_id: "",
    scale: 1,
    rotation_degrees: 0,
    translate_x: 120,
    translate_y: 170
  });
  const [mapFormError, setMapFormError] = useState<string | null>(null);
  const [originHandle, setOriginHandle] = useState({ x: 120, y: 170 });
  const [axisHandle, setAxisHandle] = useState({ x: 200, y: 170 });
  const [sampleHandle, setSampleHandle] = useState({ x: 160, y: 100 });
  const [previewOutput, setPreviewOutput] = useState<{ x: number; y: number; heading_degrees?: number; confidence?: number } | null>(null);
  const [dragTarget, setDragTarget] = useState<"origin" | "axis" | "sample" | null>(null);

  const selectedConfig = useMemo(
    () => (configsQuery.data ?? []).find((entry) => entry.id === selectedConfigId) ?? null,
    [configsQuery.data, selectedConfigId]
  );

  const selectedRoleRow = useMemo(
    () => roleMatrixQuery.data?.roles.find((row) => row.role === selectedRole) ?? null,
    [roleMatrixQuery.data, selectedRole]
  );

  const selectedVendorMap = useMemo(
    () => (vendorMapsQuery.data ?? []).find((row) => row.id === selectedMapId) ?? null,
    [selectedMapId, vendorMapsQuery.data]
  );

  const availableFloorplans = useMemo(
    () => (floorplansQuery.data ?? []).filter((floorplan) => floorplan.siteId === mapForm.site_id),
    [floorplansQuery.data, mapForm.site_id]
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

  useEffect(() => {
    if (selectedVendorMap) {
      setMapForm({
        site_id: selectedVendorMap.siteId,
        vendor: selectedVendorMap.vendor,
        vendor_map_id: selectedVendorMap.vendorMapId ?? "",
        vendor_map_name: selectedVendorMap.vendorMapName ?? "",
        robotops_floorplan_id: selectedVendorMap.robotopsFloorplanId,
        scale: selectedVendorMap.scale,
        rotation_degrees: selectedVendorMap.rotationDegrees,
        translate_x: selectedVendorMap.translateX,
        translate_y: selectedVendorMap.translateY
      });
      const radians = (selectedVendorMap.rotationDegrees * Math.PI) / 180;
      const axisLength = DERIVE_BASE_AXIS * selectedVendorMap.scale;
      setOriginHandle({ x: selectedVendorMap.translateX, y: selectedVendorMap.translateY });
      setAxisHandle({
        x: selectedVendorMap.translateX + axisLength * Math.cos(radians),
        y: selectedVendorMap.translateY + axisLength * Math.sin(radians)
      });
      setPreviewOutput(null);
      setMapFormError(null);
      return;
    }

    if (!mapForm.site_id && (sitesQuery.data ?? []).length > 0) {
      const firstSiteId = sitesQuery.data?.[0]?.id ?? "";
      const firstFloorplanId = (floorplansQuery.data ?? []).find((floorplan) => floorplan.siteId === firstSiteId)?.id ?? "";
      setMapForm((current) => ({
        ...current,
        site_id: firstSiteId,
        robotops_floorplan_id: firstFloorplanId
      }));
    }
  }, [floorplansQuery.data, mapForm.site_id, selectedVendorMap, sitesQuery.data]);

  useEffect(() => {
    if (!mapForm.site_id) {
      return;
    }
    if (!availableFloorplans.some((entry) => entry.id === mapForm.robotops_floorplan_id)) {
      setMapForm((current) => ({
        ...current,
        robotops_floorplan_id: availableFloorplans[0]?.id ?? ""
      }));
    }
  }, [availableFloorplans, mapForm.robotops_floorplan_id, mapForm.site_id]);

  function parseEditor(): Record<string, unknown> | null {
    try {
      return JSON.parse(editorText) as Record<string, unknown>;
    } catch {
      alert("Editor content must be valid JSON.");
      return null;
    }
  }

  function deriveTransformFromHandles(nextOrigin: { x: number; y: number }, nextAxis: { x: number; y: number }) {
    const dx = nextAxis.x - nextOrigin.x;
    const dy = nextAxis.y - nextOrigin.y;
    const derivedScale = Math.max(0.01, Math.sqrt(dx * dx + dy * dy) / DERIVE_BASE_AXIS);
    const derivedRotation = (Math.atan2(dy, dx) * 180) / Math.PI;

    setMapForm((current) => ({
      ...current,
      scale: Number(derivedScale.toFixed(4)),
      rotation_degrees: Number(derivedRotation.toFixed(3)),
      translate_x: Number(nextOrigin.x.toFixed(3)),
      translate_y: Number(nextOrigin.y.toFixed(3))
    }));
  }

  function extractCanvasPoint(event: ReactPointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: clamp(event.clientX - rect.left, 0, CANVAS_WIDTH),
      y: clamp(event.clientY - rect.top, 0, CANVAS_HEIGHT)
    };
  }

  function onCanvasPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragTarget) {
      return;
    }

    const point = extractCanvasPoint(event);
    if (dragTarget === "origin") {
      setOriginHandle(point);
      deriveTransformFromHandles(point, axisHandle);
      return;
    }
    if (dragTarget === "axis") {
      setAxisHandle(point);
      deriveTransformFromHandles(originHandle, point);
      return;
    }
    setSampleHandle(point);
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

  function resetMapEditor() {
    setSelectedMapId("");
    const firstSiteId = sitesQuery.data?.[0]?.id ?? "";
    const firstFloorplanId = (floorplansQuery.data ?? []).find((row) => row.siteId === firstSiteId)?.id ?? "";
    setMapForm({
      site_id: firstSiteId,
      vendor: "vendor_acme",
      vendor_map_id: "",
      vendor_map_name: "",
      robotops_floorplan_id: firstFloorplanId,
      scale: 1,
      rotation_degrees: 0,
      translate_x: 120,
      translate_y: 170
    });
    setOriginHandle({ x: 120, y: 170 });
    setAxisHandle({ x: 200, y: 170 });
    setSampleHandle({ x: 160, y: 100 });
    setPreviewOutput(null);
    setMapFormError(null);
  }

  async function saveVendorMap() {
    setMapFormError(null);
    if (!mapForm.vendor_map_id.trim() && !mapForm.vendor_map_name.trim()) {
      setMapFormError("Set at least one of vendor map id or vendor map name.");
      return;
    }
    if (!mapForm.site_id || !mapForm.robotops_floorplan_id) {
      setMapFormError("Select site and RobotOps floorplan.");
      return;
    }

    const createBody = {
      site_id: mapForm.site_id,
      vendor: mapForm.vendor,
      vendor_map_id: mapForm.vendor_map_id.trim() || undefined,
      vendor_map_name: mapForm.vendor_map_name.trim() || undefined,
      robotops_floorplan_id: mapForm.robotops_floorplan_id,
      scale: mapForm.scale,
      rotation_degrees: mapForm.rotation_degrees,
      translate_x: mapForm.translate_x,
      translate_y: mapForm.translate_y
    };

    const patchBody = {
      vendor: mapForm.vendor,
      vendor_map_id: mapForm.vendor_map_id.trim() || null,
      vendor_map_name: mapForm.vendor_map_name.trim() || null,
      robotops_floorplan_id: mapForm.robotops_floorplan_id,
      scale: mapForm.scale,
      rotation_degrees: mapForm.rotation_degrees,
      translate_x: mapForm.translate_x,
      translate_y: mapForm.translate_y
    };

    try {
      const saved = selectedMapId
        ? await patchVendorMapMutation.mutateAsync({
            path: `/vendor-site-maps/${selectedMapId}`,
            method: "PATCH",
            body: patchBody
          })
        : await createVendorMapMutation.mutateAsync({
            path: "/vendor-site-maps",
            method: "POST",
            body: createBody
          });

      setSelectedMapId(saved.id);
      await vendorMapsQuery.refetch();
    } catch (error) {
      setMapFormError(String(error));
    }
  }

  async function deleteVendorMap(id: string) {
    await deleteVendorMapMutation.mutateAsync({
      path: `/vendor-site-maps/${id}`,
      method: "DELETE"
    });

    if (id === selectedMapId) {
      resetMapEditor();
    }
    await vendorMapsQuery.refetch();
  }

  async function previewVendorMap() {
    setMapFormError(null);
    try {
      const result = await previewVendorMapMutation.mutateAsync({
        path: "/vendor-site-maps/preview",
        method: "POST",
        body: {
          robotops_floorplan_id: mapForm.robotops_floorplan_id || undefined,
          scale: mapForm.scale,
          rotation_degrees: mapForm.rotation_degrees,
          translate_x: mapForm.translate_x,
          translate_y: mapForm.translate_y,
          points: [
            {
              x: sampleHandle.x,
              y: sampleHandle.y,
              heading_degrees: 90,
              confidence: 0.95
            }
          ]
        }
      });
      setPreviewOutput(result.points[0]?.output ?? null);
    } catch (error) {
      setMapFormError(String(error));
    }
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

      <section className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
        <Card>
          <div className="flex items-center gap-2">
            <CardTitle>Map mappings</CardTitle>
            <Button className="ml-auto" variant="secondary" onClick={resetMapEditor}>
              New mapping
            </Button>
          </div>
          <CardMeta>Vendor map id/name bindings to RobotOps floorplans</CardMeta>

          <div className="mt-3 max-h-[400px] space-y-2 overflow-auto text-sm">
            {(vendorMapsQuery.data ?? []).map((entry) => (
              <div
                key={entry.id}
                role="button"
                tabIndex={0}
                aria-pressed={selectedMapId === entry.id}
                className={`rounded-2xl border p-3 text-left ${selectedMapId === entry.id ? "border-primary bg-surface" : "border-border bg-white"}`}
                onClick={() => setSelectedMapId(entry.id)}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) {
                    return;
                  }
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedMapId(entry.id);
                  }
                }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{entry.vendor}</p>
                  <span className="text-xs text-muted">site {entry.siteId}</span>
                  <span className="text-xs text-muted">floorplan {entry.robotopsFloorplan?.name ?? entry.robotopsFloorplanId}</span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  map_id: {entry.vendorMapId ?? "-"} • map_name: {entry.vendorMapName ?? "-"} • updated {formatDate(entry.updatedAt)}
                </p>
                <Button
                  className="mt-2 px-3 py-1.5 text-xs"
                  variant="secondary"
                  onClick={(event) => {
                    event.stopPropagation();
                    void deleteVendorMap(entry.id);
                  }}
                >
                  Delete
                </Button>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardTitle>Visual transform editor</CardTitle>
          <CardMeta>Drag origin and axis handles to derive scale/rotation/translation. Preview transformed points live.</CardMeta>

          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <label htmlFor="map-site" className="sr-only">
              Site
            </label>
            <select
              id="map-site"
              className="rounded-2xl border border-border bg-white px-3 py-2 text-sm"
              value={mapForm.site_id}
              onChange={(event) => setMapForm((current) => ({ ...current, site_id: event.target.value }))}
              aria-label="Site"
            >
              {(sitesQuery.data ?? []).map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
            <input
              className="rounded-2xl border border-border bg-white px-3 py-2 text-sm"
              value={mapForm.vendor}
              onChange={(event) => setMapForm((current) => ({ ...current, vendor: event.target.value }))}
              placeholder="vendor"
              aria-label="Vendor"
            />
            <input
              className="rounded-2xl border border-border bg-white px-3 py-2 text-sm"
              value={mapForm.vendor_map_id}
              onChange={(event) => setMapForm((current) => ({ ...current, vendor_map_id: event.target.value }))}
              placeholder="vendor_map_id"
              aria-label="Vendor map id"
            />
            <input
              className="rounded-2xl border border-border bg-white px-3 py-2 text-sm"
              value={mapForm.vendor_map_name}
              onChange={(event) => setMapForm((current) => ({ ...current, vendor_map_name: event.target.value }))}
              placeholder="vendor_map_name"
              aria-label="Vendor map name"
            />
            <label htmlFor="map-floorplan" className="sr-only">
              RobotOps floorplan
            </label>
            <select
              id="map-floorplan"
              className="rounded-2xl border border-border bg-white px-3 py-2 text-sm md:col-span-2"
              value={mapForm.robotops_floorplan_id}
              onChange={(event) => setMapForm((current) => ({ ...current, robotops_floorplan_id: event.target.value }))}
              aria-label="RobotOps floorplan"
            >
              {availableFloorplans.map((floorplan) => (
                <option key={floorplan.id} value={floorplan.id}>
                  {floorplan.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3 grid gap-2 text-xs md:grid-cols-4">
            <label className="flex flex-col gap-1">
              <span className="text-muted">scale</span>
              <input
                type="number"
                step="0.01"
                className="rounded-xl border border-border bg-white px-2 py-1.5 text-sm"
                value={mapForm.scale}
                onChange={(event) => setMapForm((current) => ({ ...current, scale: Number(event.target.value) || 0 }))}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-muted">rotation</span>
              <input
                type="number"
                step="0.1"
                className="rounded-xl border border-border bg-white px-2 py-1.5 text-sm"
                value={mapForm.rotation_degrees}
                onChange={(event) => setMapForm((current) => ({ ...current, rotation_degrees: Number(event.target.value) || 0 }))}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-muted">translate x</span>
              <input
                type="number"
                step="0.1"
                className="rounded-xl border border-border bg-white px-2 py-1.5 text-sm"
                value={mapForm.translate_x}
                onChange={(event) => setMapForm((current) => ({ ...current, translate_x: Number(event.target.value) || 0 }))}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-muted">translate y</span>
              <input
                type="number"
                step="0.1"
                className="rounded-xl border border-border bg-white px-2 py-1.5 text-sm"
                value={mapForm.translate_y}
                onChange={(event) => setMapForm((current) => ({ ...current, translate_y: Number(event.target.value) || 0 }))}
              />
            </label>
          </div>

          <div className="mt-3 overflow-x-auto">
            <div
              className="relative rounded-2xl border border-border bg-surface"
              style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
              onPointerMove={onCanvasPointerMove}
              onPointerUp={() => setDragTarget(null)}
              onPointerLeave={() => setDragTarget(null)}
            >
              <div
                className="absolute h-0.5 bg-blue-500"
                style={{
                  left: originHandle.x,
                  top: originHandle.y,
                  width: Math.sqrt((axisHandle.x - originHandle.x) ** 2 + (axisHandle.y - originHandle.y) ** 2),
                  transformOrigin: "0 0",
                  transform: `rotate(${(Math.atan2(axisHandle.y - originHandle.y, axisHandle.x - originHandle.x) * 180) / Math.PI}deg)`
                }}
              />

              <button
                type="button"
                className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-rose-500"
                style={{ left: originHandle.x, top: originHandle.y }}
                onPointerDown={(event) => {
                  event.preventDefault();
                  setDragTarget("origin");
                }}
                aria-label="Drag origin handle"
              />
              <button
                type="button"
                className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-blue-500"
                style={{ left: axisHandle.x, top: axisHandle.y }}
                onPointerDown={(event) => {
                  event.preventDefault();
                  setDragTarget("axis");
                }}
                aria-label="Drag axis handle"
              />
              <button
                type="button"
                className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-emerald-500"
                style={{ left: sampleHandle.x, top: sampleHandle.y }}
                onPointerDown={(event) => {
                  event.preventDefault();
                  setDragTarget("sample");
                }}
                aria-label="Drag sample input point"
              />
              {previewOutput ? (
                <div
                  className="absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-fuchsia-700 bg-fuchsia-400"
                  style={{
                    left: clamp(previewOutput.x, 0, CANVAS_WIDTH),
                    top: clamp(previewOutput.y, 0, CANVAS_HEIGHT)
                  }}
                  aria-label="Preview transformed output point"
                />
              ) : null}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => void saveVendorMap()}>{selectedMapId ? "Save mapping" : "Create mapping"}</Button>
            <Button variant="secondary" onClick={() => void previewVendorMap()}>
              Preview transform
            </Button>
          </div>

          {mapFormError ? <p className="mt-2 text-xs text-rose-600">{mapFormError}</p> : null}
          {previewOutput ? (
            <p className="mt-2 text-xs text-muted">
              Preview output: ({previewOutput.x.toFixed(2)}, {previewOutput.y.toFixed(2)})
              {typeof previewOutput.heading_degrees === "number" ? ` heading ${previewOutput.heading_degrees.toFixed(2)}°` : ""}
            </p>
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
