"use client";

import { useMemo, useState } from "react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardMeta, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Drawer } from "@/components/ui/drawer";
import { PageTitle } from "@/components/pages/page-title";
import { StatusChip } from "@/components/ui/status-chip";
import { DataTable, Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { useAuthedMutation } from "@/hooks/use-authed-mutation";
import { useAuthedQuery } from "@/hooks/use-authed-query";
import { useRbac } from "@/hooks/use-rbac";
import { useGlobalFilters } from "@/store/use-global-filters";
import { formatDate } from "@/lib/utils";

interface Robot {
  id: string;
  name: string;
  vendor: { id: string; name: string };
  site: { id: string; name: string };
  status: string;
  batteryPercent: number;
  lastSeenAt: string;
  missions: Array<{ id: string; name: string; state: string }>;
  tags: string[];
  capabilities: string[];
  x: number;
  y: number;
  floorplanId: string;
  cpuPercent: number;
  memoryPercent: number;
  tempC: number;
  networkRssi: number;
  diskPercent: number;
  connection: string;
  ip: string;
  firmware: string;
  agentVersion: string;
}

interface Mission {
  id: string;
  name: string;
  state: string;
  assignedRobotId: string | null;
  createdAt: string;
}

interface Incident {
  id: string;
  title: string;
  status: string;
  robotId: string | null;
}

interface TelemetryPoint {
  timestamp: string;
  value: number;
  count: number;
  min?: number;
  max?: number;
}

interface TelemetrySeriesResponse {
  robotId: string;
  metric: string;
  from: string;
  to: string;
  totalPoints: number;
  downsampled: boolean;
  aggregation: "avg" | "min" | "max" | "last";
  bucketSeconds: number | null;
  maxPoints: number;
  points: TelemetryPoint[];
}

interface AuditEvent {
  id: string;
  timestamp: string;
  action: string;
  actorId: string;
  diff: unknown;
}

interface AuditResponse {
  items: AuditEvent[];
  next_cursor: string | null;
}

const TAB_ITEMS = ["Summary", "Telemetry", "Logs", "Missions", "Controls", "Diagnostics", "Audit"] as const;
type TabKey = (typeof TAB_ITEMS)[number];

const TELEMETRY_METRICS = ["battery", "temp_c", "cpu_percent", "network_rssi", "disk_percent"] as const;
const TELEMETRY_RANGES = ["1h", "6h", "24h", "7d"] as const;

function rangeToFromIso(range: (typeof TELEMETRY_RANGES)[number]) {
  const now = new Date();
  const multiplier = {
    "1h": 1,
    "6h": 6,
    "24h": 24,
    "7d": 24 * 7
  }[range];
  const from = new Date(now.getTime() - multiplier * 60 * 60 * 1000);
  return {
    from: from.toISOString(),
    to: now.toISOString()
  };
}

export default function FleetPage() {
  const { siteId } = useGlobalFilters();
  const { can } = useRbac();

  const [selectedRobotId, setSelectedRobotId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("Summary");
  const [statusFilter, setStatusFilter] = useState("all");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [capabilityFilter, setCapabilityFilter] = useState("all");
  const [batteryMin, setBatteryMin] = useState("0");

  const [telemetryMetric, setTelemetryMetric] = useState<(typeof TELEMETRY_METRICS)[number]>("battery");
  const [telemetryRange, setTelemetryRange] = useState<(typeof TELEMETRY_RANGES)[number]>("24h");

  const robotsQuery = useAuthedQuery<Robot[]>(
    ["fleet-robots", siteId, statusFilter, vendorFilter, tagFilter, capabilityFilter, batteryMin],
    `/robots?site_id=${siteId}&battery_min=${batteryMin}${statusFilter !== "all" ? `&status=${statusFilter}` : ""}${
      vendorFilter !== "all" ? `&vendor=${vendorFilter}` : ""
    }${tagFilter !== "all" ? `&tag=${tagFilter}` : ""}${capabilityFilter !== "all" ? `&capability=${capabilityFilter}` : ""}`
  );

  const selectedRobot = useMemo(
    () => (selectedRobotId ? robotsQuery.data?.find((robot) => robot.id === selectedRobotId) : null),
    [selectedRobotId, robotsQuery.data]
  );

  const robotDetailQuery = useAuthedQuery<Robot | null>(
    ["robot-detail", selectedRobotId],
    selectedRobotId ? `/robots/${selectedRobotId}` : undefined
  );

  const missionsQuery = useAuthedQuery<Mission[]>(["missions", siteId], `/missions?site_id=${siteId}`);
  const incidentsQuery = useAuthedQuery<Incident[]>(["incidents", siteId], `/incidents?site_id=${siteId}`);

  const telemetryWindow = useMemo(() => rangeToFromIso(telemetryRange), [telemetryRange]);
  const telemetryQuery = useAuthedQuery<TelemetrySeriesResponse>(
    ["telemetry", selectedRobotId, telemetryMetric, telemetryWindow.from, telemetryWindow.to],
    selectedRobotId
      ? `/telemetry/robot/${selectedRobotId}?metric=${telemetryMetric}&from=${encodeURIComponent(telemetryWindow.from)}&to=${encodeURIComponent(
          telemetryWindow.to
        )}&max_points=240`
      : undefined
  );

  const auditQuery = useAuthedQuery<AuditResponse>(
    ["audit", selectedRobotId],
    selectedRobotId ? `/audit?resource_type=robot&resource_id=${selectedRobotId}&limit=100` : undefined
  );

  const actionMutation = useAuthedMutation<{ accepted: boolean; action: string }>();
  const [confirmAction, setConfirmAction] = useState<null | "dock" | "pause" | "resume" | "speed_limit" | "emergency">(null);

  const availableTags = Array.from(new Set((robotsQuery.data ?? []).flatMap((robot) => robot.tags))).sort();
  const availableCapabilities = Array.from(new Set((robotsQuery.data ?? []).flatMap((robot) => robot.capabilities))).sort();
  const availableVendors = Array.from(
    new Map((robotsQuery.data ?? []).map((robot) => [robot.vendor.id, robot.vendor])).values()
  );

  const hasRobotControl = can("robots.control");

  function closeDrawer() {
    setSelectedRobotId(null);
    setActiveTab("Summary");
  }

  async function runRobotAction(action: "dock" | "pause" | "resume" | "speed_limit") {
    if (!selectedRobotId) {
      return;
    }
    await actionMutation.mutateAsync({
      path: `/robots/${selectedRobotId}/actions`,
      body: {
        action,
        params: action === "speed_limit" ? { max_speed_mps: 0.8 } : {}
      }
    });
    setConfirmAction(null);
  }

  function downloadTelemetryCsv() {
    if (!telemetryQuery.data) {
      return;
    }

    const header = ["timestamp", "value", "count", "min", "max"];
    const rows = telemetryQuery.data.points.map((point) => [
      point.timestamp,
      String(point.value),
      String(point.count),
      String(point.min ?? ""),
      String(point.max ?? "")
    ]);

    const csv = [header.join(","), ...rows.map((row) => row.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `telemetry-${telemetryQuery.data.robotId}-${telemetryMetric}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const robotMissions = (missionsQuery.data ?? []).filter((mission) => mission.assignedRobotId === selectedRobotId);
  const robotIncidents = (incidentsQuery.data ?? []).filter((incident) => incident.robotId === selectedRobotId);

  return (
    <div className="space-y-6">
      <PageTitle title="Fleet" subtitle="Operate and debug robots at scale with filters, diagnostics, and safe controls." />

      <Card>
        <CardTitle>Filters</CardTitle>
        <div className="mt-3 grid gap-2 md:grid-cols-6">
          <select
            className="rounded-2xl border border-border bg-white px-3 py-2 text-sm"
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">Status: all</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
            <option value="degraded">Degraded</option>
            <option value="maintenance">Maintenance</option>
            <option value="emergency_stop">Emergency stop</option>
          </select>
          <select
            className="rounded-2xl border border-border bg-white px-3 py-2 text-sm"
            aria-label="Filter by vendor"
            value={vendorFilter}
            onChange={(event) => setVendorFilter(event.target.value)}
          >
            <option value="all">Vendor: all</option>
            {availableVendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name}
              </option>
            ))}
          </select>
          <select
            className="rounded-2xl border border-border bg-white px-3 py-2 text-sm"
            aria-label="Filter by tag"
            value={tagFilter}
            onChange={(event) => setTagFilter(event.target.value)}
          >
            <option value="all">Tag: all</option>
            {availableTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
          <select
            className="rounded-2xl border border-border bg-white px-3 py-2 text-sm"
            aria-label="Filter by capability"
            value={capabilityFilter}
            onChange={(event) => setCapabilityFilter(event.target.value)}
          >
            <option value="all">Capability: all</option>
            {availableCapabilities.map((capability) => (
              <option key={capability} value={capability}>
                {capability}
              </option>
            ))}
          </select>
          <label className="rounded-2xl border border-border bg-white px-3 py-2 text-sm">
            Battery min
            <input
              type="number"
              min={0}
              max={100}
              value={batteryMin}
              onChange={(event) => setBatteryMin(event.target.value)}
              className="w-full border-none bg-transparent p-0 text-sm outline-none"
            />
          </label>
          <Button
            variant="secondary"
            onClick={() => {
              setStatusFilter("all");
              setVendorFilter("all");
              setTagFilter("all");
              setCapabilityFilter("all");
              setBatteryMin("0");
            }}
          >
            Reset filters
          </Button>
        </div>
      </Card>

      <DataTable>
        <Table>
          <THead>
            <tr>
              <Th>Robot</Th>
              <Th>Vendor</Th>
              <Th>Status</Th>
              <Th>Battery</Th>
              <Th>Site</Th>
              <Th>Zone</Th>
              <Th>Last seen</Th>
              <Th>Current mission</Th>
              <Th>Health score</Th>
            </tr>
          </THead>
          <tbody>
            {(robotsQuery.data ?? []).map((robot) => {
              const healthScore = Math.max(0, 100 - Math.round((robot.cpuPercent + robot.memoryPercent + robot.diskPercent) / 3));
              return (
                <Tr key={robot.id} className="cursor-pointer" onClick={() => setSelectedRobotId(robot.id)}>
                  <Td>
                    <p className="font-medium">{robot.name}</p>
                    <p className="text-xs text-muted">{robot.id}</p>
                  </Td>
                  <Td>{robot.vendor.name}</Td>
                  <Td>
                    <StatusChip status={robot.status} />
                  </Td>
                  <Td>{robot.batteryPercent}%</Td>
                  <Td>{robot.site.name}</Td>
                  <Td>{robot.floorplanId}</Td>
                  <Td>{formatDate(robot.lastSeenAt)}</Td>
                  <Td>{robot.missions[0]?.name ?? "-"}</Td>
                  <Td>{healthScore}</Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      </DataTable>

      <Drawer open={Boolean(selectedRobotId)} onClose={closeDrawer} title={selectedRobot?.name ?? "Robot detail"}>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {TAB_ITEMS.map((tab) => (
              <Button key={tab} variant={activeTab === tab ? "primary" : "secondary"} onClick={() => setActiveTab(tab)}>
                {tab}
              </Button>
            ))}
          </div>

          {activeTab === "Summary" && selectedRobotId && robotDetailQuery.data ? (
            <Card>
              <CardTitle>Robot summary</CardTitle>
              <div className="mt-3 grid gap-2 text-sm">
                <p>Battery: {robotDetailQuery.data.batteryPercent}%</p>
                <p>
                  CPU / Memory / Disk: {robotDetailQuery.data.cpuPercent}% / {robotDetailQuery.data.memoryPercent}% / {robotDetailQuery.data.diskPercent}%
                </p>
                <p>
                  Connectivity: {robotDetailQuery.data.connection} ({robotDetailQuery.data.ip})
                </p>
                <p>
                  Firmware: {robotDetailQuery.data.firmware} • Agent: {robotDetailQuery.data.agentVersion}
                </p>
                <p>Current mission: {robotDetailQuery.data.missions?.[0]?.name ?? "None"}</p>
                <p>Recent incidents: {robotIncidents.length}</p>
              </div>
            </Card>
          ) : null}

          {activeTab === "Telemetry" ? (
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle>Telemetry time series</CardTitle>
                  <CardMeta>
                    {telemetryQuery.data?.downsampled
                      ? `Downsampled (${telemetryQuery.data.aggregation}, bucket ${telemetryQuery.data.bucketSeconds}s)`
                      : "Raw series"}
                  </CardMeta>
                </div>
                <div className="flex flex-wrap gap-2">
                  <select
                    className="rounded-2xl border border-border bg-white px-3 py-2 text-xs"
                    value={telemetryMetric}
                    onChange={(event) => setTelemetryMetric(event.target.value as (typeof TELEMETRY_METRICS)[number])}
                    aria-label="Telemetry metric"
                  >
                    {TELEMETRY_METRICS.map((metric) => (
                      <option key={metric} value={metric}>
                        {metric}
                      </option>
                    ))}
                  </select>
                  <select
                    className="rounded-2xl border border-border bg-white px-3 py-2 text-xs"
                    value={telemetryRange}
                    onChange={(event) => setTelemetryRange(event.target.value as (typeof TELEMETRY_RANGES)[number])}
                    aria-label="Telemetry range"
                  >
                    {TELEMETRY_RANGES.map((range) => (
                      <option key={range} value={range}>
                        {range}
                      </option>
                    ))}
                  </select>
                  <Button variant="secondary" onClick={downloadTelemetryCsv}>
                    Download CSV
                  </Button>
                </div>
              </div>
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={telemetryQuery.data?.points ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#d6dbe7" />
                    <XAxis dataKey="timestamp" tickFormatter={(value) => new Date(value).toLocaleTimeString()} />
                    <YAxis />
                    <Tooltip labelFormatter={(value) => formatDate(value as string)} />
                    <Line dataKey="value" stroke="#2563eb" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-xs text-muted">
                {telemetryQuery.data?.points.length ?? 0} rendered points from {telemetryQuery.data?.totalPoints ?? 0} total points.
              </p>
            </Card>
          ) : null}

          {activeTab === "Logs" ? (
            <Card>
              <CardTitle>Structured logs</CardTitle>
              <CardMeta>Searchable stream placeholder for correlated diagnostics</CardMeta>
              <div className="mt-3 space-y-2 rounded-2xl border border-border bg-slate-950 p-3 font-mono text-xs text-slate-200">
                <p>[INFO] navigation loop running latency=42ms robot={selectedRobotId}</p>
                <p>[WARN] zone_ack_required zone=z3 mission=m2</p>
                <p>[INFO] telemetry stream metric={telemetryMetric} range={telemetryRange}</p>
              </div>
            </Card>
          ) : null}

          {activeTab === "Missions" ? (
            <Card>
              <CardTitle>Mission history</CardTitle>
              <ul className="mt-3 space-y-2 text-sm">
                {robotMissions.map((mission) => (
                  <li key={mission.id} className="rounded-2xl border border-border bg-surface p-3">
                    <p className="font-medium">{mission.name}</p>
                    <p className="text-xs text-muted">
                      {mission.state} • {formatDate(mission.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {activeTab === "Controls" ? (
            <Card>
              <CardTitle>Safe controls</CardTitle>
              {!hasRobotControl ? (
                <p className="mt-2 text-sm text-muted">You do not have `robots.control` permission.</p>
              ) : (
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <Button onClick={() => setConfirmAction("pause")}>Pause mission</Button>
                  <Button onClick={() => setConfirmAction("resume")}>Resume mission</Button>
                  <Button onClick={() => setConfirmAction("dock")}>Send to dock</Button>
                  <Button onClick={() => setConfirmAction("speed_limit")} variant="secondary">
                    Set speed limit
                  </Button>
                  <Button variant="secondary">Request snapshot</Button>
                  <Button variant="danger" onClick={() => setConfirmAction("emergency")}>Emergency stop</Button>
                </div>
              )}
            </Card>
          ) : null}

          {activeTab === "Diagnostics" ? (
            <Card>
              <CardTitle>Diagnostics</CardTitle>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
                <li>Check RSSI and handoff behavior if degraded on LTE.</li>
                <li>Inspect temperature trend against mission workload.</li>
                <li>Review recent zone acknowledgments for restricted routes.</li>
              </ul>
            </Card>
          ) : null}

          {activeTab === "Audit" ? (
            <Card>
              <CardTitle>Audit trail</CardTitle>
              <ul className="mt-3 space-y-2 text-sm">
                {(auditQuery.data?.items ?? []).slice(0, 25).map((entry) => (
                  <li key={entry.id} className="rounded-2xl border border-border bg-surface p-3">
                    <p className="font-medium">{entry.action}</p>
                    <p className="text-xs text-muted">
                      {entry.actorId} • {formatDate(entry.timestamp)}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      </Drawer>

      <ConfirmDialog
        open={confirmAction !== null}
        title={confirmAction === "emergency" ? "Confirm emergency stop" : "Confirm robot action"}
        description={
          confirmAction === "emergency"
            ? "Emergency stop is safety-critical and requires explicit control in the robot console."
            : `Are you sure you want to run ${confirmAction?.replace("_", " ")} on this robot?`
        }
        confirmLabel={confirmAction === "emergency" ? "Understood" : "Run action"}
        variant="danger"
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => {
          if (!confirmAction) return;
          if (confirmAction === "emergency") {
            setConfirmAction(null);
            return;
          }
          void runRobotAction(confirmAction);
        }}
      />
    </div>
  );
}
