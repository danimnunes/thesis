import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { RawServerDefault } from "fastify";

import { ProxyFactory__factory } from "@ebsiint-sc/trusted-contracts-registry-v1";
import { ethers } from "ethers";
import { randomBytes } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { TestContract } from "../../../tests/utils/data.ts";
import type { Contract } from "./contracts.interface.ts";

import { getNestFastifyApplication } from "../../../tests/utils/app.ts";
import { setupTestEnv } from "../../../tests/utils/tcr.ts";
import { LedgerService } from "../ledger/ledger.service.ts";
import { ContractsModule } from "./contracts.module.ts";

describe("Contracts Module", () => {
  let app: NestFastifyApplication;
  let server: RawServerDefault;
  let testEnv: Awaited<ReturnType<typeof setupTestEnv>>;
  let contracts: TestContract[];

  beforeAll(async () => {
    // Spin up test blockchain (hardhat)
    testEnv = await setupTestEnv({
      contractsTotal: 3,
    });
    const { provider, proxyFactoryContract } = testEnv;
    contracts = testEnv.contracts;

    // Mock contract
    vi.spyOn(ProxyFactory__factory, "connect").mockImplementation(
      // Create new instance without runner (provider)
      () => proxyFactoryContract.connect(),
    );

    // Mock LedgerService
    vi.spyOn(LedgerService.prototype, "getProvider").mockImplementation(
      // @ts-expect-error Error due to a mismatch between ESM and CommonJS modules
      () => provider,
    );

    app = await getNestFastifyApplication({
      imports: [ContractsModule],
    });

    await app.init();
    const fastifyInstance = app.getHttpAdapter().getInstance();
    await fastifyInstance.ready();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /contracts", () => {
    it("should return a paginated collection of contracts", async () => {
      expect.assertions(3);

      const response = await request(server).get("/contracts");

      expect(response.body).toStrictEqual({
        items: contracts.map((contract) => ({
          address: contract.address,
          href: expect.stringContaining(`/contracts/${contract.address}`),
        })),
        links: {
          first: expect.stringContaining(
            "/contracts?page[after]=1&page[size]=10",
          ),
          last: expect.stringContaining(
            "/contracts?page[after]=1&page[size]=10",
          ),
          next: expect.stringContaining(
            "/contracts?page[after]=1&page[size]=10",
          ),
          prev: expect.stringContaining(
            "/contracts?page[after]=1&page[size]=10",
          ),
        },
        pageSize: 10,
        self: expect.stringContaining("/contracts?page[after]=1&page[size]=10"),
        total: contracts.length,
      });
      expect((response.body as { items: string }).items).toHaveLength(
        contracts.length,
      );
      expect(response.status).toBe(200);
    });

    it("should handle the pagination properly", async () => {
      expect.assertions(12);

      const allContracts = contracts.map((contract) => ({
        address: contract.address,
        href: expect.stringContaining(`/contracts/${contract.address}`),
      }));
      const response1 = await request(server).get("/contracts?page[size]=2");
      expect(response1.body).toStrictEqual({
        items: allContracts.slice(0, 2),
        links: {
          first: expect.stringContaining(
            "/contracts?page[after]=1&page[size]=2",
          ),
          last: expect.stringContaining(
            "/contracts?page[after]=2&page[size]=2",
          ),
          next: expect.stringContaining(
            "/contracts?page[after]=2&page[size]=2",
          ),
          prev: expect.stringContaining(
            "/contracts?page[after]=1&page[size]=2",
          ),
        },
        pageSize: 2,
        self: expect.stringContaining("/contracts?page[after]=1&page[size]=2"),
        total: contracts.length,
      });
      expect((response1.body as { items: string }).items).toHaveLength(2);
      expect(response1.status).toBe(200);

      // next page
      const response2 = await request(server).get(
        "/contracts?page[after]=2&page[size]=2",
      );
      expect(response2.body).toStrictEqual({
        items: allContracts.slice(2, 4),
        links: {
          first: expect.stringContaining(
            "/contracts?page[after]=1&page[size]=2",
          ),
          last: expect.stringContaining(
            "/contracts?page[after]=2&page[size]=2",
          ),
          next: expect.stringContaining(
            "/contracts?page[after]=2&page[size]=2",
          ),
          prev: expect.stringContaining(
            "/contracts?page[after]=1&page[size]=2",
          ),
        },
        pageSize: 2,
        self: expect.stringContaining("/contracts?page[after]=2&page[size]=2"),
        total: contracts.length,
      });
      expect((response2.body as { items: string }).items).toHaveLength(1);
      expect(response2.status).toBe(200);

      // big page
      const response3 = await request(server).get(
        "/contracts?page[after]=100&page[size]=2",
      );
      expect(response3.body).toStrictEqual({
        items: [],
        links: {
          first: expect.stringContaining(
            "/contracts?page[after]=1&page[size]=2",
          ),
          last: expect.stringContaining(
            "/contracts?page[after]=2&page[size]=2",
          ),
          next: expect.stringContaining(
            "/contracts?page[after]=2&page[size]=2",
          ),
          prev: expect.stringContaining(
            "/contracts?page[after]=2&page[size]=2",
          ),
        },
        pageSize: 2,
        self: expect.stringContaining(
          "/contracts?page[after]=100&page[size]=2",
        ),
        total: contracts.length,
      });
      expect((response3.body as { items: string }).items).toHaveLength(0);
      expect(response3.status).toBe(200);

      // page["after"] defined but page["size"] undefined
      const response4 = await request(server).get("/contracts?page[after]=1");
      expect(response4.body).toStrictEqual({
        items: allContracts,
        links: {
          first: expect.stringContaining(
            "/contracts?page[after]=1&page[size]=10",
          ),
          last: expect.stringContaining(
            "/contracts?page[after]=1&page[size]=10",
          ),
          next: expect.stringContaining(
            "/contracts?page[after]=1&page[size]=10",
          ),
          prev: expect.stringContaining(
            "/contracts?page[after]=1&page[size]=10",
          ),
        },
        pageSize: 10,
        self: expect.stringContaining("/contracts?page[after]=1&page[size]=10"),
        total: contracts.length,
      });
      expect((response4.body as { items: string }).items).toHaveLength(
        contracts.length,
      );
      expect(response4.status).toBe(200);
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

    it("should reject a non whitelisted query", async () => {
      expect.assertions(2);

      const response = await request(server).get(
        "/contracts?invalid-query=abc",
      );

      expect(response.body).toStrictEqual({
        detail: '["property invalid-query should not exist"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
    });
  });

  describe("GET /contracts/{address}", () => {
    it("should throw an error 400 if the contract ID is not valid", async () => {
      expect.assertions(12);

      let response = await request(server).get(`/contracts/no-contract`);

      expect(response.body).toStrictEqual({
        detail: JSON.stringify(["address must be an Ethereum address"]),
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
        detail: JSON.stringify(["address must be an Ethereum address"]),
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));

      response = await request(server).get(
        `/contracts/${randomBytes(40).toString("hex")}`,
      );

      expect(response.body).toStrictEqual({
        detail: JSON.stringify(["address must be an Ethereum address"]),
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
        detail: JSON.stringify(["address must be an Ethereum address"]),
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

    it("should return a specific contract identified by its address", async () => {
      expect.assertions(3);

      const contract = testEnv.contracts[0]!;

      const response = await request(server).get(
        `/contracts/${contract.address}`,
      );

      expect(response.body).toStrictEqual({
        address: contract.address,
        deployer: contract.deployer,
        deployerDID: contract.deployerDID,
        deploymentTimestamp: Number(contract.deploymentTimestamp),
        isActive: contract.isActive,
        templateId: contract.templateId,
      } satisfies Contract);
      expect(response.status).toBe(200);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/json"));
    });
  });
});
