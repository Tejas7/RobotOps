import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import type { RequestUser } from "../../auth/types";

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): RequestUser => {
  const request = ctx.switchToHttp().getRequest<Request>();
  return request.user as RequestUser;
});
