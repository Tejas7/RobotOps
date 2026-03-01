"use client";

import { Bell, ChevronDown, LogOut, Search } from "lucide-react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import type { Route } from "next";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useGlobalFilters } from "@/store/use-global-filters";

export function TopHeader() {
  const { data: session } = useSession();
  const { siteId, timeRange, setSiteId, setTimeRange } = useGlobalFilters();
  const searchParams = useSearchParams();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const urlSiteId = searchParams?.get("site_id");
    const urlTimeRange = searchParams?.get("time_range");

    if (urlSiteId && urlSiteId !== siteId) {
      setSiteId(urlSiteId);
    }
    if (urlTimeRange && urlTimeRange !== timeRange) {
      setTimeRange(urlTimeRange);
    }
  }, [searchParams, setSiteId, setTimeRange, siteId, timeRange]);

  useEffect(() => {
    if (!accountMenuOpen) {
      return;
    }

    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as Node;
      if (accountMenuRef.current && !accountMenuRef.current.contains(target)) {
        setAccountMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setAccountMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [accountMenuOpen]);

  const firstName = session?.user?.name?.trim().split(/\s+/)[0] ?? "Unknown";

  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-bg/90 px-4 py-3 backdrop-blur md:px-8">
      <label className="ml-auto flex min-w-[200px] flex-1 items-center gap-2 rounded-full border border-border bg-white px-3 py-2 text-sm text-muted sm:w-[360px] sm:flex-none">
        <Search size={16} />
        <input className="min-w-0 flex-1 bg-transparent outline-none" placeholder="Search robots, missions, incidents" />
      </label>

      <button type="button" className="shrink-0 rounded-full border border-border bg-white p-2 text-muted hover:text-text" aria-label="Notifications">
        <Bell size={16} />
      </button>

      <div className="relative shrink-0" ref={accountMenuRef}>
        <button
          type="button"
          className="flex items-center gap-2 rounded-full border border-border bg-white px-3 py-1.5 text-xs"
          aria-haspopup="menu"
          aria-expanded={accountMenuOpen}
          onClick={() => setAccountMenuOpen((current) => !current)}
        >
          <div className="text-right">
            <p className="font-semibold leading-tight">{firstName}</p>
          </div>
          <ChevronDown size={14} className={`text-muted transition ${accountMenuOpen ? "rotate-180" : ""}`} />
        </button>

        {accountMenuOpen ? (
          <div
            role="menu"
            aria-label="Account menu"
            className="absolute right-0 top-[calc(100%+0.5rem)] z-30 min-w-[160px] rounded-2xl border border-border bg-white p-1 shadow-soft"
          >
            <Link
              href={"/profile" as Route}
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-text hover:bg-surface"
              onClick={() => setAccountMenuOpen(false)}
            >
              Profile
            </Link>
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-text hover:bg-surface"
              onClick={() => {
                setAccountMenuOpen(false);
                void signOut({ callbackUrl: "/login" });
              }}
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
