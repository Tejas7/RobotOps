import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import jwt from "jsonwebtoken";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing bearer token");
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      throw new UnauthorizedException("Missing JWT secret");
    }

    try {
      const decoded = jwt.verify(token, secret);
      request.user = decoded as Express.User;
      return true;
    } catch {
      throw new UnauthorizedException("Invalid token");
    }
  }
}
