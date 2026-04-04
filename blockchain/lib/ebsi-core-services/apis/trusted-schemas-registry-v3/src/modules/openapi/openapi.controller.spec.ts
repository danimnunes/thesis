import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { RawServerDefault } from "fastify";

import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

import { getNestFastifyApplication } from "../../../tests/utils/app.ts";
import { OpenApiModule } from "./openapi.module.ts";

describe("OpenApiController", () => {
  let app: NestFastifyApplication;
  let server: RawServerDefault;

  beforeAll(async () => {
    app = await getNestFastifyApplication({
      imports: [OpenApiModule],
    });

    await app.init();
    const fastifyInstance = app.getHttpAdapter().getInstance();
    await fastifyInstance.ready();
    server = app.getHttpServer();
  });

  it("should serve yaml", async () => {
    const response = await request(server).get("/openapi.yaml");
    expect(response.status).toBe(200);
    expect((response.headers as Record<string, unknown>)["content-type"]).toBe(
      "application/openapi+yaml",
    );
    expect(response.body).toBeDefined();
  });

  it("should serve json", async () => {
    const response = await request(server).get("/openapi.json");
    expect(response.status).toBe(200);
    expect((response.headers as Record<string, unknown>)["content-type"]).toBe(
      "application/openapi+json; charset=utf-8",
    );
    expect(response.body).toBeDefined();
  });
});
