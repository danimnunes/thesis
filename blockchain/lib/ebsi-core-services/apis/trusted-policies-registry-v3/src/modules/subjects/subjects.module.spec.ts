import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { RawServerDefault } from "fastify";

import { PolicyRegistry__factory } from "@ebsiint-sc/trusted-policies-registry-v3";
import { ethers } from "ethers";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { UserObject } from "../../../tests/utils/trustedPoliciesRegistry.ts";

import { getNestFastifyApplication } from "../../../tests/utils/app.ts";
import { setupTestEnv } from "../../../tests/utils/trustedPoliciesRegistry.ts";
import { LedgerService } from "../ledger/ledger.service.ts";
import { SubjectsModule } from "./subjects.module.ts";

const USERS_TOTAL = 12;

describe("Subjects Module", () => {
  let app: NestFastifyApplication;
  let server: RawServerDefault;
  let testEnv: Awaited<ReturnType<typeof setupTestEnv>>;
  let user: UserObject;

  beforeAll(async () => {
    // Spin up test blockchain
    testEnv = await setupTestEnv({
      usersTotal: USERS_TOTAL,
    });
    user = testEnv.users[0]!;

    const { policiesRegistryContract } = testEnv;

    // Mock TPR contract
    vi.spyOn(PolicyRegistry__factory, "connect").mockImplementation(
      // Create new instance without runner (provider)
      () => policiesRegistryContract.connect(),
    );

    // Mock LedgerService
    vi.spyOn(LedgerService.prototype, "getProvider").mockImplementation(
      // @ts-expect-error Error due to a mismatch between ESM and CommonJS modules
      () => testEnv.provider,
    );

    app = await getNestFastifyApplication({ imports: [SubjectsModule] });

    await app.init();
    const fastifyInstance = app.getHttpAdapter().getInstance();
    await fastifyInstance.ready();

    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /subjects", () => {
    it("should return a paginated collection of subjects", async () => {
      expect.assertions(3);

      const response = await request(server).get("/subjects");
      expect(response.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining(
            "/subjects?page[after]=1&page[size]=10",
          ),
          last: expect.stringContaining(
            `/subjects?page[after]=${Math.ceil(USERS_TOTAL / 10)}&page[size]=10`,
          ),
          next: expect.stringContaining(
            `/subjects?page[after]=${Math.min(
              Math.ceil(USERS_TOTAL / 10),
              2,
            )}&page[size]=10`,
          ),
          prev: expect.stringContaining(
            "/subjects?page[after]=1&page[size]=10",
          ),
        },
        pageSize: 10,
        self: expect.stringContaining("/subjects?page[after]=1&page[size]=10"),
        total: USERS_TOTAL,
      });
      expect((response.body as { items: string }).items).toHaveLength(
        Math.min(10, USERS_TOTAL),
      );
      expect(response.status).toBe(200);
    });

    it("should handle the pagination properly", async () => {
      expect.assertions(12);

      const response1 = await request(server).get("/subjects?page[size]=3");
      expect(response1.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining(
            "/subjects?page[after]=1&page[size]=3",
          ),
          last: expect.stringContaining("/subjects?page[after]=4&page[size]=3"),
          next: expect.stringContaining("/subjects?page[after]=2&page[size]=3"),
          prev: expect.stringContaining("/subjects?page[after]=1&page[size]=3"),
        },
        pageSize: 3,
        self: expect.stringContaining("/subjects?page[after]=1&page[size]=3"),
        total: USERS_TOTAL,
      });
      expect((response1.body as { items: string }).items).toHaveLength(3);
      expect(response1.status).toBe(200);

      // next page
      const response2 = await request(server).get(
        "/subjects?page[after]=2&page[size]=3",
      );
      expect(response2.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining(
            "/subjects?page[after]=1&page[size]=3",
          ),
          last: expect.stringContaining("/subjects?page[after]=4&page[size]=3"),
          next: expect.stringContaining("/subjects?page[after]=3&page[size]=3"),
          prev: expect.stringContaining("/subjects?page[after]=1&page[size]=3"),
        },
        pageSize: 3,
        self: expect.stringContaining("/subjects"),
        total: USERS_TOTAL,
      });
      expect((response2.body as { items: string }).items).toHaveLength(3);
      expect(response2.status).toBe(200);

      // big page
      const response3 = await request(server).get(
        "/subjects?page[after]=100&page[size]=3",
      );
      expect(response3.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining(
            "/subjects?page[after]=1&page[size]=3",
          ),
          last: expect.stringContaining("/subjects?page[after]=4&page[size]=3"),
          next: expect.stringContaining("/subjects?page[after]=4&page[size]=3"),
          prev: expect.stringContaining("/subjects?page[after]=4&page[size]=3"),
        },
        pageSize: 3,
        self: expect.stringContaining("/subjects?page[after]=100&page[size]=3"),
        total: USERS_TOTAL,
      });
      expect((response3.body as { items: string }).items).toHaveLength(0);
      expect(response3.status).toBe(200);

      // page after defined but page size undefined
      const response4 = await request(server).get("/subjects?page[after]=1");
      expect(response4.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining(
            "/subjects?page[after]=1&page[size]=10",
          ),
          last: expect.stringContaining(
            "/subjects?page[after]=2&page[size]=10",
          ),
          next: expect.stringContaining(
            "/subjects?page[after]=2&page[size]=10",
          ),
          prev: expect.stringContaining(
            "/subjects?page[after]=1&page[size]=10",
          ),
        },
        pageSize: 10,
        self: expect.stringContaining("/subjects"),
        total: USERS_TOTAL,
      });
      expect((response4.body as { items: string }).items).toHaveLength(10);
      expect(response4.status).toBe(200);
    });

    it("should throw a Bad Request for bad pagination", async () => {
      expect.assertions(8);

      const response1 = await request(server).get("/subjects?page[size]=100");
      expect(response1.body).toStrictEqual({
        detail: '["page[size] must not be greater than 50"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response1.status).toBe(400);

      const response2 = await request(server).get("/subjects?page[size]=0");
      expect(response2.body).toStrictEqual({
        detail: '["page[size] must not be less than 1"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response2.status).toBe(400);

      const response3 = await request(server).get("/subjects?page[after]=0");
      expect(response3.body).toStrictEqual({
        detail: '["page[after] must not be less than 1"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response3.status).toBe(400);

      const response4 = await request(server).get("/subjects?page[after]=abc");
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

  describe("GET /subjects/{address}", () => {
    it("should return a specific subject", async () => {
      expect.assertions(2);

      const response = await request(server).get(`/subjects/${user.user}`);

      expect(response.body).toStrictEqual({ subject: user.user });
      expect(response.status).toBe(200);
    });

    it("should return a specific subject (without attributes)", async () => {
      expect.assertions(2);

      // Create new user
      const user = ethers.Wallet.createRandom().address;

      // Insert 1 attribute and then remove it
      await testEnv.policiesRegistryContract.insertUserAttributes(user, [
        "attr1",
      ]);
      await testEnv.policiesRegistryContract.deleteUserAttribute(user, "attr1");

      const response = await request(server).get(`/subjects/${user}`);

      expect(response.body).toStrictEqual({ subject: user });
      expect(response.status).toBe(200);
    });

    it("should throw an error for bad requests", async () => {
      expect.assertions(2);

      const response = await request(server).get("/subjects/bad-address");

      expect(response.body).toStrictEqual({
        detail: `["subject must be an Ethereum address"]`,
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
    });

    it("should throw an error for bad requests (invalid checksum)", async () => {
      expect.assertions(2);

      const response = await request(server).get(
        "/subjects/0x69e48d89bf5e09588E858D757323b4abBAB3f814",
      );

      expect(response.body).toStrictEqual({
        detail: `["subject must be an Ethereum address"]`,
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
    });

    it("should throw an error if the user is not found", async () => {
      expect.assertions(2);

      const randomAddress = ethers.Wallet.createRandom().address;
      const response = await request(server).get(`/subjects/${randomAddress}`);

      expect(response.body).toStrictEqual({
        detail: `Subject ${randomAddress} not found`,
        status: 404,
        title: "Subject Not Found",
        type: "about:blank",
      });
      expect(response.status).toBe(404);
    });
  });

  describe("GET /subjects/{address}/policies", () => {
    it("should return a paginated collection of policies", async () => {
      expect.assertions(3);

      const response = await request(server).get(
        `/subjects/${user.user}/policies`,
      );
      expect(response.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining(
            `/subjects/${user.user}/policies?page[after]=1&page[size]=10`,
          ),
          last: expect.stringContaining(
            `/subjects/${user.user}/policies?page[after]=1&page[size]=10`,
          ),
          next: expect.stringContaining(
            `/subjects/${user.user}/policies?page[after]=1&page[size]=10`,
          ),
          prev: expect.stringContaining(
            `/subjects/${user.user}/policies?page[after]=1&page[size]=10`,
          ),
        },
        pageSize: 10,
        self: expect.stringContaining(
          `/subjects/${user.user}/policies?page[after]=1&page[size]=10`,
        ),
        total: 3,
      });
      expect((response.body as { items: string }).items).toHaveLength(3);
      expect(response.status).toBe(200);
    });

    it("should return an empty collection of policies (subject without attributes)", async () => {
      expect.assertions(2);

      // Create new user
      const user = ethers.Wallet.createRandom().address;

      // Insert 1 attribute and then remove it
      await testEnv.policiesRegistryContract.insertUserAttributes(user, [
        "attr1",
      ]);
      await testEnv.policiesRegistryContract.deleteUserAttribute(user, "attr1");

      const response = await request(server).get(`/subjects/${user}/policies`);

      expect(response.body).toStrictEqual({
        items: [],
        links: {
          first: expect.stringContaining(
            `/subjects/${user}/policies?page[after]=1&page[size]=10`,
          ),
          last: expect.stringContaining(
            `/subjects/${user}/policies?page[after]=1&page[size]=10`,
          ),
          next: expect.stringContaining(
            `/subjects/${user}/policies?page[after]=1&page[size]=10`,
          ),
          prev: expect.stringContaining(
            `/subjects/${user}/policies?page[after]=1&page[size]=10`,
          ),
        },
        pageSize: 10,
        self: expect.stringContaining(
          `/subjects/${user}/policies?page[after]=1&page[size]=10`,
        ),
        total: 0,
      });
      expect(response.status).toBe(200);
    });

    it("should handle the pagination properly", async () => {
      expect.assertions(12);

      const response1 = await request(server).get(
        `/subjects/${user.user}/policies?page[size]=2`,
      );
      expect(response1.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining(
            `/subjects/${user.user}/policies?page[after]=1&page[size]=2`,
          ),
          last: expect.stringContaining(
            `/subjects/${user.user}/policies?page[after]=2&page[size]=2`,
          ),
          next: expect.stringContaining(
            `/subjects/${user.user}/policies?page[after]=2&page[size]=2`,
          ),
          prev: expect.stringContaining(
            `/subjects/${user.user}/policies?page[after]=1&page[size]=2`,
          ),
        },
        pageSize: 2,
        self: expect.stringContaining(
          `/subjects/${user.user}/policies?page[after]=1&page[size]=2`,
        ),
        total: 3,
      });
      expect((response1.body as { items: string }).items).toHaveLength(2);
      expect(response1.status).toBe(200);

      // next page
      const response2 = await request(server).get(
        `/subjects/${user.user}/policies?page[after]=2&page[size]=2`,
      );
      expect(response2.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining(
            `/subjects/${user.user}/policies?page[after]=1&page[size]=2`,
          ),
          last: expect.stringContaining(
            `/subjects/${user.user}/policies?page[after]=2&page[size]=2`,
          ),
          next: expect.stringContaining(
            `/subjects/${user.user}/policies?page[after]=2&page[size]=2`,
          ),
          prev: expect.stringContaining(
            `/subjects/${user.user}/policies?page[after]=1&page[size]=2`,
          ),
        },
        pageSize: 2,
        self: expect.stringContaining("/subjects"),
        total: 3,
      });
      expect((response2.body as { items: string }).items).toHaveLength(1);
      expect(response2.status).toBe(200);

      // big page
      const response3 = await request(server).get(
        `/subjects/${user.user}/policies?page[after]=100&page[size]=2`,
      );
      expect(response3.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining(
            `/subjects/${user.user}/policies?page[after]=1&page[size]=2`,
          ),
          last: expect.stringContaining(
            `/subjects/${user.user}/policies?page[after]=2&page[size]=2`,
          ),
          next: expect.stringContaining(
            `/subjects/${user.user}/policies?page[after]=2&page[size]=2`,
          ),
          prev: expect.stringContaining(
            `/subjects/${user.user}/policies?page[after]=2&page[size]=2`,
          ),
        },
        pageSize: 2,
        self: expect.stringContaining(
          `/subjects/${user.user}/policies?page[after]=100&page[size]=2`,
        ),
        total: 3,
      });
      expect((response3.body as { items: string }).items).toHaveLength(0);
      expect(response3.status).toBe(200);

      // page after defined but page size undefined
      const response4 = await request(server).get(
        `/subjects/${user.user}/policies?page[after]=1`,
      );
      expect(response4.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining(
            `/subjects/${user.user}/policies?page[after]=1&page[size]=10`,
          ),
          last: expect.stringContaining(
            `/subjects/${user.user}/policies?page[after]=1&page[size]=10`,
          ),
          next: expect.stringContaining(
            `/subjects/${user.user}/policies?page[after]=1&page[size]=10`,
          ),
          prev: expect.stringContaining(
            `/subjects/${user.user}/policies?page[after]=1&page[size]=10`,
          ),
        },
        pageSize: 10,
        self: expect.stringContaining("/subjects"),
        total: 3,
      });
      expect((response4.body as { items: string }).items).toHaveLength(3);
      expect(response4.status).toBe(200);
    });

    it("should throw a Bad Request for bad pagination", async () => {
      expect.assertions(8);

      const response1 = await request(server).get(
        `/subjects/${user.user}/policies?page[size]=100`,
      );
      expect(response1.body).toStrictEqual({
        detail: '["page[size] must not be greater than 50"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response1.status).toBe(400);

      const response2 = await request(server).get(
        `/subjects/${user.user}/policies?page[size]=0`,
      );
      expect(response2.body).toStrictEqual({
        detail: '["page[size] must not be less than 1"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response2.status).toBe(400);

      const response3 = await request(server).get(
        `/subjects/${user.user}/policies?page[after]=0`,
      );
      expect(response3.body).toStrictEqual({
        detail: '["page[after] must not be less than 1"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response3.status).toBe(400);

      const response4 = await request(server).get(
        `/subjects/${user.user}/policies?page[after]=abc`,
      );
      expect(response4.body).toStrictEqual({
        detail:
          '["page[after] must not be less than 1","page[after] must be a number conforming to the specified constraints"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response4.status).toBe(400);
    });

    it("should throw an error for bad requests (invalid checksum)", async () => {
      expect.assertions(2);

      const response = await request(server).get(
        "/subjects/0x69e48d89bf5e09588E858D757323b4abBAB3f814/policies",
      );

      expect(response.body).toStrictEqual({
        detail: `["subject must be an Ethereum address"]`,
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
    });

    it("should throw an error if the user is not found", async () => {
      expect.assertions(2);

      const randomAddress = ethers.Wallet.createRandom().address;
      const response = await request(server).get(
        `/subjects/${randomAddress}/policies`,
      );

      expect(response.body).toStrictEqual({
        detail: `Subject ${randomAddress} not found`,
        status: 404,
        title: "Subject Not Found",
        type: "about:blank",
      });
      expect(response.status).toBe(404);
    });
  });

  describe("GET /subjects/{address}/policies/{policyId}", () => {
    it("should return a specific user policy", async () => {
      expect.assertions(2);

      const response = await request(server).get(
        `/subjects/${user.user}/policies/test-attr1`,
      );

      expect(response.body).toStrictEqual({
        policyName: "test-attr1",
        subject: user.user,
      });
      expect(response.status).toBe(200);
    });

    it("should throw an error for bad requests (invalid checksum)", async () => {
      expect.assertions(2);

      const response = await request(server).get(
        "/subjects/0x69e48d89bf5e09588E858D757323b4abBAB3f814/policies/test-attr1",
      );

      expect(response.body).toStrictEqual({
        detail: `["subject must be an Ethereum address"]`,
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
    });

    it("should throw if the subject does not exist", async () => {
      expect.assertions(2);

      const randomAddress = ethers.Wallet.createRandom().address;
      const response = await request(server).get(
        `/subjects/${randomAddress}/policies/test-attr1`,
      );

      expect(response.body).toStrictEqual({
        detail: `Subject ${randomAddress} not found`,
        status: 404,
        title: "Subject Not Found",
        type: "about:blank",
      });
      expect(response.status).toBe(404);
    });

    it("should throw if the subject policy does not exist", async () => {
      expect.assertions(2);

      const response = await request(server).get(
        `/subjects/${user.user}/policies/bad-policy`,
      );

      expect(response.body).toStrictEqual({
        detail: `Subject ${user.user} doesn't have the policy bad-policy`,
        status: 404,
        title: "Subject Policy Not Found",
        type: "about:blank",
      });
      expect(response.status).toBe(404);
    });
  });
});
