import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Permission } from "@robotops/shared";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";
import type { RequestUser } from "../../auth/types";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user: RequestUser }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException("User not available for permission checks");
    }

    const hasAll = requiredPermissions.every((permission) => user.permissions.includes(permission));
    if (!hasAll && user.role !== "Owner") {
      throw new ForbiddenException("Insufficient permissions");
    }

    return true;
  }
}
