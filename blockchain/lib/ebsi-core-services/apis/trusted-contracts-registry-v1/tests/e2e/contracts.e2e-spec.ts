import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { RawServerDefault } from "fastify";

import { ConfigService } from "@nestjs/config";
import { useContainer } from "class-validator";
import { ethers } from "ethers";
import { randomBytes } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { ApiConfig } from "../../src/config/configuration.ts";
import type {
  Contract,
  ContractsLink,
} from "../../src/modules/contracts/contracts.interface.ts";

import { AppModule } from "../../src/app.module.ts";
import { getNestFastifyApplication } from "../utils/app.ts";
import { getServer } from "../utils/getServer.ts";

describe("Trusted Contracts Registry API v1 - Contracts (e2e)", () => {
  let app: NestFastifyApplication;
  let server: RawServerDefault | string;
  let configService: ConfigService<ApiConfig, true>;

  beforeAll(async () => {
    app = await getNestFastifyApplication({
      imports: [AppModule],
    });

    useContainer(app.select(AppModule), { fallbackOnErrors: true });

    configService = app.get<ConfigService<ApiConfig, true>>(ConfigService);

    if (process.env.TEST_ENV !== "remote") {
      await app.init();
      const fastifyInstance = app.getHttpAdapter().getInstance();
      await fastifyInstance.ready();
    }

    server = getServer(app, configService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /contracts", () => {
    it("should return a paginated collection of contracts", async () => {
      expect.assertions(2);

      const response = await request(server).get("/contracts");

      const total =
        ((response.body as Record<string, unknown>)?.["total"] as number) ?? 0;

      expect(response.body).toStrictEqual({
        items:
          total > 0
            ? expect.arrayContaining([
                {
                  address: expect.stringContaining("0x"),
                  href: expect.stringContaining("/contracts/"),
                },
              ])
            : [],
        links: {
          first: expect.stringContaining(
            "/contracts?page[after]=1&page[size]=10",
          ),
          last: expect.stringContaining(
            `/contracts?page[after]=${Math.max(Math.ceil(total / 10), 1)}&page[size]=10`,
          ),
          next: expect.stringContaining(
            `/contracts?page[after]=${total > 10 ? 2 : 1}&page[size]=10`,
          ),
          prev: expect.stringContaining(
            "/contracts?page[after]=1&page[size]=10",
          ),
        },
        pageSize: 10,
        self: expect.stringContaining("/contracts?page[after]=1&page[size]=10"),
        total: expect.any(Number),
      });
      expect(response.status).toBe(200);
    });

    it("should throw a Bad Request for bad pagination", async () => {
      expect.assertions(8);

      const response1 = await request(server).get("/contracts?page[size]=100");
      expect(response1.body).toStrictEqual({
        detail: '["page[size] must not be greater than 50"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response1.status).toBe(400);

      const response2 = await request(server).get("/contracts?page[size]=0");
      expect(response2.body).toStrictEqual({
        detail: '["page[size] must not be less than 1"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response2.status).toBe(400);

      const response3 = await request(server).get("/contracts?page[after]=0");
      expect(response3.body).toStrictEqual({
        detail: '["page[after] must not be less than 1"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response3.status).toBe(400);

      const response4 = await request(server).get("/contracts?page[after]=abc");
      expect(response4.body).toStrictEqual({
        detail:
          '["page[after] must not be less than 1","page[after] must be a number conforming to the specified constraints"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response4.status).toBe(400);
    });
  });

  describe("GET /contracts/{address}", () => {
    it("should return a specific contract", async () => {
      let response = await request(server).get("/contracts");

      const { items } = response.body as { items: ContractsLink[] };

      if (items.length === 0) {
        expect.assertions(0);
        return;
      }

      expect.assertions(3);

      const contractAddress = items[0]!.address;

      response = await request(server).get(`/contracts/${contractAddress}`);

      expect(response.body).toStrictEqual({
        address: contractAddress,
        deployer: expect.stringMatching(/^0x/),
        deployerDID: expect.stringMatching(/^did:/),
        deploymentTimestamp: expect.any(Number),
        isActive: expect.any(Boolean),
        templateId: expect.stringMatching(/^0x/),
      } satisfies Contract);
      expect(response.status).toBe(200);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/json"));
    });

    it("should throw an error 400 if the contract address is not valid", async () => {
      expect.assertions(12);

      let response = await request(server).get(`/contracts/no-contract`);

      expect(response.body).toStrictEqual({
        detail: '["address must be an Ethereum address"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));

      response = await request(server).get(`/contracts/0xnothexadecimal`);

      expect(response.body).toStrictEqual({
        detail: '["address must be an Ethereum address"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));

      response = await request(server).get(
        `/contracts/${randomBytes(24).toString("hex")}`,
      );

      expect(response.body).toStrictEqual({
        detail: '["address must be an Ethereum address"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));

      response = await request(server).get(
        `/contracts/0x${randomBytes(24).toString("hex")}`,
      );

      expect(response.body).toStrictEqual({
        detail: '["address must be an Ethereum address"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));
    });

    it("should throw an error if the contract is not found", async () => {
      expect.assertions(3);

      const address = ethers.Wallet.createRandom().address;
      const response = await request(server).get(`/contracts/${address}`);

      expect(response.body).toStrictEqual({
        detail: `Contract ${address} not found`,
        status: 404,
        title: "Contract Not Found",
        type: "about:blank",
      });
      expect(response.status).toBe(404);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));
    });
  });
});
