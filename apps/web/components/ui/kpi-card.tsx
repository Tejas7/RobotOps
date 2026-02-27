import { Card, CardMeta, CardTitle } from "./card";
import { formatNumber } from "@/lib/utils";

export function KpiCard({
  title,
  value,
  meta,
  onClick
}: {
  title: string;
  value: string | number;
  meta?: string;
  onClick?: () => void;
}) {
  if (!onClick) {
    return (
      <Card className="transition hover:-translate-y-0.5">
        <CardMeta>{title}</CardMeta>
        <p className="mt-3 text-3xl font-semibold tabular-nums">{typeof value === "number" ? formatNumber(value) : value}</p>
        {meta ? <CardTitle className="mt-2 text-xs font-medium text-muted">{meta}</CardTitle> : null}
      </Card>
    );
  }

  return (
    <button type="button" onClick={onClick} className="w-full text-left">
      <Card className="transition hover:-translate-y-0.5">
        <CardMeta>{title}</CardMeta>
        <p className="mt-3 text-3xl font-semibold tabular-nums">{typeof value === "number" ? formatNumber(value) : value}</p>
        {meta ? <CardTitle className="mt-2 text-xs font-medium text-muted">{meta}</CardTitle> : null}
      </Card>
    </button>
  );
}
