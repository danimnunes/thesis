import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { RawServerDefault } from "fastify";

import { ConfigService } from "@nestjs/config";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { ApiConfig } from "../../src/config/configuration.ts";

import { AppModule } from "../../src/app.module.ts";
import { getNestFastifyApplication } from "../utils/app.ts";
import { getServer } from "../utils/getServer.ts";

describe("Ledger API v4 - POST /ledger/v4/blockchains/besu", () => {
  let app: NestFastifyApplication;
  let server: RawServerDefault | string;

  beforeAll(async () => {
    app = await getNestFastifyApplication({ imports: [AppModule] });

    if (process.env.TEST_ENV !== "remote") {
      await app.init();
      const fastifyInstance = app.getHttpAdapter().getInstance();
      await fastifyInstance.ready();
    }

    const configService =
      app.get<ConfigService<ApiConfig, true>>(ConfigService);

    server = getServer(app, configService);
  });

  afterAll(async () => {
    await app.close();
  });

  // Generic tests
  it("should throw Bad Request for a bad JSON-RPC call", async () => {
    expect.assertions(2);

    const response = await request(server).post("/blockchains/besu").send();

    expect(response.body).toStrictEqual({
      error: {
        code: -32_700,
        message: "Parse error",
      },
      // eslint-disable-next-line unicorn/no-null
      id: null,
      jsonrpc: "2.0",
    });
    expect(response.status).toBe(400);
  });

  it("should return the chain ID", async () => {
    expect.assertions(4);

    const response = await request(server).post("/blockchains/besu").send({
      id: "42",
      jsonrpc: "2.0",
      method: "eth_chainId",
      params: [],
    });

    expect(response.body).toStrictEqual({
      id: "42",
      jsonrpc: "2.0",
      result: expect.stringMatching(/^0x[0-9a-fA-F]+$/),
    });
    expect(response.status).toBe(200);
    expect(response.header).toHaveProperty("content-type");
    expect(response.headers["content-type"]).toStrictEqual(
      expect.stringContaining("application/json"),
    );
  });

  it("should return the chain ID when params is omitted", async () => {
    expect.assertions(4);

    const response = await request(server).post("/blockchains/besu").send({
      id: "42",
      jsonrpc: "2.0",
      method: "eth_chainId",
    });

    expect(response.body).toStrictEqual({
      id: "42",
      jsonrpc: "2.0",
      result: expect.stringMatching(/^0x[0-9a-fA-F]+$/),
    });
    expect(response.status).toBe(200);
    expect(response.header).toHaveProperty("content-type");
    expect(response.headers["content-type"]).toStrictEqual(
      expect.stringContaining("application/json"),
    );
  });

  it("should return an error when the method does not exist or is not available", async () => {
    expect.assertions(2);

    // "test" method doesn't exist
    const response = await request(server).post("/blockchains/besu").send({
      id: "43",
      jsonrpc: "2.0",
      method: "test",
    });

    expect(response.body).toStrictEqual({
      error: {
        code: -32_601,
        message: "The method test does not exist / is not available.",
      },
      id: "43",
      jsonrpc: "2.0",
    });
    expect(response.status).toBe(200);
  });

  it("should support batch requests", async () => {
    expect.assertions(2);

    const response = await request(server)
      .post("/blockchains/besu")
      .send([
        {
          id: "42",
          jsonrpc: "2.0",
          method: "eth_chainId",
        },
        // "test" method doesn't exist
        {
          id: "43",
          jsonrpc: "2.0",
          method: "test",
        },
        // Notifications should be ignored
        {
          // No id
          jsonrpc: "2.0",
          method: "eth_chainId",
        },
      ]);

    expect(response.body).toStrictEqual([
      {
        id: "42",
        jsonrpc: "2.0",
        result: expect.stringMatching(/^0x[0-9a-fA-F]+$/),
      },
      {
        error: {
          code: -32_601,
          message: "The method test does not exist / is not available.",
        },
        id: "43",
        jsonrpc: "2.0",
      },
    ]);
    expect(response.status).toBe(200);
  });

  it("should forward the errors returned by Besu", async () => {
    expect.assertions(2);

    const response = await request(server).post("/blockchains/besu").send({
      id: "43",
      jsonrpc: "2.0",
      method: "eth_getBlockByHash",
      // Missing hash
      params: [],
    });

    expect(response.body).toStrictEqual({
      error: {
        code: -32_602,
        message: "Invalid block hash params",
      },
      id: "43",
      jsonrpc: "2.0",
    });
    expect(response.status).toBe(200);
  });
});
