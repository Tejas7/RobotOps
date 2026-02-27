import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import type { RequestUser } from "../auth/types";
import { CopilotService } from "../services/copilot.service";
import { OpsService } from "../services/ops.service";

@Controller("copilot")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CopilotController {
  constructor(
    @Inject(CopilotService) private readonly copilotService: CopilotService,
    @Inject(OpsService) private readonly opsService: OpsService
  ) {}

  @Get("thread/:id")
  @RequirePermissions("missions.read")
  getThread(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.copilotService.getThread(user.tenantId, id);
  }

  @Post("thread")
  @RequirePermissions("missions.read")
  createThread(@CurrentUser() user: RequestUser, @Query("site_id") siteId?: string) {
    return this.copilotService.createThread(user.tenantId, user.sub, siteId ?? null);
  }

  @Post("message")
  @RequirePermissions("missions.read")
  async sendMessage(@CurrentUser() user: RequestUser, @Body() body: unknown) {
    const parsed = await this.opsService.assertCopilotMessageInput(body);
    return this.copilotService.sendMessage(user.tenantId, user, parsed.thread_id, parsed.content);
  }
}
