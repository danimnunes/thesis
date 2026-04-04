import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { RawServerDefault } from "fastify";

import { ConfigService } from "@nestjs/config";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { ApiConfig } from "../../src/config/configuration.ts";

import { AppModule } from "../../src/app.module.ts";
import { getNestFastifyApplication } from "../utils/app.ts";
import { getServer } from "../utils/getServer.ts";

describe("Authorisation API v4 - Generic tests (e2e)", () => {
  let app: NestFastifyApplication;
  let server: RawServerDefault | string;
  let apiUrlPrefix = "";
  let configService: ConfigService<ApiConfig, true>;

  beforeAll(async () => {
    app = await getNestFastifyApplication({
      imports: [AppModule],
    });

    configService = app.get<ConfigService<ApiConfig, true>>(ConfigService);

    const testEnv = configService.get("testEnv", { infer: true });

    if (testEnv !== "remote") {
      await app.init();
      const fastifyInstance = app.getHttpAdapter().getInstance();
      await fastifyInstance.ready();
    }

    server = getServer(app, configService);

    if (testEnv === "remote") {
      apiUrlPrefix = configService.get("apiUrlPrefix", { infer: true });
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /", () => {
    it("should return 'ok'", async () => {
      expect.assertions(4);

      const response = await request(server).get("");

      expect(response.text).toBe("ok");
      expect(response.status).toBe(200);

      // Check headers
      expect(response.headers["content-security-policy"]).toContain(
        "frame-ancestors 'none'",
      );
      expect(response.headers["x-frame-options"]).toStrictEqual("DENY");
    });

    it("should return an error 405 if called with a method different from GET", async () => {
      expect.assertions(15);

      // POST
      let response = await request(server).post("");

      expect(response.body).toStrictEqual({
        detail: `Cannot POST ${typeof server === "string" ? apiUrlPrefix : "/"}. Allowed HTTP methods: GET, HEAD`,
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
        detail: `Cannot PUT ${typeof server === "string" ? apiUrlPrefix : "/"}. Allowed HTTP methods: GET, HEAD`,
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
        detail: `Cannot PATCH ${typeof server === "string" ? apiUrlPrefix : "/"}. Allowed HTTP methods: GET, HEAD`,
        status: 405,
        title: "Method Not Allowed",
        type: "about:blank",
      });
      expect(response.headers["allow"]).toStrictEqual("GET, HEAD");
      expect(response.headers["content-type"]).toStrictEqual(
        "application/problem+json; charset=utf-8",
      );
      expect(response.status).toBe(405);
    });

    it("should return an error 406 if called with an unsupported 'Accept' header", async () => {
      expect.assertions(3);

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
    });
  });

  describe("GET /health", () => {
    it("should return 200 with status up", async () => {
      expect.assertions(2);
      const response = await request(server).get("/health");

      const DEPENDENCIES = configService.get("dependencies", { infer: true });

      // Expect all the dependencies to be up
      const dependencies = Object.keys(
        DEPENDENCIES,
      ) as (keyof typeof DEPENDENCIES)[];
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
  });

  describe("GET /unknown-route", () => {
    it("should return an error", async () => {
      expect.assertions(2);

      const response = await request(server).get("/unknown-route").send();

      expect(response.body).toStrictEqual({
        detail: `Cannot GET ${apiUrlPrefix}/unknown-route`,
        status: 404,
        title: "Not Found",
        type: "about:blank",
      });
      expect(response.status).toBe(404);
    });
  });
});
