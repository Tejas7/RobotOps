"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { Card, CardMeta, CardTitle } from "@/components/ui/card";
import { PageTitle } from "@/components/pages/page-title";
import { Button } from "@/components/ui/button";
import { useAuthedQuery } from "@/hooks/use-authed-query";
import { apiFetch } from "@/lib/api";
import { useGlobalFilters } from "@/store/use-global-filters";

interface AnalyticsResponse {
  window: { from: string; to: string };
  kpis: {
    fleetSize: number;
    uptimePercent: number;
    missionsTotal: number;
    missionsSucceeded: number;
    incidentsOpen: number;
    interventionsPer100Missions: number;
  };
  missionThroughputByHour: Array<{ hour: string; count: number }>;
  missionThroughputByZone: Array<{ zone: string; count: number }>;
  topFailureModes: Array<{ category: string; vendorId: string; count: number }>;
  energyUsageByRobot: Array<{ robotId: string; energyWh: number; missionCount: number }>;
  utilizationByRobot: Array<{ robotId: string; name: string; utilizationPercent: number; idlePercent: number }>;
}

interface ExportResponse {
  format: "csv" | "pdf";
  filename: string;
  contentType: string;
  content: string;
}

export default function AnalyticsPage() {
  const { siteId, timeRange } = useGlobalFilters();
  const searchParams = useSearchParams();
  const { data: session } = useSession();

  const effectiveSiteId = searchParams.get("site_id") ?? siteId;
  const effectiveTimeRange = searchParams.get("time_range") ?? timeRange;

  const dashboardQuery = useAuthedQuery<AnalyticsResponse>(
    ["analytics-dashboard", effectiveSiteId, effectiveTimeRange],
    `/analytics/dashboard?site_id=${effectiveSiteId}`
  );

  const data = dashboardQuery.data;

  const kpiCards = useMemo(
    () => [
      { title: "Fleet size", value: data?.kpis.fleetSize ?? 0 },
      { title: "Uptime", value: `${data?.kpis.uptimePercent ?? 0}%` },
      { title: "Missions total", value: data?.kpis.missionsTotal ?? 0 },
      { title: "Missions succeeded", value: data?.kpis.missionsSucceeded ?? 0 },
      { title: "Incidents open", value: data?.kpis.incidentsOpen ?? 0 },
      {
        title: "Interventions / 100 missions",
        value: data?.kpis.interventionsPer100Missions ?? 0
      }
    ],
    [data]
  );

  async function download(format: "csv" | "pdf") {
    if (!session?.accessToken) {
      return;
    }
    const result = await apiFetch<ExportResponse>(
      `/analytics/export?format=${format}&site_id=${effectiveSiteId}`,
      session.accessToken
    );

    const blob =
      result.format === "pdf"
        ? new Blob([Uint8Array.from(atob(result.content), (char) => char.charCodeAt(0))], {
            type: result.contentType
          })
        : new Blob([result.content], { type: result.contentType });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = result.filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <PageTitle
        title="Analytics"
        subtitle={`Performance, reliability, and utilization for site ${effectiveSiteId} (${effectiveTimeRange}).`}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {kpiCards.map((kpi) => (
          <Card key={kpi.title}>
            <CardTitle>{kpi.title}</CardTitle>
            <p className="mt-2 text-3xl font-semibold tracking-tight">{kpi.value}</p>
          </Card>
        ))}
      </section>

      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <div>
            <CardTitle>Export analytics</CardTitle>
            <CardMeta>Download summarized reporting data</CardMeta>
          </div>
          <Button className="ml-auto" onClick={() => void download("csv")}>Export CSV</Button>
          <Button variant="secondary" onClick={() => void download("pdf")}>Export PDF summary</Button>
        </div>
      </Card>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardTitle>Mission throughput by hour</CardTitle>
          <CardMeta>Execution volume over time</CardMeta>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.missionThroughputByHour ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d6dbe7" />
                <XAxis dataKey="hour" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#2563eb" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardTitle>Mission throughput by zone</CardTitle>
          <CardMeta>Spatial concentration of mission load</CardMeta>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.missionThroughputByZone ?? []} layout="vertical" margin={{ left: 18 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d6dbe7" />
                <XAxis type="number" tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="zone" tickLine={false} axisLine={false} width={90} />
                <Tooltip />
                <Bar dataKey="count" fill="#0ea5e9" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardTitle>Top failure modes</CardTitle>
          <CardMeta>Category concentration by vendor</CardMeta>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.topFailureModes ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d6dbe7" />
                <XAxis dataKey="category" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#ef4444" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardTitle>Utilization vs idle time</CardTitle>
          <CardMeta>Robot-by-robot duty cycle balance</CardMeta>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip />
                <Pie
                  data={[
                    {
                      name: "Utilized",
                      value:
                        (data?.utilizationByRobot ?? []).reduce((sum, item) => sum + item.utilizationPercent, 0) /
                        Math.max(1, data?.utilizationByRobot.length ?? 1)
                    },
                    {
                      name: "Idle",
                      value:
                        (data?.utilizationByRobot ?? []).reduce((sum, item) => sum + item.idlePercent, 0) /
                        Math.max(1, data?.utilizationByRobot.length ?? 1)
                    }
                  ]}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={96}
                  label
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </section>

      <Card>
        <CardTitle>Energy usage by robot</CardTitle>
        <CardMeta>Energy draw and mission assignment intensity</CardMeta>
        <div className="mt-3 space-y-2 text-sm">
          {(data?.energyUsageByRobot ?? []).slice(0, 8).map((entry) => (
            <div key={entry.robotId} className="rounded-2xl border border-border bg-surface px-3 py-2">
              <p className="font-medium">{entry.robotId}</p>
              <p className="text-xs text-muted">{entry.energyWh} Wh across {entry.missionCount} missions</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
