import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { RawServerDefault } from "fastify";

import { PolicyRegistry__factory } from "@ebsiint-sc/trusted-policies-registry-v3";
import { ethers } from "ethers";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { getNestFastifyApplication } from "../../../tests/utils/app.ts";
import { setupTestEnv } from "../../../tests/utils/trustedPoliciesRegistry.ts";
import { LedgerService } from "../ledger/ledger.service.ts";
import { UsersModule } from "./users.module.ts";

const USERS_TOTAL = 12;

describe("Users Module", () => {
  let app: NestFastifyApplication;
  let server: RawServerDefault;
  let testEnv: Awaited<ReturnType<typeof setupTestEnv>>;

  beforeAll(async () => {
    // Spin up test blockchain
    testEnv = await setupTestEnv({
      usersTotal: USERS_TOTAL,
    });

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

    app = await getNestFastifyApplication({ imports: [UsersModule] });

    await app.init();
    const fastifyInstance = app.getHttpAdapter().getInstance();
    await fastifyInstance.ready();

    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /users", () => {
    it("should return a paginated collection of users", async () => {
      expect.assertions(3);

      const response = await request(server).get("/users");
      expect(response.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining("/users?page[after]=1&page[size]=10"),
          last: expect.stringContaining(
            `/users?page[after]=${Math.ceil(USERS_TOTAL / 10)}&page[size]=10`,
          ),
          next: expect.stringContaining(
            `/users?page[after]=${Math.min(
              Math.ceil(USERS_TOTAL / 10),
              2,
            )}&page[size]=10`,
          ),
          prev: expect.stringContaining("/users?page[after]=1&page[size]=10"),
        },
        pageSize: 10,
        self: expect.stringContaining("/users?page[after]=1&page[size]=10"),
        total: USERS_TOTAL,
      });
      expect((response.body as { items: string }).items).toHaveLength(
        Math.min(10, USERS_TOTAL),
      );
      expect(response.status).toBe(200);
    });

    it("should handle the pagination properly", async () => {
      expect.assertions(12);

      const response1 = await request(server).get("/users?page[size]=3");
      expect(response1.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining("/users?page[after]=1&page[size]=3"),
          last: expect.stringContaining("/users?page[after]=4&page[size]=3"),
          next: expect.stringContaining("/users?page[after]=2&page[size]=3"),
          prev: expect.stringContaining("/users?page[after]=1&page[size]=3"),
        },
        pageSize: 3,
        self: expect.stringContaining("/users?page[after]=1&page[size]=3"),
        total: USERS_TOTAL,
      });
      expect((response1.body as { items: string }).items).toHaveLength(3);
      expect(response1.status).toBe(200);

      // next page
      const response2 = await request(server).get(
        "/users?page[after]=2&page[size]=3",
      );
      expect(response2.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining("/users?page[after]=1&page[size]=3"),
          last: expect.stringContaining("/users?page[after]=4&page[size]=3"),
          next: expect.stringContaining("/users?page[after]=3&page[size]=3"),
          prev: expect.stringContaining("/users?page[after]=1&page[size]=3"),
        },
        pageSize: 3,
        self: expect.stringContaining("/users"),
        total: USERS_TOTAL,
      });
      expect((response2.body as { items: string }).items).toHaveLength(3);
      expect(response2.status).toBe(200);

      // big page
      const response3 = await request(server).get(
        "/users?page[after]=100&page[size]=3",
      );
      expect(response3.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining("/users?page[after]=1&page[size]=3"),
          last: expect.stringContaining("/users?page[after]=4&page[size]=3"),
          next: expect.stringContaining("/users?page[after]=4&page[size]=3"),
          prev: expect.stringContaining("/users?page[after]=4&page[size]=3"),
        },
        pageSize: 3,
        self: expect.stringContaining("/users?page[after]=100&page[size]=3"),
        total: USERS_TOTAL,
      });
      expect((response3.body as { items: string }).items).toHaveLength(0);
      expect(response3.status).toBe(200);

      // page after defined but page size undefined
      const response4 = await request(server).get("/users?page[after]=1");
      expect(response4.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining("/users?page[after]=1&page[size]=10"),
          last: expect.stringContaining("/users?page[after]=2&page[size]=10"),
          next: expect.stringContaining("/users?page[after]=2&page[size]=10"),
          prev: expect.stringContaining("/users?page[after]=1&page[size]=10"),
        },
        pageSize: 10,
        self: expect.stringContaining("/users"),
        total: USERS_TOTAL,
      });
      expect((response4.body as { items: string }).items).toHaveLength(10);
      expect(response4.status).toBe(200);
    });

    it("should throw a Bad Request for bad pagination", async () => {
      expect.assertions(8);

      const response1 = await request(server).get("/users?page[size]=100");
      expect(response1.body).toStrictEqual({
        detail: '["page[size] must not be greater than 50"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response1.status).toBe(400);

      const response2 = await request(server).get("/users?page[size]=0");
      expect(response2.body).toStrictEqual({
        detail: '["page[size] must not be less than 1"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response2.status).toBe(400);

      const response3 = await request(server).get("/users?page[after]=0");
      expect(response3.body).toStrictEqual({
        detail: '["page[after] must not be less than 1"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response3.status).toBe(400);

      const response4 = await request(server).get("/users?page[after]=abc");
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

  describe("GET /users/{address}", () => {
    it("should return a specific user", async () => {
      expect.assertions(2);

      // Get first user
      const user = testEnv.users[0]!;

      const response = await request(server).get(`/users/${user.user}`);

      expect(response.body).toStrictEqual(user);
      expect(response.status).toBe(200);
    });

    it("should return a specific user (without attributes)", async () => {
      expect.assertions(2);

      // Create new user
      const user = ethers.Wallet.createRandom().address;

      // Insert 1 attribute and then remove it
      await testEnv.policiesRegistryContract.insertUserAttributes(user, [
        "attr1",
      ]);
      await testEnv.policiesRegistryContract.deleteUserAttribute(user, "attr1");

      const response = await request(server).get(`/users/${user}`);

      expect(response.body).toStrictEqual({
        attributes: [],
        user,
      });
      expect(response.status).toBe(200);
    });

    it("should throw an error for bad requests", async () => {
      expect.assertions(2);

      const response = await request(server).get("/users/bad-address");

      expect(response.body).toStrictEqual({
        detail: `["user must be an Ethereum address"]`,
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
    });

    it("should throw an error if the user is not found", async () => {
      expect.assertions(2);

      const randomAddress = ethers.Wallet.createRandom().address;
      const response = await request(server).get(`/users/${randomAddress}`);

      expect(response.body).toStrictEqual({
        detail: `User ${randomAddress} not found`,
        status: 404,
        title: "User Not Found",
        type: "about:blank",
      });
      expect(response.status).toBe(404);
    });
  });
});
