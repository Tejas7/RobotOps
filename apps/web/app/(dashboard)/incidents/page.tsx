"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardMeta, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { Drawer } from "@/components/ui/drawer";
import { PageTitle } from "@/components/pages/page-title";
import { StatusChip } from "@/components/ui/status-chip";
import { useAuthedMutation } from "@/hooks/use-authed-mutation";
import { useAuthedQuery } from "@/hooks/use-authed-query";
import { useRbac } from "@/hooks/use-rbac";
import { useGlobalFilters } from "@/store/use-global-filters";
import { formatDate } from "@/lib/utils";

interface IncidentEvent {
  id: string;
  type: string;
  message: string;
  timestamp: string;
}

interface Incident {
  id: string;
  severity: string;
  category: string;
  title: string;
  description: string;
  robotId: string | null;
  missionId: string | null;
  siteId: string;
  status: string;
  createdAt: string;
  timeline: IncidentEvent[];
}

interface Integration {
  id: string;
  name: string;
  type: string;
  status: "active" | "disabled" | "error";
  lastSyncAt: string | null;
}

export default function IncidentsPage() {
  const { siteId } = useGlobalFilters();
  const { can, canAny } = useRbac();
  const [severity, setSeverity] = useState("all");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resolveNote, setResolveNote] = useState("Issue mitigated by operator workflow update.");
  const [confirmResolve, setConfirmResolve] = useState(false);

  const incidentsQuery = useAuthedQuery<Incident[]>(
    ["incidents", siteId, severity, category, status],
    `/incidents?site_id=${siteId}${severity !== "all" ? `&severity=${severity}` : ""}${
      category !== "all" ? `&category=${category}` : ""
    }${status !== "all" ? `&status=${status}` : ""}`
  );
  const integrationsQuery = useAuthedQuery<Integration[]>(["integrations"], "/integrations");

  const ackMutation = useAuthedMutation<Incident>();
  const resolveMutation = useAuthedMutation<Incident>();

  const selectedIncident = useMemo(
    () => incidentsQuery.data?.find((incident) => incident.id === selectedId) ?? null,
    [incidentsQuery.data, selectedId]
  );

  const canAck = canAny(["incidents.ack", "incidents.write"]);
  const canResolve = can("incidents.write");

  return (
    <div className="space-y-6">
      <PageTitle title="Incidents" subtitle="Operational exception management with acknowledgment and resolution workflows." />

      <Card>
        <CardTitle>Filters</CardTitle>
        <div className="mt-3 grid gap-2 md:grid-cols-4">
          <select value={severity} onChange={(event) => setSeverity(event.target.value)} className="rounded-2xl border border-border bg-white px-3 py-2 text-sm">
            <option value="all">Severity: all</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="major">Major</option>
            <option value="critical">Critical</option>
          </select>
          <select value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-2xl border border-border bg-white px-3 py-2 text-sm">
            <option value="all">Category: all</option>
            <option value="navigation">Navigation</option>
            <option value="traffic">Traffic</option>
            <option value="battery">Battery</option>
            <option value="connectivity">Connectivity</option>
            <option value="hardware">Hardware</option>
            <option value="safety">Safety</option>
            <option value="integration">Integration</option>
          </select>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-2xl border border-border bg-white px-3 py-2 text-sm">
            <option value="all">Status: all</option>
            <option value="open">Open</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="mitigated">Mitigated</option>
            <option value="resolved">Resolved</option>
          </select>
          <Button variant="secondary" onClick={() => {
            setSeverity("all");
            setCategory("all");
            setStatus("all");
          }}>
            Reset filters
          </Button>
        </div>
      </Card>

      <DataTable>
        <Table>
          <THead>
            <tr>
              <Th>Severity</Th>
              <Th>Category</Th>
              <Th>Title</Th>
              <Th>Robot</Th>
              <Th>Mission</Th>
              <Th>Site</Th>
              <Th>Status</Th>
              <Th>Created</Th>
              <Th>Owner</Th>
            </tr>
          </THead>
          <tbody>
            {(incidentsQuery.data ?? []).map((incident) => (
              <Tr key={incident.id} className="cursor-pointer" onClick={() => setSelectedId(incident.id)}>
                <Td>{incident.severity}</Td>
                <Td>{incident.category}</Td>
                <Td>{incident.title}</Td>
                <Td>{incident.robotId ?? "-"}</Td>
                <Td>{incident.missionId ?? "-"}</Td>
                <Td>{incident.siteId}</Td>
                <Td>
                  <StatusChip status={incident.status} />
                </Td>
                <Td>{formatDate(incident.createdAt)}</Td>
                <Td>{incident.status === "resolved" ? "System" : "Unassigned"}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </DataTable>

      <Drawer open={Boolean(selectedIncident)} onClose={() => setSelectedId(null)} title={selectedIncident?.title ?? "Incident detail"}>
        {selectedIncident ? (
          <div className="space-y-4">
            <Card>
              <CardTitle>Incident summary</CardTitle>
              <CardMeta>{selectedIncident.category} • {selectedIncident.severity}</CardMeta>
              <p className="mt-3 text-sm text-muted">{selectedIncident.description}</p>
            </Card>

            <Card>
              <CardTitle>Timeline</CardTitle>
              <ul className="mt-3 space-y-2">
                {selectedIncident.timeline.map((event) => (
                  <li key={event.id} className="rounded-2xl border border-border bg-surface p-3 text-sm">
                    <p className="font-medium">{event.type}</p>
                    <p className="text-muted">{event.message}</p>
                    <p className="text-xs text-muted">{formatDate(event.timestamp)}</p>
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <CardTitle>Related telemetry window</CardTitle>
              <p className="mt-2 text-sm text-muted">Telemetry drilldown can be expanded in Phase 2; current view links to robot telemetry tab.</p>
            </Card>

            <Card>
              <CardTitle>Suggested actions</CardTitle>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
                <li>Confirm zone acknowledgment for restricted area entries.</li>
                <li>Verify operator availability for teleoperation fallback.</li>
                <li>Check vendor-specific route constraints and retry policy.</li>
              </ul>
            </Card>

            <Card>
              <CardTitle>Links</CardTitle>
              <div className="mt-2 flex flex-wrap gap-2 text-sm">
                {selectedIncident.robotId ? (
                  <Link href="/fleet" className="rounded-full border border-border px-3 py-1">Open robot in Fleet</Link>
                ) : null}
                {selectedIncident.missionId ? (
                  <Link href="/missions" className="rounded-full border border-border px-3 py-1">Open mission in Missions</Link>
                ) : null}
              </div>
            </Card>

            <Card>
              <CardTitle>Acknowledge and resolve workflow</CardTitle>
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={!canAck || selectedIncident.status === "resolved"}
                    onClick={async () => {
                      await ackMutation.mutateAsync({ path: `/incidents/${selectedIncident.id}/ack`, method: "POST" });
                      await incidentsQuery.refetch();
                    }}
                  >
                    Acknowledge
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={!canResolve || selectedIncident.status === "resolved"}
                    onClick={() => setConfirmResolve(true)}
                  >
                    Resolve
                  </Button>
                </div>
                <textarea
                  className="h-24 w-full rounded-2xl border border-border bg-white p-3 text-sm"
                  value={resolveNote}
                  onChange={(event) => setResolveNote(event.target.value)}
                  placeholder="Resolution note"
                />
                {!canAck ? <p className="text-xs text-muted">No `incidents.ack` or `incidents.write` permission.</p> : null}
                {!canResolve ? <p className="text-xs text-muted">No `incidents.write` permission.</p> : null}
              </div>
            </Card>

            <Card>
              <CardTitle>Automation hooks</CardTitle>
              <CardMeta>Live integration connector statuses for incident workflows</CardMeta>
              <ul className="mt-2 space-y-2 text-sm text-muted">
                {(integrationsQuery.data ?? []).slice(0, 6).map((integration) => (
                  <li key={integration.id} className="rounded-2xl border border-border bg-surface p-2">
                    <p className="font-medium text-text">{integration.name}</p>
                    <p className="text-xs">
                      {integration.type} • {integration.status} • last sync:{" "}
                      {integration.lastSyncAt ? formatDate(integration.lastSyncAt) : "never"}
                    </p>
                  </li>
                ))}
                {!integrationsQuery.data?.length ? (
                  <li className="rounded-2xl border border-border bg-surface p-2">No integrations configured.</li>
                ) : null}
              </ul>
            </Card>
          </div>
        ) : null}
      </Drawer>

      <ConfirmDialog
        open={confirmResolve}
        title="Resolve incident"
        description="This will mark the incident resolved and append your note to the timeline."
        confirmLabel="Resolve"
        onCancel={() => setConfirmResolve(false)}
        onConfirm={async () => {
          if (!selectedIncident) return;
          await resolveMutation.mutateAsync({
            path: `/incidents/${selectedIncident.id}/resolve`,
            method: "POST",
            body: { note: resolveNote }
          });
          await incidentsQuery.refetch();
          setConfirmResolve(false);
        }}
      />
    </div>
  );
}
