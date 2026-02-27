import type { Permission, Role } from "@robotops/shared";

export interface RequestUser {
  sub: string;
  email: string;
  name: string;
  tenantId: string;
  role: Role;
  permissions: Permission[];
  scope_version?: number;
}
