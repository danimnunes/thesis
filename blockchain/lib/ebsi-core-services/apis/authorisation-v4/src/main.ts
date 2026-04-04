import type { NestFastifyApplication } from "@nestjs/platform-fastify";

import {
  frameworkErrors,
  methodNotAllowed,
  setupInterceptors,
} from "@ebsiint-api/shared";
import { fastifyAccepts } from "@fastify/accepts";
import { fastifyFormbody } from "@fastify/formbody";
import { fastifyHelmet } from "@fastify/helmet";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter } from "@nestjs/platform-fastify";
import { Logger } from "nestjs-pino";
import { randomUUID } from "node:crypto";
import qs from "qs";

import type { ApiConfig } from "./config/configuration.ts";

import { AppModule } from "./app.module.ts";
import { AllExceptionsFilter } from "./filters/http-exception.filter.ts";

async function bootstrap(): Promise<void> {
  const fastifyAdapter = new FastifyAdapter({
    frameworkErrors,
    genReqId: () => randomUUID(),
    requestIdHeader: "x-request-id",
  });
  fastifyAdapter.enableCors({ methods: "*" });

  // Register "application/x-www-form-urlencoded" parser
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  await fastifyAdapter.register(fastifyFormbody, {
    parser: (str: string) =>
      qs.parse(str, {
        // Parse up to 50 children deep
        depth: 50,
        // Parse up to 1000 parameters
        parameterLimit: 1000,
      }),
  });

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    fastifyAdapter,
    { bodyParser: false, bufferLogs: true },
  );

  const logger = app.get(Logger);
  app.useLogger(logger);

  const configService = app.get<ConfigService<ApiConfig, true>>(ConfigService);
  const apiUrlPrefix = configService.get("apiUrlPrefix", { infer: true });
  const port = configService.get("apiPort", { infer: true });
  const logLevel = configService.get("logLevel", { infer: true });
  const domain = configService.get("domain", { infer: true });
  const localOrigin = configService.get("localOrigin", { infer: true });
  const dockerContainerTag = configService.get("dockerContainerTag", {
    infer: true,
  });

  logger.debug(
    `Starting API with:
- NODE_ENV: ${process.env.NODE_ENV}
- API_PORT:${port}
- LOG_LEVEL: ${logLevel}
- Docker container tag: ${dockerContainerTag}
`,
    "main",
  );

  // Starts listening for shutdown hooks
  app.enableShutdownHooks();

  app.setGlobalPrefix(apiUrlPrefix);

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
  app.useGlobalPipes(
    new ValidationPipe({ stopAtFirstError: true, transform: true }),
  );

  const fastifyInstance = fastifyAdapter.getInstance();
  fastifyInstance.addHook("onRequest", methodNotAllowed);

  // Setup axios interceptors
  setupInterceptors(domain, localOrigin);

  // Notes:
  // - see https://github.com/nestjs/nest/issues/3209
  // - read Note https://www.fastify.io/docs/latest/Getting-Started/#your-first-server
  await app.listen(port, "0.0.0.0", (err, address) => {
    if (err) {
      logger.error(err.message, undefined, "main");
    } else {
      logger.log(`Server listening on ${address}`, "main");
    }
  });
}

await bootstrap();
