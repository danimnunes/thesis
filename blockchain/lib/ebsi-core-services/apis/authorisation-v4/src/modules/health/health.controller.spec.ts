import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { HealthIndicatorResult } from "@nestjs/terminus";
import type { RawServerDefault } from "fastify";

import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import request from "supertest";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type { ApiConfig } from "../../config/configuration.ts";

import { getNestFastifyApplication } from "../../../tests/utils/app.ts";
import { HealthModule } from "./health.module.ts";

describe("HealthController", () => {
  let app: NestFastifyApplication;
  let server: RawServerDefault;
  let httpService: HttpService;
  let configService: ConfigService<ApiConfig, true>;
  let localOrigin: string | undefined;

  const mockServer = setupServer();

  beforeAll(async () => {
    // Intercept network requests
    mockServer.listen({
      onUnhandledRequest: ({ url }, print) => {
        // Bypass local requests
        if (new URL(url).hostname === "127.0.0.1") return;

        print.error();
      },
    });

    app = await getNestFastifyApplication({
      imports: [HealthModule],
    });

    configService = app.get<ConfigService<ApiConfig, true>>(ConfigService);

    await app.init();
    const fastifyInstance = app.getHttpAdapter().getInstance();
    await fastifyInstance.ready();
    server = app.getHttpServer();

    httpService = await app.resolve<HttpService>(HttpService);

    localOrigin =
      configService.get("localOrigin", { infer: true }) ??
      configService.get("domain", { infer: true });
  });

  afterEach(() => {
    mockServer.resetHandlers();
  });

  afterAll(async () => {
    mockServer.close();

    await app.close();
  });

  describe("GET /health", () => {
    it("should return 'ok' if all the runtime dependencies return a 20x", async () => {
      const DEPENDENCIES = configService.get("dependencies", { infer: true });
      const dependencies = Object.keys(
        DEPENDENCIES,
      ) as (keyof typeof DEPENDENCIES)[];

      expect.assertions(2 + dependencies.length);

      // All the dependencies return a 200
      mockServer.use(
        ...dependencies.map((dependency) =>
          http.get(
            `${localOrigin}/${dependency}/${DEPENDENCIES[dependency]}`,
            () => HttpResponse.json({}),
          ),
        ),
      );

      const spy = vi.spyOn(httpService, "request");

      const response = await request(server).get("/health").send();

      // Expect httpService.request to have been called for every runtime dependency
      for (const dependency of dependencies) {
        expect(spy).toHaveBeenCalledWith({
          headers: {
            "EBSI-Healthcheck": "1",
            "x-request-id": expect.any(String),
          },
          url: `${localOrigin}/${dependency}/${DEPENDENCIES[dependency]}`,
        });
      }

      // Expect all the dependencies to be up
      const expectedStatuses = dependencies
        .map((dependency) => ({
          [`${dependency}@${DEPENDENCIES[dependency]}`]: { status: "up" },
        }))
        .reduce((acc, currentVal) => ({ ...acc, ...currentVal }), {});

      expect(response.body).toStrictEqual({
        details: expectedStatuses,
        error: {},
        info: expectedStatuses,
        status: "ok",
      });
      expect(response.status).toBe(200);
    });

    it("should return 'error' if some runtime dependencies do not return a 20x", async () => {
      const DEPENDENCIES = configService.get("dependencies", { infer: true });
      const dependencies = Object.keys(
        DEPENDENCIES,
      ) as (keyof typeof DEPENDENCIES)[];

      expect.assertions(2 + dependencies.length);

      // All the dependencies return a 200 except DIDR API v5
      mockServer.use(
        ...dependencies.map((dependency) =>
          http.get(
            `${localOrigin}/${dependency}/${DEPENDENCIES[dependency]}`,
            () =>
              dependency === "did-registry"
                ? HttpResponse.json({}, { status: 500 })
                : HttpResponse.json({}),
          ),
        ),
      );

      const spy = vi.spyOn(httpService, "request");

      const response = await request(server).get("/health").send();

      // Expect httpService.request to have been called for every runtime dependency
      for (const dependency of dependencies) {
        expect(spy).toHaveBeenCalledWith({
          headers: {
            "EBSI-Healthcheck": "1",
            "x-request-id": expect.any(String),
          },
          url: `${localOrigin}/${dependency}/${DEPENDENCIES[dependency]}`,
        });
      }

      // Expect all the dependencies to be up except DIDR API v5
      const expectedStatuses = dependencies
        .map(
          (dependency) =>
            ({
              [`${dependency}@${DEPENDENCIES[dependency]}`]:
                dependency === "did-registry"
                  ? ({
                      message: "Request failed with status code 500",
                      status: "down",
                      statusCode: 500,
                      statusText: "Internal Server Error",
                    } as const)
                  : ({ status: "up" } as const),
            }) satisfies HealthIndicatorResult,
        )
        .reduce((acc, currentVal) => ({ ...acc, ...currentVal }), {});

      const { "did-registry@v5": errorStatus, ...otherStatuses } =
        expectedStatuses;

      expect(response.body).toStrictEqual({
        details: expectedStatuses,
        error: {
          "did-registry@v5": errorStatus,
        },
        info: otherStatuses,
        status: "error",
      });
      expect(response.status).toBe(503);
    });
  });
});
