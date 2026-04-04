import { DidRegistry__factory } from "@ebsiint-sc/did-registry-v5";
import { ConfigService } from "@nestjs/config";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { PinoLogger } from "nestjs-pino";
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

import type { ApiConfig } from "./config/configuration.ts";

import { getNestFastifyApplication } from "../tests/utils/app.ts";
import { AppModule } from "./app.module.ts";
import {
  BOOTSTRAP_DEPENDENCIES,
  RUNTIME_DEPENDENCIES,
} from "./config/configuration.ts";

describe("App Module", () => {
  const mockServer = setupServer();
  const bootstrapDependencies = Object.keys(
    BOOTSTRAP_DEPENDENCIES,
  ) as (keyof typeof BOOTSTRAP_DEPENDENCIES)[];
  const runtimeDependencies = Object.keys(
    RUNTIME_DEPENDENCIES,
  ) as (keyof typeof RUNTIME_DEPENDENCIES)[];

  beforeAll(() => {
    process.env.AXIOS_RETRY_DELAY = "1"; // 1ms

    // Intercept network requests
    mockServer.listen({
      onUnhandledRequest: ({ url }, print) => {
        // Bypass local requests
        if (new URL(url).hostname === "127.0.0.1") return;

        print.error();
      },
    });
  });

  afterEach(() => {
    mockServer.resetHandlers();
  });

  afterAll(() => {
    mockServer.close();
  });

  describe("onApplicationBootstrap hook", () => {
    afterEach(() => {
      mockServer.resetHandlers();
    });

    it("should prevent the app from starting if a bootstrap dependency triggers a network error", async () => {
      expect.assertions(1);

      const app = await getNestFastifyApplication({
        imports: [AppModule],
      });

      const configService =
        app.get<ConfigService<ApiConfig, true>>(ConfigService);

      const domain = configService.get("domain", { infer: true });
      const localOrigin =
        configService.get("localOrigin", { infer: true }) ?? domain;

      // All the bootstrap dependencies return a 200 except Authorisation API
      mockServer.use(
        ...bootstrapDependencies.map((dependency) => {
          return http.get(
            `${localOrigin}/${dependency}/${BOOTSTRAP_DEPENDENCIES[dependency]}`,
            () =>
              dependency === "authorisation"
                ? HttpResponse.error()
                : HttpResponse.json({}),
          );
        }),
      );

      await expect(() => app.init()).rejects.toThrow(
        `Unable to get ${localOrigin}/authorisation/${BOOTSTRAP_DEPENDENCIES.authorisation}, shutting down...`,
      );

      await app.close();
    });

    it("should prevent the app from starting if one of the bootstrap dependencies still responds with a 404 after all the attempts", async () => {
      expect.assertions(2);

      const mockedLogger = {
        debug: vi.fn(),
        error: vi.fn(),
        log: vi.fn(),
        warn: vi.fn(),
      };

      const app = await getNestFastifyApplication(
        { imports: [AppModule] },
        { logger: mockedLogger },
      );

      const configService =
        app.get<ConfigService<ApiConfig, true>>(ConfigService);

      const domain = configService.get("domain", { infer: true });
      const localOrigin =
        configService.get("localOrigin", { infer: true }) ?? domain;

      mockServer.use(
        ...bootstrapDependencies.map((dependency) => {
          return http.get(
            `${localOrigin}/${dependency}/${BOOTSTRAP_DEPENDENCIES[dependency]}`,
            () =>
              dependency === "authorisation"
                ? HttpResponse.text("Not Found", { status: 404 })
                : HttpResponse.json({}),
          );
        }),
      );

      await expect(() => app.init()).rejects.toThrow(
        `Unable to get ${localOrigin}/authorisation/${BOOTSTRAP_DEPENDENCIES.authorisation}, shutting down...`,
      );

      // Retry 30 times -> log 30 errors
      expect(mockedLogger.error).toHaveBeenCalledTimes(30);

      await app.close();
    });

    it("should start if all the bootstrap dependencies are up and running", async () => {
      expect.assertions(2);

      const mockedLogger = {
        debug: vi.fn(),
        error: vi.fn(),
        log: vi.fn(),
        warn: vi.fn(),
      };

      const app = await getNestFastifyApplication(
        { imports: [AppModule] },
        { logger: mockedLogger },
      );

      const configService =
        app.get<ConfigService<ApiConfig, true>>(ConfigService);

      const domain = configService.get("domain", { infer: true });
      const localOrigin =
        configService.get("localOrigin", { infer: true }) ?? domain;

      let reqCounter = 0;

      mockServer.use(
        ...bootstrapDependencies.map((dependency) => {
          return http.get(
            `${localOrigin}/${dependency}/${BOOTSTRAP_DEPENDENCIES[dependency]}`,
            () => {
              if (dependency === "authorisation") {
                reqCounter += 1;

                // Authorisation API first responds 15 times with a 404 (because it's starting)
                if (reqCounter <= 15) {
                  return HttpResponse.text("Not Found", { status: 404 });
                }

                // Then, it responds with a 200
                return HttpResponse.json({});
              }

              // All other dependencies respond with a 200
              return HttpResponse.json({});
            },
          );
        }),
      );

      await expect(app.init()).resolves.not.toThrow();

      // Retry 15 times -> log 15 errors
      expect(mockedLogger.error).toHaveBeenCalledTimes(15);

      await app.close();
    });
  });

  describe("Generic tests", () => {
    const mockedLogger = {
      debug: vi.fn(),
      error: vi.fn(),
      log: vi.fn(),
      warn: vi.fn(),
    };

    async function startApp() {
      // Start server
      const app = await getNestFastifyApplication(
        { imports: [AppModule] },
        { logger: mockedLogger },
      );

      const configService =
        app.get<ConfigService<ApiConfig, true>>(ConfigService);

      const domain = configService.get("domain", { infer: true });
      const localOrigin =
        configService.get("localOrigin", { infer: true }) ?? domain;

      // Mock dependencies
      const authorisationApiUrl =
        `${configService.get("authorisationApiUrl", { infer: true })}`.replace(
          domain,
          localOrigin,
        );

      mockServer.use(
        http.get(authorisationApiUrl, () => HttpResponse.json({})),
      );

      await app.init();
      await app.getHttpAdapter().getInstance().ready();

      return app;
    }

    afterEach(() => {
      vi.clearAllMocks();
      vi.unstubAllEnvs();
      mockServer.resetHandlers();
    });

    describe("GET /", () => {
      it("should return 'ok' without logging the request nor the response", async () => {
        expect.assertions(4);

        const app = await startApp();
        const server = app.getHttpServer();

        const response = await request(server).get("");

        expect(response.text).toBe("ok");
        expect(response.status).toBe(200);

        // The last logs show that the request was received and completed
        const calls = mockedLogger.log.mock.calls.length;
        expect(mockedLogger.log).toHaveBeenNthCalledWith(
          calls - 1,
          {
            request: {
              method: "GET",
              url: "/",
            },
          },
          "Request received",
          "LoggerMiddleware",
        );
        expect(mockedLogger.log).toHaveBeenNthCalledWith(
          calls,
          {
            response: { statusCode: 200 },
            responseTime: expect.any(Number),
          },
          "Request completed",
          "LoggerMiddleware",
        );

        await app.close();
      });

      it("should not display the framework in the error message", async () => {
        expect.assertions(3);

        const app = await startApp();
        const server = app.getHttpServer();

        const pinoLoggerSpy = vi
          .spyOn(PinoLogger.root, "info")
          .mockImplementation(() => {
            // Do nothing
          });

        const response = await request(server).get("/%91").send();

        expect(response.body).toStrictEqual({
          detail: "/%91 is not a valid url component",
          status: 400,
          title: "Bad Request",
          type: "about:blank",
        });
        expect(response.status).toBe(400);

        expect(pinoLoggerSpy).toHaveBeenCalledWith(
          {
            context: "frameworkErrors",
            error: expect.any(Error),
            request: {
              headers: {
                "accept-encoding": "gzip, deflate",
                connection: "close",
                host: expect.any(String),
              },
              method: "GET",
              url: "/%91",
            },
          },
          "Invalid request received",
        );

        await app.close();
      });

      it("should return an error 405 if called with a method different from GET", async () => {
        expect.assertions(16);

        const app = await startApp();
        const server = app.getHttpServer();

        // POST
        let response = await request(server).post("");

        expect(response.body).toStrictEqual({
          detail: "Cannot POST /. Allowed HTTP methods: GET, HEAD",
          status: 405,
          title: "Method Not Allowed",
          type: "about:blank",
        });
        expect(response.headers["allow"]).toStrictEqual("GET, HEAD");
        expect(response.headers["content-type"]).toStrictEqual(
          "application/problem+json; charset=utf-8",
        );
        expect(response.status).toBe(405);

        // HEAD
        response = await request(server).head("");

        expect(response.body).toStrictEqual({}); // HEAD response body is empty
        expect(response.headers["content-type"]).toStrictEqual(
          "text/plain; charset=utf-8",
        );
        expect(response.status).toBe(200);

        // PUT
        response = await request(server).put("");

        expect(response.body).toStrictEqual({
          detail: "Cannot PUT /. Allowed HTTP methods: GET, HEAD",
          status: 405,
          title: "Method Not Allowed",
          type: "about:blank",
        });
        expect(response.headers["allow"]).toStrictEqual("GET, HEAD");
        expect(response.headers["content-type"]).toStrictEqual(
          "application/problem+json; charset=utf-8",
        );
        expect(response.status).toBe(405);

        // PATCH
        response = await request(server).patch("");

        expect(response.body).toStrictEqual({
          detail: "Cannot PATCH /. Allowed HTTP methods: GET, HEAD",
          status: 405,
          title: "Method Not Allowed",
          type: "about:blank",
        });
        expect(response.headers["allow"]).toStrictEqual("GET, HEAD");
        expect(response.headers["content-type"]).toStrictEqual(
          "application/problem+json; charset=utf-8",
        );
        expect(response.status).toBe(405);

        // Check logs
        expect(mockedLogger.error.mock.calls).toStrictEqual([
          [
            "Cannot POST /. Allowed HTTP methods: GET, HEAD",
            expect.stringContaining(
              "MethodNotAllowedError: Method Not Allowed",
            ),
            "AllExceptionsFilter",
          ],
          [
            "Cannot PUT /. Allowed HTTP methods: GET, HEAD",
            expect.stringContaining(
              "MethodNotAllowedError: Method Not Allowed",
            ),
            "AllExceptionsFilter",
          ],
          [
            "Cannot PATCH /. Allowed HTTP methods: GET, HEAD",
            expect.stringContaining(
              "MethodNotAllowedError: Method Not Allowed",
            ),
            "AllExceptionsFilter",
          ],
        ]);

        await app.close();
      });

      it("should return an error 406 if called with an unsupported 'Accept' header", async () => {
        expect.assertions(4);

        const app = await startApp();
        const server = app.getHttpServer();

        const response = await request(server)
          .get("/")
          .set("Accept", "application/xml");

        expect(response.body).toStrictEqual({
          detail: "Only 'text/plain' content types supported",
          status: 406,
          title: "Not Acceptable",
          type: "about:blank",
        });
        expect(response.headers["content-type"]).toStrictEqual(
          "application/problem+json; charset=utf-8",
        );
        expect(response.status).toBe(406);

        // Check logs
        expect(mockedLogger.error.mock.calls).toStrictEqual([
          [
            "Cannot GET / with 'Accept' header 'application/xml'",
            expect.stringContaining("NotAcceptableError: Not Acceptable"),
            "AcceptsGuard",
          ],
        ]);

        await app.close();
      });
    });

    describe("GET /abi", () => {
      it("should not log the request and return the ABI", async () => {
        expect.assertions(6);

        const app = await startApp();
        const server = app.getHttpServer();

        const response = await request(server).get("/abi");

        expect(response.body).toStrictEqual(DidRegistry__factory.abi);
        expect(response.status).toBe(200);

        // Check headers
        expect(response.headers["content-security-policy"]).toContain(
          "frame-ancestors 'none'",
        );
        expect(response.headers["x-frame-options"]).toStrictEqual("DENY");

        // The last logs show that the request was received and completed
        const calls = mockedLogger.log.mock.calls.length;
        expect(mockedLogger.log).toHaveBeenNthCalledWith(
          calls - 1,
          {
            request: {
              method: "GET",
              url: "/abi",
            },
          },
          "Request received",
          "LoggerMiddleware",
        );
        expect(mockedLogger.log).toHaveBeenNthCalledWith(
          calls,
          {
            response: { statusCode: 200 },
            responseTime: expect.any(Number),
          },
          "Request completed",
          "LoggerMiddleware",
        );

        await app.close();
      });
    });

    describe("GET /unknown-route", () => {
      it("should return an error and log it", async () => {
        expect.assertions(3);

        const app = await startApp();
        const server = app.getHttpServer();

        const response = await request(server).get("/unknown-route").send();

        expect(response.body).toStrictEqual({
          detail: "Cannot GET /unknown-route",
          status: 404,
          title: "Not Found",
          type: "about:blank",
        });
        expect(response.status).toBe(404);

        // The last logs show the error
        const calls = mockedLogger.error.mock.calls.length;
        expect(mockedLogger.error).toHaveBeenNthCalledWith(
          calls,
          "Cannot GET /unknown-route",
          expect.stringContaining(
            "NotFoundException: Cannot GET /unknown-route",
          ),
          "AllExceptionsFilter",
        );

        await app.close();
      });
    });

    describe("GET /health", () => {
      it('should NOT log the request and response if the header "EBSI-Healthcheck" is present', async () => {
        expect.assertions(1);

        const app = await startApp();
        const configService =
          app.get<ConfigService<ApiConfig, true>>(ConfigService);

        const localOrigin =
          configService.get("localOrigin", { infer: true }) ??
          configService.get("domain", { infer: true });

        // All the runtime dependencies return a 200
        mockServer.use(
          ...runtimeDependencies.map((dependency) =>
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

        await request(app.getHttpServer())
          .get("/health")
          .set("EBSI-Healthcheck", "1");

        const calls = mockedLogger.log.mock.calls.length;
        expect(mockedLogger.log).toHaveBeenNthCalledWith(
          calls,
          "Nest application successfully started",
          "NestApplication",
        );

        await app.close();
      });

      it('should log the request and response with level "debug"', async () => {
        expect.assertions(2);

        const app = await startApp();
        const configService =
          app.get<ConfigService<ApiConfig, true>>(ConfigService);

        const localOrigin =
          configService.get("localOrigin", { infer: true }) ??
          configService.get("domain", { infer: true });

        // All the runtime dependencies return a 200
        mockServer.use(
          ...runtimeDependencies.map((dependency) =>
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

        await request(app.getHttpServer()).get("/health");

        const calls = mockedLogger.debug.mock.calls.length;

        // It should have logged the request
        expect(mockedLogger.debug).toHaveBeenNthCalledWith(
          calls - 1,
          {
            request: {
              body: "<empty>",
            },
          },
          "Incoming request",
          "LoggingInterceptor",
        );

        // Expect all the dependencies to be up
        const expectedStatuses = {
          ...runtimeDependencies
            .map((dependency) => ({
              [`${dependency}@${RUNTIME_DEPENDENCIES[dependency]}`]: {
                status: "up",
              },
            }))
            .reduce((acc, currentVal) => ({ ...acc, ...currentVal }), {}),
          Besu: { status: "up" },
        };

        // It should have logged the response (with body)
        expect(mockedLogger.debug).toHaveBeenNthCalledWith(
          calls,
          {
            response: {
              body: {
                details: expectedStatuses,
                error: {},
                info: expectedStatuses,
                status: "ok",
              },
            },
          },
          "Outgoing response",
          "LoggingInterceptor",
        );

        await app.close();
      });
    });

    describe("POST /jsonrpc", () => {
      it("should return error with wrong content-type", async () => {
        expect.assertions(2);

        const app = await startApp();
        const server = app.getHttpServer();

        const response = await request(server)
          .post("/jsonrpc")
          .set("Content-Type", "application/bad-content-type")
          .send();

        expect(response.status).toBe(415);
        expect(response.body).toStrictEqual({
          detail: "Unsupported Media Type",
          status: 415,
          title: "Unsupported Media Type",
          type: "about:blank",
        });
        await app.close();
      });
    });
  });
});
