import type { CanActivate, ExecutionContext } from "@nestjs/common";
import type { FastifyRequest } from "fastify";

import { Injectable, Logger } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import "@fastify/accepts"; // Required to have proper types on `request.accepts()`.

import { NotAcceptableError } from "../errors/NotAcceptableError.ts";

@Injectable()
export class AcceptsGuard implements CanActivate {
  private readonly logger = new Logger(AcceptsGuard.name);

  private readonly reflector: Reflector;

  constructor(reflector: Reflector) {
    this.reflector = reflector;
  }

  canActivate(context: ExecutionContext): boolean {
    const acceptedContentTypes = this.reflector.get<string[]>(
      "accepts",
      context.getHandler(),
    );

    const request = context.switchToHttp().getRequest<FastifyRequest>();

    const accept = request.accepts();

    if (!accept.type(acceptedContentTypes)) {
      const error = new NotAcceptableError(NotAcceptableError.defaultTitle, {
        detail: `Only '${acceptedContentTypes.join("' or '")}' content type${acceptedContentTypes.length > 0 ? "s" : ""} supported`,
      });
      this.logger.error(
        `Cannot ${request.method} ${request.routeOptions.url} with 'Accept' header '${request.headers.accept}'`,
        error.stack,
      );
      throw error;
    }

    return true;
  }
}
