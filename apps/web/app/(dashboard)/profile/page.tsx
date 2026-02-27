"use client";

import { useSession } from "next-auth/react";
import { PageTitle } from "@/components/pages/page-title";
import { Card, CardMeta, CardTitle } from "@/components/ui/card";
import { useAuthedQuery } from "@/hooks/use-authed-query";
import { formatDate } from "@/lib/utils";

interface TenantInfo {
  id: string;
  name: string;
  plan: string;
  createdAt: string;
}

export default function ProfilePage() {
  const { data: session } = useSession();
  const tenantQuery = useAuthedQuery<TenantInfo>(["tenant-me"], "/tenants/me");
  const user = session?.user;
  const permissions = user?.permissions ?? [];

  return (
    <div className="space-y-6">
      <PageTitle title="Profile" subtitle="Account identity, role, permissions, and tenant details." />

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardTitle>Account</CardTitle>
          <CardMeta>Signed-in identity details</CardMeta>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">Name</dt>
              <dd className="font-medium text-text">{user?.name ?? "-"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">Email</dt>
              <dd className="font-medium text-text">{user?.email ?? "-"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">Role</dt>
              <dd className="font-medium text-text">{user?.role ?? "-"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">Tenant ID</dt>
              <dd className="font-medium text-text">{user?.tenantId ?? "-"}</dd>
            </div>
          </dl>
        </Card>

        <Card>
          <CardTitle>Tenant</CardTitle>
          <CardMeta>Organization context</CardMeta>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">Tenant name</dt>
              <dd className="font-medium text-text">{tenantQuery.data?.name ?? "-"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">Plan</dt>
              <dd className="font-medium text-text">{tenantQuery.data?.plan ?? "-"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">Created</dt>
              <dd className="font-medium text-text">{tenantQuery.data?.createdAt ? formatDate(tenantQuery.data.createdAt) : "-"}</dd>
            </div>
          </dl>
        </Card>
      </section>

      <Card>
        <CardTitle>Permissions</CardTitle>
        <CardMeta>Effective scopes in current session</CardMeta>
        {permissions.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {permissions.map((permission) => (
              <span key={permission} className="rounded-full border border-border bg-white px-2.5 py-1 text-xs text-text">
                {permission}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">No explicit permissions in session.</p>
        )}
      </Card>
    </div>
  );
}
