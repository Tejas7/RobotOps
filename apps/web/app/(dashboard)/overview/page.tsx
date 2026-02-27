"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { useAuthedQuery } from "@/hooks/use-authed-query";
import { useLiveSocket } from "@/hooks/use-live-socket";
import { useGlobalFilters } from "@/store/use-global-filters";
import { Card, CardMeta, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { PageTitle } from "@/components/pages/page-title";
import { FacilityMap } from "@/components/pages/facility-map";
import { formatDate } from "@/lib/utils";

interface Robot {
  id: string;
  status: string;
  batteryPercent: number;
  name: string;
  x: number;
  y: number;
  floorplanId: string;
}

interface Mission {
  id: string;
  state: string;
  createdAt: string;
  durationS: number;
}

interface Incident {
  id: string;
  status: string;
  category: string;
  severity: string;
  createdAt: string;
  title: string;
  robotId: string | null;
}

interface Floorplan {
  id: string;
  imageUrl: string;
  zones: Array<{ id: string; name: string; type: string; polygon: Array<{ x: number; y: number }> }>;
}

export default function OverviewPage() {
  const { siteId, timeRange } = useGlobalFilters();
  const searchParams = useSearchParams();
  const effectiveSiteId = searchParams.get("site_id") ?? siteId;
  const effectiveTimeRange = searchParams.get("time_range") ?? timeRange;
  const { socket } = useLiveSocket();
  const robotsQuery = useAuthedQuery<Robot[]>(["robots", effectiveSiteId], `/robots?site_id=${effectiveSiteId}`);
  const missionsQuery = useAuthedQuery<Mission[]>(["missions", effectiveSiteId], `/missions?site_id=${effectiveSiteId}`);
  const incidentsQuery = useAuthedQuery<Incident[]>(["incidents", effectiveSiteId], `/incidents?site_id=${effectiveSiteId}`);
  const floorplansQuery = useAuthedQuery<Floorplan[]>(["floorplans", effectiveSiteId], `/floorplans?site_id=${effectiveSiteId}`);

  const [liveRobots, setLiveRobots] = useState<Robot[] | null>(null);
  const [liveIncidents, setLiveIncidents] = useState<Incident[] | null>(null);
  const robots = liveRobots ?? robotsQuery.data ?? [];
  const missions = missionsQuery.data ?? [];
  const incidents = liveIncidents ?? incidentsQuery.data ?? [];

  useEffect(() => {
    if (!socket) {
      return;
    }
    const onRobots = (payload: { data: Robot[] }) => setLiveRobots(payload.data);
    const onIncidents = (payload: { data: Incident[] }) => setLiveIncidents(payload.data);
    socket.on("robots.live", onRobots);
    socket.on("incidents.live", onIncidents);
    return () => {
      socket.off("robots.live", onRobots);
      socket.off("incidents.live", onIncidents);
    };
  }, [socket]);

  const activeRobots = robots.filter((robot) => robot.status === "online" || robot.status === "degraded").length;
  const uptimePercent = robots.length ? Math.round((robots.filter((robot) => robot.status === "online").length / robots.length) * 100) : 0;
  const missionsCompleted = missions.filter((mission) => mission.state === "succeeded").length;
  const openIncidents = incidents.filter((incident) => incident.status !== "resolved").length;
  const avgMissionDuration = missions.length
    ? Math.round(missions.reduce((sum, mission) => sum + mission.durationS, 0) / missions.length)
    : 0;
  const interventions = missions.reduce((sum, mission) => sum + (mission.state === "blocked" ? 1 : 0), 0);

  const healthDistribution = Object.entries(
    robots.reduce(
      (acc, robot) => {
        acc[robot.status] = (acc[robot.status] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    )
  ).map(([name, value]) => ({ name, value }));

  const incidentCategories = Object.entries(
    incidents.reduce(
      (acc, incident) => {
        acc[incident.category] = (acc[incident.category] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    )
  )
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const missionTimeline = missions
    .slice(0, 10)
    .map((mission) => ({
      name: mission.id,
      state: mission.state,
      duration: Math.max(1, Math.round(mission.durationS / 60))
    }))
    .reverse();

  const floorplan = floorplansQuery.data?.[0];
  const floorplanImageUrl = floorplan?.imageUrl;

  return (
    <div className="space-y-6">
      <PageTitle
        title="Overview"
        subtitle={`Executive summary for site ${effectiveSiteId} in the last ${effectiveTimeRange}. Click KPI cards to drill into relevant pages.`}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Link href="/fleet" className="block">
          <KpiCard title="Active robots" value={activeRobots} meta="Online + degraded" />
        </Link>
        <KpiCard title="Uptime" value={`${uptimePercent}%`} meta="Online share" />
        <Link href="/missions" className="block">
          <KpiCard title="Missions completed" value={missionsCompleted} meta="Succeeded missions" />
        </Link>
        <Link href="/incidents" className="block">
          <KpiCard title="Open incidents" value={openIncidents} meta="Non-resolved incidents" />
        </Link>
        <KpiCard title="Avg mission duration" value={`${avgMissionDuration}s`} />
        <KpiCard title="Interventions count" value={interventions} />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardTitle>Fleet health distribution</CardTitle>
          <CardMeta>Status counts by robot state</CardMeta>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={healthDistribution} dataKey="value" nameKey="name" outerRadius={95} label>
                  {healthDistribution.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={{
                        online: "#22c55e",
                        degraded: "#f59e0b",
                        offline: "#94a3b8",
                        maintenance: "#0ea5e9",
                        emergency_stop: "#ef4444"
                      }[entry.name] ?? "#94a3b8"}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardTitle>Top recurring incident categories</CardTitle>
          <CardMeta>Most frequent issue classes</CardMeta>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={incidentCategories} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d6dbe7" />
                <XAxis type="number" tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="category" tickLine={false} axisLine={false} width={110} />
                <Tooltip />
                <Bar dataKey="count" fill="#2563eb" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardTitle>Recent mission outcomes timeline</CardTitle>
          <CardMeta>Latest mission runs and durations</CardMeta>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={missionTimeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d6dbe7" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip />
                <Bar dataKey="duration" fill="#0ea5e9" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardTitle>Map mini view</CardTitle>
          <CardMeta>Robots and floorplan context</CardMeta>
          <div className="mt-4">
            <FacilityMap
              className="h-72"
              floorplanImageUrl={floorplanImageUrl}
              robots={robots.map((robot) => ({ id: robot.id, name: robot.name, status: robot.status, x: robot.x, y: robot.y }))}
              zones={floorplan?.zones ?? []}
              assets={[]}
            />
          </div>
        </Card>
      </section>

      <Card>
        <CardTitle>Copilot prompt bar</CardTitle>
        <CardMeta>Ask RobotOps for operational analysis with citations.</CardMeta>
        <div className="mt-4 flex items-center gap-3">
          <Link href="/copilot" className="flex-1 rounded-full border border-border bg-white px-4 py-2 text-sm text-muted">
            Ask RobotOps: Why did mission throughput drop in Zone A yesterday?
          </Link>
          <Link href="/copilot" className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-white">
            Open Copilot
          </Link>
        </div>
      </Card>

      <Card>
        <CardTitle>Recent incident highlights</CardTitle>
        <CardMeta>Quick list of latest incidents for triage</CardMeta>
        <ul className="mt-3 space-y-2 text-sm">
          {incidents.slice(0, 5).map((incident) => (
            <li key={incident.id} className="rounded-2xl border border-border bg-white px-3 py-2">
              <p className="font-medium">{incident.title}</p>
              <p className="text-xs text-muted">
                {incident.severity} • {incident.category} • {formatDate(incident.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
