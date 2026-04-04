import type { NestFastifyApplication } from "@nestjs/platform-fastify";

import { ConfigService } from "@nestjs/config";

import type { ApiConfig } from "../../src/config/configuration.ts";

export const getServer = (
  app: NestFastifyApplication,
  configService: ConfigService<ApiConfig, true>,
) => {
  const testEnv = configService.get("testEnv", { infer: true });

  if (testEnv === "remote") {
    const domain =
      configService.get("testSpecificNodeDomain", { infer: true }) ??
      configService.get("domain", { infer: true });
    const apiUrlPrefix = configService.get("apiUrlPrefix", { infer: true });
    return `${domain}${apiUrlPrefix}`;
  }

  return app.getHttpServer();
};
