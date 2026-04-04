import type { NestMiddleware } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";

import { Injectable, Logger } from "@nestjs/common";
import pino from "pino";

/**
 * Middleware that logs incoming and outgoing requests.
 * The logs don't contain the request body or response body.
 */
@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger(LoggerMiddleware.name);

  use(req: FastifyRequest["raw"], res: FastifyReply["raw"], next: () => void) {
    const { headers } = req;

    // Don't log requests that are healthchecks
    if (headers && "ebsi-healthcheck" in headers) {
      if (next) {
        next();
      }
      return;
    }

    const startTime = Date.now();

    // Only log method, remote address and url
    const { method, url } = pino.stdSerializers.req(req);
    this.logger.log({ request: { method, url } }, "Request received");

    const onResponseComplete = () => {
      res.removeListener("close", onResponseComplete);
      res.removeListener("finish", onResponseComplete);
      res.removeListener("error", onResponseComplete);

      // Only log status code and response time
      const { statusCode } = pino.stdSerializers.res(res);
      const responseTime = Date.now() - startTime;
      this.logger.log(
        { response: { statusCode }, responseTime },
        "Request completed",
      );
    };

    res.on("close", onResponseComplete);
    res.on("finish", onResponseComplete);
    res.on("error", onResponseComplete);

    if (next) {
      next();
    }
  }
}
