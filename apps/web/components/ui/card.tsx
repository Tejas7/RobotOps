import { cn } from "@/lib/utils";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("rounded-3xl border border-border bg-surface p-5 shadow-soft", className)}>{children}</div>;
}

export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h3 className={cn("text-sm font-semibold text-text", className)}>{children}</h3>;
}

export function CardMeta({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted">{children}</p>;
}
