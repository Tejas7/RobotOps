import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { AuditEventInput } from "@robotops/shared";
import { PrismaService } from "./prisma.service";

@Injectable()
export class AuditService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async log(tenantId: string, input: AuditEventInput, ip = "127.0.0.1", userAgent = "robotops") {
    return this.prisma.auditLog.create({
      data: {
        id: randomUUID(),
        tenantId,
        timestamp: new Date(),
        actorType: input.actorType,
        actorId: input.actorId,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        diff: input.diff ?? {},
        ip,
        userAgent
      }
    });
  }
}
