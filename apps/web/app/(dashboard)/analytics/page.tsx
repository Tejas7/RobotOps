import { Card, CardMeta, CardTitle } from "@/components/ui/card";
import { PageTitle } from "@/components/pages/page-title";

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <PageTitle title="Analytics" subtitle="Performance, reliability, utilization, and export workflows." />
      <Card>
        <CardTitle>Phase 1 note</CardTitle>
        <CardMeta>Dashboard placeholders are intentionally minimal in MVP.</CardMeta>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
          <li>Fleet uptime and reliability metrics</li>
          <li>Mission throughput by hour and zone</li>
          <li>Top failure modes by vendor and model</li>
          <li>Interventions per 100 missions</li>
          <li>Energy and utilization analysis</li>
        </ul>
      </Card>
    </div>
  );
}
