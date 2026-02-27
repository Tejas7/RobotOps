"use client";

import Link from "next/link";
import type { Route } from "next";
import { BookmarkPlus, ShieldCheck } from "lucide-react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { useAuthedMutation } from "@/hooks/use-authed-mutation";
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

interface Site {
  id: string;
  name: string;
}

interface SavedView {
  id: string;
  page: string;
  name: string;
  filters: Record<string, unknown>;
  isShared: boolean;
}

interface RoleDefault {
  id: string;
  role: string;
  page: string;
  savedViewId: string;
}

interface SavedViewsResponse {
  items: SavedView[];
  defaults: RoleDefault[];
}

const TIME_RANGES = ["1h", "6h", "24h", "7d"];

export default function OverviewPage() {
  const { data: session } = useSession();
  const { siteId, timeRange, setSiteId, setTimeRange } = useGlobalFilters();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const effectiveSiteId = searchParams.get("site_id") ?? siteId;
  const effectiveTimeRange = searchParams.get("time_range") ?? timeRange;
  const { socket } = useLiveSocket();
  const [selectedSavedViewId, setSelectedSavedViewId] = useState("");
  const [defaultApplied, setDefaultApplied] = useState(false);

  const sitesQuery = useAuthedQuery<Site[]>(["sites"], "/sites");
  const savedViewsQuery = useAuthedQuery<SavedViewsResponse>(["saved-views", "overview"], "/saved-views?page=overview");
  const createSavedViewMutation = useAuthedMutation<SavedView>();
  const setDefaultSavedViewMutation = useAuthedMutation<RoleDefault>();

  const robotsQuery = useAuthedQuery<Robot[]>(["robots-last-state", effectiveSiteId], `/robots/last_state?site_id=${effectiveSiteId}`);
  const missionsQuery = useAuthedQuery<Mission[]>(["missions", effectiveSiteId], `/missions?site_id=${effectiveSiteId}`);
  const incidentsQuery = useAuthedQuery<Incident[]>(["incidents", effectiveSiteId], `/incidents?site_id=${effectiveSiteId}`);
  const floorplansQuery = useAuthedQuery<Floorplan[]>(["floorplans", effectiveSiteId], `/floorplans?site_id=${effectiveSiteId}`);

  const [liveRobots, setLiveRobots] = useState<Robot[] | null>(null);
  const [liveIncidents, setLiveIncidents] = useState<Incident[] | null>(null);
  const robots = liveRobots ?? robotsQuery.data ?? [];
  const missions = missionsQuery.data ?? [];
  const incidents = liveIncidents ?? incidentsQuery.data ?? [];

  function syncFiltersToUrl(nextSiteId: string, nextTimeRange: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("site_id", nextSiteId);
    params.set("time_range", nextTimeRange);
    router.replace(`${pathname}?${params.toString()}` as Route, { scroll: false });
  }

  async function applySavedView(viewId: string) {
    setSelectedSavedViewId(viewId);
    const view = (savedViewsQuery.data?.items ?? []).find((entry) => entry.id === viewId);
    if (!view) {
      return;
    }

    const nextSite = typeof view.filters.site_id === "string" ? view.filters.site_id : siteId;
    const nextRange = typeof view.filters.time_range === "string" ? view.filters.time_range : timeRange;
    setSiteId(nextSite);
    setTimeRange(nextRange);
    syncFiltersToUrl(nextSite, nextRange);
  }

  async function saveCurrentView() {
    const payload = {
      page: "overview",
      name: `overview ${new Date().toLocaleDateString()}`,
      filters: {
        site_id: effectiveSiteId,
        time_range: effectiveTimeRange
      },
      layout: {},
      is_shared: true
    };

    const created = await createSavedViewMutation.mutateAsync({ path: "/saved-views", method: "POST", body: payload });
    setSelectedSavedViewId(created.id);
    await savedViewsQuery.refetch();
  }

  async function setRoleDefault() {
    if (!selectedSavedViewId || !session?.user?.role) {
      return;
    }

    await setDefaultSavedViewMutation.mutateAsync({
      path: `/saved-views/${selectedSavedViewId}/set-default`,
      method: "POST",
      body: {
        role: session.user.role,
        page: "overview"
      }
    });
    await savedViewsQuery.refetch();
  }

  useEffect(() => {
    const urlSiteId = searchParams.get("site_id");
    const urlTimeRange = searchParams.get("time_range");

    if (urlSiteId && urlSiteId !== siteId) {
      setSiteId(urlSiteId);
    }
    if (urlTimeRange && urlTimeRange !== timeRange) {
      setTimeRange(urlTimeRange);
    }
  }, [searchParams, setSiteId, setTimeRange, siteId, timeRange]);

  useEffect(() => {
    if (defaultApplied) {
      return;
    }

    if (searchParams.get("site_id") || searchParams.get("time_range")) {
      setDefaultApplied(true);
      return;
    }

    const defaults = savedViewsQuery.data?.defaults ?? [];
    const items = savedViewsQuery.data?.items ?? [];
    const roleDefault = defaults.find((entry) => entry.role === session?.user?.role && entry.page === "overview");

    if (!roleDefault) {
      setDefaultApplied(true);
      return;
    }

    const view = items.find((entry) => entry.id === roleDefault.savedViewId);
    if (!view) {
      setDefaultApplied(true);
      return;
    }

    const nextSite = typeof view.filters.site_id === "string" ? view.filters.site_id : siteId;
    const nextRange = typeof view.filters.time_range === "string" ? view.filters.time_range : timeRange;
    setSiteId(nextSite);
    setTimeRange(nextRange);
    setSelectedSavedViewId(view.id);
    syncFiltersToUrl(nextSite, nextRange);
    setDefaultApplied(true);
  }, [defaultApplied, savedViewsQuery.data, searchParams, session?.user?.role, setSiteId, setTimeRange, siteId, timeRange]);

  useEffect(() => {
    if (!socket) {
      return;
    }
    const onRobots = (payload: { data: Array<Robot & { siteId?: string }> }) => {
      if (effectiveSiteId === "all") {
        setLiveRobots(payload.data);
        return;
      }
      setLiveRobots(payload.data.filter((robot) => robot.siteId === effectiveSiteId));
    };
    const onIncidents = (payload: { data: Incident[] }) => setLiveIncidents(payload.data);
    socket.on("robots.live", onRobots);
    socket.on("incidents.live", onIncidents);
    return () => {
      socket.off("robots.live", onRobots);
      socket.off("incidents.live", onIncidents);
    };
  }, [effectiveSiteId, socket]);

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
  const canSetDefault = session?.user?.role === "Owner" || session?.user?.permissions?.includes("config.write");

  return (
    <div className="space-y-6">
      <PageTitle
        title="Overview"
        subtitle={`Executive summary for site ${effectiveSiteId} in the last ${effectiveTimeRange}. Click KPI cards to drill into relevant pages.`}
      />

      <section className="rounded-3xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            className="min-w-[220px] rounded-full border border-border bg-white px-3 py-2 text-sm"
            aria-label="Select site"
            value={effectiveSiteId}
            onChange={(event) => {
              const nextSiteId = event.target.value;
              setSiteId(nextSiteId);
              syncFiltersToUrl(nextSiteId, effectiveTimeRange);
            }}
          >
            <option value="all">All sites</option>
            {(sitesQuery.data ?? [{ id: "s1", name: "Toronto Warehouse 01" }]).map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>

          <select
            className="w-[96px] shrink-0 rounded-full border border-border bg-white px-3 py-2 text-sm"
            aria-label="Select time range"
            value={effectiveTimeRange}
            onChange={(event) => {
              const nextTimeRange = event.target.value;
              setTimeRange(nextTimeRange);
              syncFiltersToUrl(effectiveSiteId, nextTimeRange);
            }}
          >
            {TIME_RANGES.map((range) => (
              <option key={range} value={range}>
                {range}
              </option>
            ))}
          </select>

          <select
            className="min-w-[200px] rounded-full border border-border bg-white px-3 py-2 text-sm"
            aria-label="Saved views"
            value={selectedSavedViewId}
            onChange={(event) => {
              void applySavedView(event.target.value);
            }}
          >
            <option value="">Saved views</option>
            {(savedViewsQuery.data?.items ?? []).map((view) => (
              <option key={view.id} value={view.id}>
                {view.name}
                {view.isShared ? " (shared)" : ""}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-border bg-white px-3 py-2 text-sm text-text"
            onClick={() => {
              void saveCurrentView();
            }}
          >
            <BookmarkPlus size={14} /> Save view
          </button>

          {canSetDefault ? (
            <button
              type="button"
              className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-border bg-white px-3 py-2 text-sm text-text disabled:opacity-50"
              disabled={!selectedSavedViewId}
              onClick={() => {
                void setRoleDefault();
              }}
            >
              <ShieldCheck size={14} /> Set role default
            </button>
          ) : null}
        </div>
      </section>

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
