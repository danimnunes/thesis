import type { LoggerService, ModuleMetadata } from "@nestjs/common";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";

import { frameworkErrors, methodNotAllowed } from "@ebsiint-api/shared";
import { fastifyAccepts } from "@fastify/accepts";
import { fastifyHelmet } from "@fastify/helmet";
import { Logger, ValidationPipe } from "@nestjs/common";
import { FastifyAdapter } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";

import { AllExceptionsFilter } from "../../src/filters/http-exception.filter.ts";

/**
 * Configure Nest Fastify app with all the parsers, filters, and validation pipes.
 * /!\ Must be aligned with src/main.ts.
 */
export async function getNestFastifyApplication(
  metadata: ModuleMetadata,
  opts: {
    logger?: boolean | LoggerService;
  } = {},
) {
  const moduleFixture = await Test.createTestingModule(metadata).compile();

  if (process.env.TEST_ENV === "remote") {
    // No need to configure anything
    return moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
  }

  const fastifyAdapter = new FastifyAdapter({
    frameworkErrors,
    genReqId: () => randomUUID(),
    requestIdHeader: "x-request-id",
  });
  fastifyAdapter.enableCors({ methods: "*" });

  const app = moduleFixture.createNestApplication<NestFastifyApplication>(
    fastifyAdapter,
    { bufferLogs: true, rawBody: true },
  );

  app.enableShutdownHooks();

  // https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html#security-headers
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        "frame-ancestors": ["'none'"],
      },
    },
    xFrameOptions: {
      action: "deny",
    },
  });

  // Parse "Accept" request header
  await app.register(fastifyAccepts);

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  const fastifyInstance = fastifyAdapter.getInstance();
  fastifyInstance.addHook("onRequest", methodNotAllowed);

  Logger.overrideLogger(opts.logger ?? false);

  return app;
}
