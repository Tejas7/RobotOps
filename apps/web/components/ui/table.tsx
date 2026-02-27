import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function DataTable({ children }: { children: React.ReactNode }) {
  return <div className="overflow-hidden rounded-3xl border border-border bg-white">{children}</div>;
}

export function Table({ children }: { children: React.ReactNode }) {
  return <table className="min-w-full divide-y divide-border text-sm">{children}</table>;
}

export function THead({ children }: { children: React.ReactNode }) {
  return <thead className="sticky top-0 z-10 bg-surface">{children}</thead>;
}

export function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-4 py-3 text-left text-xs font-semibold tracking-wide text-muted", className)}>{children}</th>;
}

export function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("whitespace-nowrap px-4 py-3", className)}>{children}</td>;
}

export function Tr({
  children,
  className,
  ...props
}: { children: React.ReactNode; className?: string } & HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={cn("border-t border-border transition hover:bg-slate-50", className)} {...props}>
      {children}
    </tr>
  );
}
