import { SetMetadata } from "@nestjs/common";
import type { Permission } from "@robotops/shared";

export const PERMISSIONS_KEY = "required_permissions";
export const ANY_PERMISSIONS_KEY = "required_any_permissions";
export const RequirePermissions = (...permissions: Permission[]) => SetMetadata(PERMISSIONS_KEY, permissions);
export const RequireAnyPermissions = (...permissions: Permission[]) => SetMetadata(ANY_PERMISSIONS_KEY, permissions);
