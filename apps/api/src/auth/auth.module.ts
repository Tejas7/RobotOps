import { Module } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";

@Module({
  providers: [JwtAuthGuard, PermissionsGuard],
  exports: [JwtAuthGuard, PermissionsGuard]
})
export class AuthModule {}
