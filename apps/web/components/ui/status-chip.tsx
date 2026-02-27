import {
  AlertTriangle,
  CheckCircle2,
  CircleOff,
  Info,
  ShieldAlert,
  Wrench
} from "lucide-react";
import { cn } from "@/lib/utils";

const statusStyle = {
  online: {
    icon: CheckCircle2,
    className: "bg-green-100 text-green-700"
  },
  offline: {
    icon: CircleOff,
    className: "bg-slate-200 text-slate-700"
  },
  degraded: {
    icon: AlertTriangle,
    className: "bg-amber-100 text-amber-700"
  },
  maintenance: {
    icon: Wrench,
    className: "bg-sky-100 text-sky-700"
  },
  emergency_stop: {
    icon: ShieldAlert,
    className: "bg-rose-100 text-rose-700"
  },
  open: {
    icon: AlertTriangle,
    className: "bg-amber-100 text-amber-700"
  },
  acknowledged: {
    icon: Info,
    className: "bg-sky-100 text-sky-700"
  },
  resolved: {
    icon: CheckCircle2,
    className: "bg-green-100 text-green-700"
  }
} as const;

export function StatusChip({ status }: { status: keyof typeof statusStyle | string }) {
  const fallback = statusStyle.offline;
  const style = statusStyle[status as keyof typeof statusStyle] ?? fallback;
  const Icon = style.icon;

  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium", style.className)}>
      <Icon size={12} />
      <span>{status.replace("_", " ")}</span>
    </span>
  );
}
