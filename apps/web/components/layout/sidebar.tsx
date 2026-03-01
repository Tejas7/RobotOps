"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RobotOpsLogo } from "@/components/brand/robotops-logo";
import { NAV_ITEMS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 border-r border-border bg-surface/80 p-6 backdrop-blur md:block">
      <div>
        <RobotOpsLogo showSubtitle />
      </div>
      <nav className="mt-8 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = (pathname ?? "").startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "block rounded-2xl px-3 py-2 text-sm transition",
                active ? "bg-white font-medium text-text shadow-soft" : "text-muted hover:bg-white/60 hover:text-text"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
