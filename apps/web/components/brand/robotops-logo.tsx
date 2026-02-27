import Image from "next/image";
import { cn } from "@/lib/utils";

interface RobotOpsLogoProps {
  className?: string;
  iconSize?: number;
  showSubtitle?: boolean;
}

export function RobotOpsLogo({ className, iconSize = 34, showSubtitle = false }: RobotOpsLogoProps) {
  return (
    <div className={cn("inline-flex items-center gap-3", className)}>
      <Image src="/static/brand/robotops-mark.svg" alt="RobotOps" width={iconSize} height={iconSize} className="shrink-0 rounded-xl" priority />
      <div className="leading-tight">
        <p className="text-base font-semibold tracking-[0.02em] text-text">RobotOps</p>
        {showSubtitle ? <p className="text-xs text-muted">Operations</p> : null}
      </div>
    </div>
  );
}
