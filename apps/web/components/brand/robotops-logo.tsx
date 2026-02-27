import Image from "next/image";
import { cn } from "@/lib/utils";

interface RobotOpsLogoProps {
  className?: string;
  iconSize?: number;
  showSubtitle?: boolean;
  titleClassName?: string;
  subtitleClassName?: string;
}

export function RobotOpsLogo({
  className,
  iconSize = 34,
  showSubtitle = false,
  titleClassName,
  subtitleClassName
}: RobotOpsLogoProps) {
  return (
    <div className={cn("inline-flex items-center gap-3", className)}>
      <Image src="/static/brand/robotops-mark.svg" alt="RobotOps" width={iconSize} height={iconSize} className="shrink-0 rounded-xl" priority />
      <div className="leading-tight">
        <p className={cn("text-base font-semibold tracking-[0.02em] text-text", titleClassName)}>RobotOps</p>
        {showSubtitle ? <p className={cn("text-xs text-muted", subtitleClassName)}>Operations</p> : null}
      </div>
    </div>
  );
}
