import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import type { Observable } from "rxjs";

import { Injectable, Logger } from "@nestjs/common";
import { tap } from "rxjs/operators";

import type { LogOptions } from "../decorators/log.decorator.ts";

import { METHOD_LOG_METADATA } from "../decorators/log.decorator.ts";

/**
 * Interceptor that logs incoming requests body and outgoing response payload.
 * If an error is thrown, it's not logged by LoggingInterceptor but by AllExceptionsFilter.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger: Logger = new Logger(LoggingInterceptor.name);

  /**
   * Intercept method, logs before and after the request being processed
   * @param context details about the current request
   * @param call$ implements the handle method that returns an Observable
   */
  public intercept(
    context: ExecutionContext,
    call$: CallHandler,
  ): Observable<unknown> {
    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const { body, headers } = req;

    // Global condition: "ebsi-healthcheck" should not be present in the request headers. If it's the case, the request and response are not logged.
    let logRequest = !(headers && "ebsi-healthcheck" in headers);

    // Local condition: check if the route has the @Log decorator and how it's configured.
    const options = Reflect.getMetadata(
      METHOD_LOG_METADATA,
      context.getHandler(),
    ) as LogOptions | undefined;

    if (logRequest && options?.logRequest !== undefined) {
      logRequest =
        typeof options.logRequest === "function"
          ? options.logRequest(req)
          : options.logRequest;
    }

    // Log request if logRequest is still true at this point
    if (logRequest) {
      this.logger.debug(
        { request: { body: body ?? "<empty>" } },
        "Incoming request",
      );
    }

    return call$.handle().pipe(
      tap({
        ...(logRequest && {
          next: (val: unknown): void => {
            this.logNext(val);
          },
        }),
      }),
    );
  }

  /**
   * Logs the request response in success cases
   * @param body body returned
   */
  private logNext(body: unknown): void {
    this.logger.debug({ response: { body } }, "Outgoing response");
  }
}
