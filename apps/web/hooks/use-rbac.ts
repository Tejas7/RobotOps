"use client";

import { useSession } from "next-auth/react";
import type { Permission } from "@robotops/shared";
import { hasAnyPermission, hasPermission } from "@/lib/rbac";

export function useRbac() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const permissions = session?.user?.permissions;

  return {
    can: (permission: Permission) => hasPermission(role, permissions, permission),
    canAny: (required: Permission[]) => hasAnyPermission(role, permissions, required)
  };
}
