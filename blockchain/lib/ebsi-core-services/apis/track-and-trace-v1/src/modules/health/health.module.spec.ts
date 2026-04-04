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
import { RUNTIME_DEPENDENCIES } from "../../config/configuration.ts";
import { HealthModule } from "./health.module.ts";

describe("Health Module", () => {
  let app: NestFastifyApplication;
  let server: RawServerDefault;
  let httpService: HttpService;
  let configService: ConfigService<ApiConfig, true>;
  let localOrigin: string | undefined;
  const dependencies = Object.keys(
    RUNTIME_DEPENDENCIES,
  ) as (keyof typeof RUNTIME_DEPENDENCIES)[];
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
      expect.assertions(3 + dependencies.length);

      // All the dependencies return a 200
      mockServer.use(
        ...dependencies.map((dependency) =>
          http.get(
            `${localOrigin}/${dependency}/${RUNTIME_DEPENDENCIES[dependency]}`,
            () => HttpResponse.json({}),
          ),
        ),
        http.get(
          configService.get("besuReadinessEndpoint", { infer: true }),
          () => HttpResponse.json({}),
        ),
      );

      const spy = vi.spyOn(httpService, "request");

      const response = await request(server).get("/health").send();

      // Expect httpService.request to have been called for every dependency
      for (const dependency of dependencies) {
        expect(spy).toHaveBeenCalledWith({
          headers: {
            "EBSI-Healthcheck": "1",
            "x-request-id": expect.any(String),
          },
          url: `${localOrigin}/${dependency}/${RUNTIME_DEPENDENCIES[dependency]}`,
        });
      }
      expect(spy).toHaveBeenCalledWith({
        url: configService.get("besuReadinessEndpoint", { infer: true }),
      });

      // Expect all the dependencies to be up
      const expectedStatuses = {
        ...dependencies
          .map((dependency) => ({
            [`${dependency}@${RUNTIME_DEPENDENCIES[dependency]}`]: {
              status: "up",
            },
          }))
          .reduce((acc, currentVal) => ({ ...acc, ...currentVal }), {}),
        Besu: { status: "up" },
      };

      expect(response.body).toStrictEqual({
        details: expectedStatuses,
        error: {},
        info: expectedStatuses,
        status: "ok",
      });
      expect(response.status).toBe(200);
    });

    it("should return 'error' if some runtime dependencies do not return a 20x", async () => {
      expect.assertions(3 + dependencies.length);

      // All the dependencies return a 200 except Authorisation API v4
      mockServer.use(
        ...dependencies.map((dependency) =>
          http.get(
            `${localOrigin}/${dependency}/${RUNTIME_DEPENDENCIES[dependency]}`,
            () =>
              dependency === "authorisation"
                ? HttpResponse.json({}, { status: 500 })
                : HttpResponse.json({}),
          ),
        ),
        http.get(
          configService.get("besuReadinessEndpoint", { infer: true }),
          () => HttpResponse.json({}),
        ),
      );

      const spy = vi.spyOn(httpService, "request");

      const response = await request(server).get("/health").send();

      // Expect httpService.request to have been called for every dependency
      for (const dependency of dependencies) {
        expect(spy).toHaveBeenCalledWith({
          headers: {
            "EBSI-Healthcheck": "1",
            "x-request-id": expect.any(String),
          },
          url: `${localOrigin}/${dependency}/${RUNTIME_DEPENDENCIES[dependency]}`,
        });
      }
      expect(spy).toHaveBeenCalledWith({
        url: configService.get("besuReadinessEndpoint", { infer: true }),
      });

      // Expect all the dependencies to be up except Authorisation API v4
      const expectedStatuses: HealthIndicatorResult = {
        ...dependencies
          .map(
            (dependency) =>
              ({
                [`${dependency}@${RUNTIME_DEPENDENCIES[dependency]}`]:
                  dependency === "authorisation"
                    ? ({
                        message: "Request failed with status code 500",
                        status: "down",
                        statusCode: 500,
                        statusText: "Internal Server Error",
                      } as const)
                    : ({ status: "up" } as const),
              }) satisfies HealthIndicatorResult,
          )
          .reduce((acc, currentVal) => ({ ...acc, ...currentVal }), {}),
        Besu: { status: "up" },
      };

      const { "authorisation@v4": errorStatus, ...otherStatuses } =
        expectedStatuses;

      expect(response.body).toStrictEqual({
        details: expectedStatuses,
        error: {
          "authorisation@v4": errorStatus,
        },
        info: otherStatuses,
        status: "error",
      });
      expect(response.status).toBe(503);
    });

    it("should return 'error' if Besu readiness endpoint returns 503", async () => {
      expect.assertions(3 + dependencies.length);

      // All the dependencies return a 200 except Besu readiness (503)
      mockServer.use(
        ...dependencies.map((dependency) =>
          http.get(
            `${localOrigin}/${dependency}/${RUNTIME_DEPENDENCIES[dependency]}`,
            () => HttpResponse.json({}),
          ),
        ),
        http.get(
          configService.get("besuReadinessEndpoint", { infer: true }),
          () => HttpResponse.json({}, { status: 503 }),
        ),
      );

      const spy = vi.spyOn(httpService, "request");

      const response = await request(server).get("/health").send();

      // Expect httpService.request to have been called for every dependency
      for (const dependency of dependencies) {
        expect(spy).toHaveBeenCalledWith({
          headers: {
            "EBSI-Healthcheck": "1",
            "x-request-id": expect.any(String),
          },
          url: `${localOrigin}/${dependency}/${RUNTIME_DEPENDENCIES[dependency]}`,
        });
      }
      expect(spy).toHaveBeenCalledWith({
        url: configService.get("besuReadinessEndpoint", { infer: true }),
      });

      // Expect all the dependencies to be up except Besu
      const expectedStatuses = {
        ...dependencies
          .map(
            (dependency) =>
              ({
                [`${dependency}@${RUNTIME_DEPENDENCIES[dependency]}`]: {
                  status: "up",
                } as const,
              }) satisfies HealthIndicatorResult,
          )
          .reduce((acc, currentVal) => ({ ...acc, ...currentVal }), {}),
        Besu: {
          message: "Request failed with status code 503",
          status: "down",
          statusCode: 503,
          statusText: "Service Unavailable",
        },
      };

      const { Besu: errorStatus, ...otherStatuses } = expectedStatuses;

      expect(response.body).toStrictEqual({
        details: expectedStatuses,
        error: {
          Besu: errorStatus,
        },
        info: otherStatuses,
        status: "error",
      });
      expect(response.status).toBe(503);
    });
  });
});
