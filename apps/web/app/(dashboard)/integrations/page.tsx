import { Card, CardMeta, CardTitle } from "@/components/ui/card";
import { PageTitle } from "@/components/pages/page-title";

export default function IntegrationsPage() {
  return (
    <div className="space-y-6">
      <PageTitle title="Integrations" subtitle="Connector stubs for WMS, ERP, WES, messaging, RTLS partners, and SSO." />
      <Card>
        <CardTitle>Integration catalog</CardTitle>
        <CardMeta>Phase 1 includes stubs and test-connection placeholders.</CardMeta>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {[
            "Webhooks",
            "WMS / ERP / WES",
            "Slack / Teams",
            "RTLS partner",
            "SSO config"
          ].map((item) => (
            <div key={item} className="rounded-2xl border border-border bg-surface p-4">
              <p className="text-sm font-semibold">{item}</p>
              <p className="mt-1 text-xs text-muted">Connector stub ready for Phase 2 flows.</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
