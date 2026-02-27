import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { normalizePermissions, permissionImplies, type Permission } from "@robotops/shared";
import { ANY_PERMISSIONS_KEY, PERMISSIONS_KEY } from "../decorators/permissions.decorator";
import type { RequestUser } from "../../auth/types";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    const requiredAnyPermissions = this.reflector.getAllAndOverride<Permission[]>(ANY_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    const hasNoAll = !requiredPermissions || requiredPermissions.length === 0;
    const hasNoAny = !requiredAnyPermissions || requiredAnyPermissions.length === 0;
    if (hasNoAll && hasNoAny) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user: RequestUser }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException("User not available for permission checks");
    }

    const normalized = normalizePermissions(user.permissions ?? []);
    const hasAll = hasNoAll
      ? true
      : requiredPermissions.every((required) => normalized.some((granted) => permissionImplies(granted, required)));
    const hasAny = hasNoAny
      ? true
      : requiredAnyPermissions.some((required) => normalized.some((granted) => permissionImplies(granted, required)));

    if ((!hasAll || !hasAny) && user.role !== "Owner") {
      throw new ForbiddenException("Insufficient permissions");
    }

    return true;
  }
}
