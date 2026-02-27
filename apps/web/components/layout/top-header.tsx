"use client";

import { Bell, BookmarkPlus, Search, ShieldCheck } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuthedMutation } from "@/hooks/use-authed-mutation";
import { useAuthedQuery } from "@/hooks/use-authed-query";
import { useGlobalFilters } from "@/store/use-global-filters";

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
  updatedAt: string;
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
const DEFAULT_ELIGIBLE_PAGES = new Set(["overview", "analytics"]);

export function TopHeader() {
  const { data: session } = useSession();
  const { siteId, timeRange, setSiteId, setTimeRange } = useGlobalFilters();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selectedSavedViewId, setSelectedSavedViewId] = useState("");
  const [defaultApplied, setDefaultApplied] = useState<Record<string, boolean>>({});

  const pageKey = useMemo(() => {
    const parts = pathname.split("/").filter(Boolean);
    return parts[0] ?? "overview";
  }, [pathname]);

  const sitesQuery = useAuthedQuery<Site[]>(["sites"], "/sites");
  const savedViewsQuery = useAuthedQuery<SavedViewsResponse>(["saved-views", pageKey], `/saved-views?page=${pageKey}`);
  const createSavedViewMutation = useAuthedMutation<SavedView>();
  const setDefaultSavedViewMutation = useAuthedMutation<RoleDefault>();

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
    if (!DEFAULT_ELIGIBLE_PAGES.has(pageKey)) {
      return;
    }
    if (defaultApplied[pageKey]) {
      return;
    }

    const hasExplicitSite = Boolean(searchParams.get("site_id"));
    const hasExplicitRange = Boolean(searchParams.get("time_range"));
    if (hasExplicitSite || hasExplicitRange) {
      setDefaultApplied((current) => ({ ...current, [pageKey]: true }));
      return;
    }

    const defaults = savedViewsQuery.data?.defaults ?? [];
    const items = savedViewsQuery.data?.items ?? [];
    const roleDefault = defaults.find((entry) => entry.role === session?.user?.role && entry.page === pageKey);
    if (!roleDefault) {
      setDefaultApplied((current) => ({ ...current, [pageKey]: true }));
      return;
    }

    const view = items.find((entry) => entry.id === roleDefault.savedViewId);
    if (!view) {
      setDefaultApplied((current) => ({ ...current, [pageKey]: true }));
      return;
    }

    const nextSite = typeof view.filters.site_id === "string" ? view.filters.site_id : siteId;
    const nextRange = typeof view.filters.time_range === "string" ? view.filters.time_range : timeRange;
    setSiteId(nextSite);
    setTimeRange(nextRange);
    syncFiltersToUrl(nextSite, nextRange);
    setDefaultApplied((current) => ({ ...current, [pageKey]: true }));
  }, [
    defaultApplied,
    pageKey,
    savedViewsQuery.data,
    searchParams,
    session?.user?.role,
    setSiteId,
    setTimeRange,
    siteId,
    timeRange
  ]);

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
      page: pageKey,
      name: `${pageKey} ${new Date().toLocaleDateString()}`,
      filters: {
        site_id: siteId,
        time_range: timeRange
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
        page: pageKey
      }
    });
    await savedViewsQuery.refetch();
  }

  const canSetDefault = session?.user?.role === "Owner" || session?.user?.permissions?.includes("config.write");

  return (
    <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-border bg-bg/90 px-4 py-3 backdrop-blur md:px-8">
      <select
        className="rounded-full border border-border bg-white px-3 py-2 text-sm"
        aria-label="Select site"
        value={siteId}
        onChange={(event) => {
          const nextSiteId = event.target.value;
          setSiteId(nextSiteId);
          syncFiltersToUrl(nextSiteId, timeRange);
        }}
      >
        {(sitesQuery.data ?? [{ id: "s1", name: "Toronto Warehouse 01" }]).map((site) => (
          <option key={site.id} value={site.id}>
            {site.name}
          </option>
        ))}
      </select>

      <select
        className="rounded-full border border-border bg-white px-3 py-2 text-sm"
        aria-label="Select time range"
        value={timeRange}
        onChange={(event) => {
          const nextTimeRange = event.target.value;
          setTimeRange(nextTimeRange);
          syncFiltersToUrl(siteId, nextTimeRange);
        }}
      >
        {TIME_RANGES.map((range) => (
          <option key={range} value={range}>
            {range}
          </option>
        ))}
      </select>

      <select
        className="min-w-[180px] rounded-full border border-border bg-white px-3 py-2 text-sm"
        aria-label="Saved views"
        value={selectedSavedViewId}
        onChange={(event) => {
          void applySavedView(event.target.value);
        }}
      >
        <option value="">Saved views</option>
        {(savedViewsQuery.data?.items ?? []).map((view) => (
          <option key={view.id} value={view.id}>
            {view.name}{view.isShared ? " (shared)" : ""}
          </option>
        ))}
      </select>

      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-full border border-border bg-white px-3 py-2 text-xs text-text"
        onClick={() => {
          void saveCurrentView();
        }}
      >
        <BookmarkPlus size={14} /> Save view
      </button>

      {canSetDefault ? (
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-full border border-border bg-white px-3 py-2 text-xs text-text disabled:opacity-50"
          disabled={!selectedSavedViewId}
          onClick={() => {
            void setRoleDefault();
          }}
        >
          <ShieldCheck size={14} /> Set role default
        </button>
      ) : null}

      <label className="ml-auto flex min-w-[220px] items-center gap-2 rounded-full border border-border bg-white px-3 py-2 text-sm text-muted">
        <Search size={16} />
        <input className="w-full bg-transparent outline-none" placeholder="Search robots, missions, incidents" />
      </label>

      <button type="button" className="rounded-full border border-border bg-white p-2 text-muted hover:text-text" aria-label="Notifications">
        <Bell size={16} />
      </button>

      <div className="flex items-center gap-2 rounded-full border border-border bg-white px-3 py-1.5 text-xs">
        <div className="text-right">
          <p className="font-semibold leading-tight">{session?.user?.name ?? "Unknown"}</p>
          <p className="text-muted">{session?.user?.role ?? "Viewer"}</p>
        </div>
        <button
          type="button"
          className="rounded-full border border-border px-2 py-1 text-[11px] text-muted"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
