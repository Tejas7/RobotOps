import type { Permission, Role } from "@robotops/shared";

export function hasPermission(role: Role | undefined, permissions: string[] | undefined, required: Permission): boolean {
  if (role === "Owner") {
    return true;
  }
  return Boolean(permissions?.includes(required));
}

export function hasAnyPermission(
  role: Role | undefined,
  permissions: string[] | undefined,
  required: Permission[]
): boolean {
  if (role === "Owner") {
    return true;
  }
  return required.some((permission) => permissions?.includes(permission));
}
