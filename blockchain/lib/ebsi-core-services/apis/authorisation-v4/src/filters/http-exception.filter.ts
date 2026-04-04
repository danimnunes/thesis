import type { ArgumentsHost, ExceptionFilter } from "@nestjs/common";
import type { FastifyReply } from "fastify";

import {
  BadRequestError,
  ForbiddenError,
  InternalServerError,
  logAxiosError,
  MethodNotAllowedError,
  NotFoundError,
  ProblemDetailsError,
} from "@ebsiint-api/shared";
import {
  BadRequestException,
  Catch,
  ForbiddenException,
  HttpException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { isAxiosError } from "axios";
import { stringify } from "safe-stable-stringify";

import { OAuth2Error } from "../modules/authorisation/errors/index.ts";

function getProblemDetailsError(
  error: unknown,
  logger: Logger,
): ProblemDetailsError {
  if (error instanceof ProblemDetailsError) {
    // Log MethodNotAllowedError because we can't easily log it in the hook itself
    if (error instanceof MethodNotAllowedError) {
      logger.error(error.detail ?? error.message, error.stack);
    }

    // Don't log other ProblemDetailsError (we assume that they've been logged already)
    return error;
  }

  if (error instanceof NotFoundException) {
    // Log NestJS NotFoundException
    logger.error(error.message, error.stack);

    // Map to Problem Details error
    return new NotFoundError(NotFoundError.defaultTitle, {
      detail: error.message,
    });
  }

  if (error instanceof ForbiddenException) {
    // Log NestJS ForbiddenError
    logger.error(error.message, error.stack);

    // Map to Problem Details error
    return new ForbiddenError(ForbiddenError.defaultTitle, {
      detail: error.message,
    });
  }

  if (error instanceof BadRequestException) {
    // Log NestJS BadRequestException
    logger.error(error.message, error.stack);

    let detail = error.message;
    const resp = error.getResponse();
    if (typeof resp === "object" && "message" in resp && resp.message) {
      detail =
        typeof resp.message === "string"
          ? resp.message
          : stringify(resp.message);
    }

    // Map to Problem Details error
    return new BadRequestError(BadRequestError.defaultTitle, {
      detail,
    });
  }

  if (error instanceof HttpException) {
    logger.error(error.message, error.stack);

    return new ProblemDetailsError(error.getStatus(), error.message, {
      detail: error.message,
    });
  }

  // Log unhandled error
  if (isAxiosError(error)) {
    logAxiosError(error, logger);
  } else if (error instanceof Error) {
    logger.error(error.message, error.stack);
  } else {
    logger.error(error);
  }

  return new InternalServerError(undefined, {
    detail:
      "The server encountered an internal error and was unable to complete your request",
  });
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(err: Error, host: ArgumentsHost): FastifyReply {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();

    // Return ServiceUnavailableException (thrown by HealthCheck module) as it is
    if (err instanceof ServiceUnavailableException) {
      const responsePayload = err.getResponse();
      this.logger.debug(
        { response: { body: responsePayload } },
        "Outgoing response",
      );

      return response
        .code(err.getStatus())
        .type("application/json")
        .send(err.getResponse());
    }

    // Service-specific error
    if (err instanceof OAuth2Error) {
      const responsePayload = err.toJSON();
      this.logger.debug(
        { response: { body: responsePayload } },
        "Outgoing response",
      );

      return response
        .code(err.statusCode)
        .type("application/json")
        .send(err.toJSON());
    }

    // Generic error
    const problemError = getProblemDetailsError(err, this.logger);

    const responsePayload = problemError.toJSON();
    this.logger.debug(
      { response: { body: responsePayload } },
      "Outgoing response",
    );

    return response
      .code(problemError.status)
      .type("application/problem+json")
      .headers(problemError.headers ?? {})
      .send(problemError.toJSON());
  }
}
