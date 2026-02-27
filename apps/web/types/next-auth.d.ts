import type { Role } from "@robotops/shared";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    accessToken: string;
    user: DefaultSession["user"] & {
      id: string;
      tenantId: string;
      role: Role;
      permissions: string[];
      scopeVersion?: number;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    tenantId?: string;
    role?: Role;
    permissions?: string[];
    scopeVersion?: number;
    accessToken?: string;
  }
}
