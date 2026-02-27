import { Card, CardMeta, CardTitle } from "@/components/ui/card";
import { PageTitle } from "@/components/pages/page-title";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageTitle title="Settings" subtitle="Tenant, role, dashboard, and policy settings." />
      <Card>
        <CardTitle>Configuration as code</CardTitle>
        <CardMeta>Schema-driven dashboard config editor lands in Phase 2.</CardMeta>
        <p className="mt-3 text-sm text-muted">
          Current MVP focuses on operations workflows, RBAC, and mission/incident handling.
        </p>
      </Card>
    </div>
  );
}
