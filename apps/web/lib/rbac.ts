import { normalizePermissions, permissionImplies, type Permission, type Role } from "@robotops/shared";

export function hasPermission(role: Role | undefined, permissions: string[] | undefined, required: Permission): boolean {
  if (role === "Owner") {
    return true;
  }
  const normalized = normalizePermissions(permissions ?? []);
  return normalized.some((permission) => permissionImplies(permission, required));
}

export function hasAnyPermission(
  role: Role | undefined,
  permissions: string[] | undefined,
  required: Permission[]
): boolean {
  if (role === "Owner") {
    return true;
  }
  const normalized = normalizePermissions(permissions ?? []);
  return required.some((requiredPermission) =>
    normalized.some((permission) => permissionImplies(permission, requiredPermission))
  );
}
