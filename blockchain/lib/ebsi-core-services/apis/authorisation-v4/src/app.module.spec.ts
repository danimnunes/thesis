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

const mockedLogger = {
  debug: vi.fn(),
  error: vi.fn(),
  log: vi.fn(),
  warn: vi.fn(),
};

async function startApp() {
  const app = await getNestFastifyApplication(
    { imports: [AppModule] },
    { logger: mockedLogger },
  );

  await app.init();
  const fastifyInstance = app.getHttpAdapter().getInstance();
  await fastifyInstance.ready();

  return app;
}

describe("App Module", () => {
  const mockServer = setupServer();

  beforeAll(() => {
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
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    mockServer.resetHandlers();
  });

  afterAll(() => {
    mockServer.close();
  });

  describe("GET /", () => {
    it("should return 'ok' without logging the request nor the response", async () => {
      expect.assertions(6);

      const app = await startApp();
      const server = app.getHttpServer();

      const response = await request(server).get("");

      expect(response.text).toBe("ok");
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
          expect.stringContaining("MethodNotAllowedError: Method Not Allowed"),
          "AllExceptionsFilter",
        ],
        [
          "Cannot PUT /. Allowed HTTP methods: GET, HEAD",
          expect.stringContaining("MethodNotAllowedError: Method Not Allowed"),
          "AllExceptionsFilter",
        ],
        [
          "Cannot PATCH /. Allowed HTTP methods: GET, HEAD",
          expect.stringContaining("MethodNotAllowedError: Method Not Allowed"),
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
        .get("")
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
        expect.stringContaining("NotFoundException: Cannot GET /unknown-route"),
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
      const DEPENDENCIES = configService.get("dependencies", { infer: true });

      const dependencies = Object.keys(
        DEPENDENCIES,
      ) as (keyof typeof DEPENDENCIES)[];

      const localOrigin =
        configService.get("localOrigin", { infer: true }) ??
        configService.get("domain", { infer: true });

      // All the dependencies return a 200
      mockServer.use(
        ...dependencies.map((dependency) =>
          http.get(
            `${localOrigin}/${dependency}/${DEPENDENCIES[dependency]}`,
            () => HttpResponse.json({}),
          ),
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
      const DEPENDENCIES = configService.get("dependencies", { infer: true });

      const dependencies = Object.keys(
        DEPENDENCIES,
      ) as (keyof typeof DEPENDENCIES)[];

      const localOrigin =
        configService.get("localOrigin", { infer: true }) ??
        configService.get("domain", { infer: true });

      // All the dependencies return a 200
      mockServer.use(
        ...dependencies.map((dependency) =>
          http.get(
            `${localOrigin}/${dependency}/${DEPENDENCIES[dependency]}`,
            () => HttpResponse.json({}),
          ),
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
      const expectedStatuses = dependencies
        .map((dependency) => ({
          [`${dependency}@${DEPENDENCIES[dependency]}`]: { status: "up" },
        }))
        .reduce((acc, currentVal) => ({ ...acc, ...currentVal }), {});

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
});
