"use client";

import { Bell, Search } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useAuthedQuery } from "@/hooks/use-authed-query";
import { useGlobalFilters } from "@/store/use-global-filters";

interface Site {
  id: string;
  name: string;
}

const TIME_RANGES = ["1h", "6h", "24h", "7d"];

export function TopHeader() {
  const { data: session } = useSession();
  const { siteId, timeRange, setSiteId, setTimeRange } = useGlobalFilters();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sitesQuery = useAuthedQuery<Site[]>(["sites"], "/sites");

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

  function syncFiltersToUrl(nextSiteId: string, nextTimeRange: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("site_id", nextSiteId);
    params.set("time_range", nextTimeRange);
    router.replace(`${pathname}?${params.toString()}` as Route, { scroll: false });
  }

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
