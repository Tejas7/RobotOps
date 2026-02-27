"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { missionCreateSchema, type MissionCreateInput } from "@robotops/shared";
import { Button } from "@/components/ui/button";
import { Card, CardMeta, CardTitle } from "@/components/ui/card";
import { DataTable, Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { Drawer } from "@/components/ui/drawer";
import { PageTitle } from "@/components/pages/page-title";
import { useAuthedMutation } from "@/hooks/use-authed-mutation";
import { useAuthedQuery } from "@/hooks/use-authed-query";
import { useGlobalFilters } from "@/store/use-global-filters";
import { formatDate } from "@/lib/utils";

interface Mission {
  id: string;
  name: string;
  type: string;
  priority: string;
  state: string;
  startTime: string | null;
  endTime: string | null;
  durationS: number;
  distanceM: number;
  stopsCount: number;
  interventionsCount: number;
  energyUsedWh: number;
  routeWaypoints: Array<{ name: string; x: number; y: number; zone_id?: string }>;
  routePolyline: Array<{ x: number; y: number }>;
  failureCode: string | null;
  failureMessage: string | null;
  missionEvents: Array<{ id: string; type: string; timestamp: string; payload: unknown }>;
}

interface Robot {
  id: string;
  name: string;
  capabilities: string[];
}

export default function MissionsPage() {
  const { siteId } = useGlobalFilters();
  const [view, setView] = useState<"queue" | "kanban" | "calendar" | "table">("table");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const missionsQuery = useAuthedQuery<Mission[]>(["missions", siteId], `/missions?site_id=${siteId}`);
  const robotsQuery = useAuthedQuery<Robot[]>(["robots-last-state", siteId], `/robots/last_state?site_id=${siteId}`);

  const createMissionMutation = useAuthedMutation<Mission>();

  const selectedMission = useMemo(
    () => missionsQuery.data?.find((mission) => mission.id === selectedId) ?? null,
    [missionsQuery.data, selectedId]
  );

  const form = useForm<MissionCreateInput>({
    resolver: zodResolver(missionCreateSchema),
    defaultValues: {
      name: "",
      type: "pickup_dropoff",
      priority: "normal",
      site_id: siteId,
      assigned_robot_id: null,
      operator_acknowledged_restricted_zones: false,
      route: {
        waypoints: [
          { name: "Pickup", x: 120, y: 60, zone_id: "z2" },
          { name: "Dropoff", x: 70, y: 80, zone_id: "z1" }
        ],
        planned_path_polyline: [
          { x: 120, y: 60 },
          { x: 90, y: 70 },
          { x: 70, y: 80 }
        ]
      }
    }
  });

  async function handleCreate(values: MissionCreateInput) {
    try {
      await createMissionMutation.mutateAsync({
        path: "/missions",
        method: "POST",
        body: values
      });
      await missionsQuery.refetch();
      setCreateOpen(false);
      form.reset({ ...form.getValues(), name: "" });
    } catch {
      // error surfaced by mutation status area
    }
  }

  return (
    <div className="space-y-6">
      <PageTitle title="Missions" subtitle="Create, schedule, track, and analyze missions with route and event visibility." />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {(["queue", "kanban", "calendar", "table"] as const).map((mode) => (
              <Button key={mode} variant={view === mode ? "primary" : "secondary"} onClick={() => setView(mode)}>
                {mode}
              </Button>
            ))}
          </div>
          <Button onClick={() => setCreateOpen(true)}>Create mission</Button>
        </div>
      </Card>

      <DataTable>
        <Table>
          <THead>
            <tr>
              <Th>Name</Th>
              <Th>Type</Th>
              <Th>Priority</Th>
              <Th>State</Th>
              <Th>Start</Th>
              <Th>End</Th>
              <Th>Duration (s)</Th>
            </tr>
          </THead>
          <tbody>
            {(missionsQuery.data ?? []).map((mission) => (
              <Tr key={mission.id} className="cursor-pointer" onClick={() => setSelectedId(mission.id)}>
                <Td>{mission.name}</Td>
                <Td>{mission.type}</Td>
                <Td>{mission.priority}</Td>
                <Td>{mission.state}</Td>
                <Td>{formatDate(mission.startTime)}</Td>
                <Td>{formatDate(mission.endTime)}</Td>
                <Td>{mission.durationS}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </DataTable>

      <Drawer open={Boolean(selectedMission)} onClose={() => setSelectedId(null)} title={selectedMission?.name ?? "Mission detail"}>
        {selectedMission ? (
          <div className="space-y-4">
            <Card>
              <CardTitle>Status header</CardTitle>
              <CardMeta>
                {selectedMission.state} • {selectedMission.priority}
              </CardMeta>
              <p className="mt-2 text-sm text-muted">
                Start: {formatDate(selectedMission.startTime)} | End: {formatDate(selectedMission.endTime)}
              </p>
            </Card>

            <Card>
              <CardTitle>Route and waypoints</CardTitle>
              <CardMeta>Map overlay (simplified polyline preview)</CardMeta>
              <pre className="mt-3 overflow-auto rounded-2xl border border-border bg-white p-3 text-xs">
                {JSON.stringify(
                  {
                    waypoints: selectedMission.routeWaypoints,
                    polyline: selectedMission.routePolyline
                  },
                  null,
                  2
                )}
              </pre>
            </Card>

            <Card>
              <CardTitle>Mission events timeline</CardTitle>
              <ul className="mt-3 space-y-2 text-sm">
                {(selectedMission.missionEvents ?? []).map((event) => (
                  <li key={event.id} className="rounded-2xl border border-border bg-surface p-3">
                    <p className="font-medium">{event.type}</p>
                    <p className="text-xs text-muted">{formatDate(event.timestamp)}</p>
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <CardTitle>KPI summary</CardTitle>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <p>Distance: {selectedMission.distanceM}m</p>
                <p>Stops: {selectedMission.stopsCount}</p>
                <p>Interventions: {selectedMission.interventionsCount}</p>
                <p>Energy: {selectedMission.energyUsedWh} Wh</p>
              </div>
            </Card>

            <Card>
              <CardTitle>Exceptions and interventions</CardTitle>
              <p className="mt-2 text-sm text-muted">{selectedMission.failureMessage ?? "No active failure detected."}</p>
            </Card>
          </div>
        ) : null}
      </Drawer>

      <Drawer open={createOpen} onClose={() => setCreateOpen(false)} title="Create mission">
        <form className="space-y-3" onSubmit={form.handleSubmit(handleCreate)}>
          <label className="block text-sm">
            Name
            <input className="mt-1 w-full rounded-2xl border border-border bg-white px-3 py-2" {...form.register("name")} />
          </label>

          <label className="block text-sm">
            Type
            <select className="mt-1 w-full rounded-2xl border border-border bg-white px-3 py-2" {...form.register("type")}>
              <option value="pickup_dropoff">pickup_dropoff</option>
              <option value="patrol">patrol</option>
              <option value="inventory">inventory</option>
              <option value="cleaning">cleaning</option>
              <option value="custom">custom</option>
            </select>
          </label>

          <label className="block text-sm">
            Priority
            <select className="mt-1 w-full rounded-2xl border border-border bg-white px-3 py-2" {...form.register("priority")}>
              <option value="low">low</option>
              <option value="normal">normal</option>
              <option value="high">high</option>
              <option value="critical">critical</option>
            </select>
          </label>

          <label className="block text-sm">
            Site
            <input className="mt-1 w-full rounded-2xl border border-border bg-slate-100 px-3 py-2" {...form.register("site_id")} readOnly />
          </label>

          <label className="block text-sm">
            Robot selection
            <select
              className="mt-1 w-full rounded-2xl border border-border bg-white px-3 py-2"
              value={form.watch("assigned_robot_id") ?? ""}
              onChange={(event) => form.setValue("assigned_robot_id", event.target.value || null)}
            >
              <option value="">Auto assign</option>
              {(robotsQuery.data ?? []).map((robot) => (
                <option key={robot.id} value={robot.id}>
                  {robot.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 rounded-2xl border border-border bg-surface p-2 text-sm">
            <input type="checkbox" {...form.register("operator_acknowledged_restricted_zones")} />
            Operator acknowledged restricted zones
          </label>

          <Card>
            <CardTitle>Route constraints and waypoints</CardTitle>
            <p className="mt-2 text-xs text-muted">MVP form uses seeded waypoints to keep validation deterministic.</p>
          </Card>

          {Object.keys(form.formState.errors).length ? (
            <pre className="rounded-2xl border border-danger/30 bg-rose-50 p-2 text-xs text-rose-700">
              {JSON.stringify(form.formState.errors, null, 2)}
            </pre>
          ) : null}

          {createMissionMutation.isError ? (
            <p className="text-sm text-danger">{(createMissionMutation.error as Error).message}</p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMissionMutation.isPending}>
              {createMissionMutation.isPending ? "Creating..." : "Create mission"}
            </Button>
          </div>
        </form>
      </Drawer>
    </div>
  );
}
