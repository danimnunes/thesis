import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { RawServerDefault } from "fastify";

import { Tir__factory } from "@ebsiint-sc/trusted-issuers-registry-v5";
import { ConfigService } from "@nestjs/config";
import { useContainer } from "class-validator";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { ApiConfig } from "../../src/config/configuration.ts";

import { AppModule } from "../../src/app.module.ts";
import { RUNTIME_DEPENDENCIES } from "../../src/config/configuration.ts";
import { getNestFastifyApplication } from "../utils/app.ts";
import { describeWriteOps } from "../utils/describeWriteOps.ts";
import { getServer } from "../utils/getServer.ts";

describe("TIR API v5 - Generic tests (e2e)", () => {
  let app: NestFastifyApplication;
  let server: RawServerDefault | string;
  let apiUrlPrefix = "";

  beforeAll(async () => {
    app = await getNestFastifyApplication({
      imports: [AppModule],
    });

    if (process.env.TEST_ENV !== "remote") {
      await app.init();
      const fastifyInstance = app.getHttpAdapter().getInstance();
      await fastifyInstance.ready();
      useContainer(app.select(AppModule), { fallbackOnErrors: true });
    }

    const configService =
      app.get<ConfigService<ApiConfig, true>>(ConfigService);

    server = getServer(app, configService);

    if (process.env.TEST_ENV === "remote") {
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

  describe("GET /abi", () => {
    it("should return the ABI", async () => {
      expect.assertions(4);

      const response = await request(server).get("/abi");

      expect(response.body).toStrictEqual(Tir__factory.abi);
      expect(response.status).toBe(200);

      // Check headers
      expect(response.headers["content-security-policy"]).toContain(
        "frame-ancestors 'none'",
      );
      expect(response.headers["x-frame-options"]).toStrictEqual("DENY");
    });
  });

  it("GET /health", async () => {
    expect.assertions(2);
    const response = await request(server).get("/health");

    // Expect all the runtime dependencies to be up
    const dependencies = Object.keys(
      RUNTIME_DEPENDENCIES,
    ) as (keyof typeof RUNTIME_DEPENDENCIES)[];
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

  describeWriteOps()("POST /jsonrpc", () => {
    it("should reject a POST without JWT", async () => {
      expect.assertions(3);

      const response = await request(server).post("/jsonrpc").send();

      expect(response.body).toStrictEqual({
        detail: "Invalid or missing JWT",
        status: 401,
        title: "Unauthorized",
        type: "about:blank",
      });
      expect(response.status).toBe(401);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));
    });

    it("should reject a POST with an invalid token", async () => {
      expect.assertions(3);

      const response = await request(server)
        .post("/jsonrpc")
        .auth(
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJpc3MiOiJhbnkifQ.eiwf-6rtNV0oWpFidRTlcY6oLBpV0l2tEkCs5FNoIxY",
          { type: "bearer" },
        )
        .send();

      expect(response.body).toStrictEqual({
        detail: "Invalid JWT: empty or missing kid",
        status: 401,
        title: "Unauthorized",
        type: "about:blank",
      });
      expect(response.status).toBe(401);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));
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
