import type { FastifyRequest } from "fastify";

import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-http-bearer";

import type { SubjectInfo } from "../auth.interface.ts";

import { AuthService } from "../auth.service.ts";

@Injectable()
export class BearerJwtStrategy extends PassportStrategy(
  Strategy,
  "bearer-jwt",
) {
  private readonly authService: AuthService;

  constructor(authService: AuthService) {
    super({ passReqToCallback: true });
    this.authService = authService;
  }

  async validate(
    req: FastifyRequest,
    bearerToken: string,
  ): Promise<SubjectInfo> {
    return this.authService.validateToken(bearerToken, req.id);
  }
}
