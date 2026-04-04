// For more info, read https://docs.nestjs.com/recipes/terminus
import type { HealthCheckResult } from "@nestjs/terminus";
import type { FastifyRequest } from "fastify";

import { Accepts } from "@ebsiint-api/shared";
import { Controller, Get, Req } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  HealthCheck,
  HealthCheckService,
  HttpHealthIndicator,
} from "@nestjs/terminus";

import type { ApiConfig } from "../../config/configuration.ts";

import { RUNTIME_DEPENDENCIES } from "../../config/configuration.ts";

@Controller("/health")
export class HealthController {
  private readonly health: HealthCheckService;
  private readonly configService: ConfigService<ApiConfig, true>;
  private readonly http: HttpHealthIndicator;

  constructor(
    health: HealthCheckService,
    configService: ConfigService<ApiConfig, true>,
    http: HttpHealthIndicator,
  ) {
    this.health = health;
    this.configService = configService;
    this.http = http;
  }

  @Accepts("application/json")
  @Get()
  @HealthCheck()
  check(@Req() req: FastifyRequest): Promise<HealthCheckResult> {
    return this.health.check([
      ...(
        Object.keys(
          RUNTIME_DEPENDENCIES,
        ) as (keyof typeof RUNTIME_DEPENDENCIES)[]
      ).map((service) => async () => {
        const version = RUNTIME_DEPENDENCIES[service];
        return this.http.pingCheck(
          // @ts-expect-error RUNTIME_DEPENDENCIES is empty
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          `${service}@${version}`,
          `${
            this.configService.get("localOrigin", { infer: true }) ??
            this.configService.get("domain", { infer: true })
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          }/${service}/${version}`,
          {
            headers: { "EBSI-Healthcheck": "1", "x-request-id": req.id },
          },
        );
      }),
      () =>
        this.http.pingCheck(
          "Besu",
          this.configService.get("besuReadinessEndpoint", { infer: true }),
        ),
    ]);
  }
}
