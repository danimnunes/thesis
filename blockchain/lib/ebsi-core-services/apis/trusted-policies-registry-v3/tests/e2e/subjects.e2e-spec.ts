import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { RawServerDefault } from "fastify";

import { ConfigService } from "@nestjs/config";
import { ethers } from "ethers";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { ApiConfig } from "../../src/config/configuration.ts";

import { AppModule } from "../../src/app.module.ts";
import { getNestFastifyApplication } from "../utils/app.ts";
import { getServer } from "../utils/getServer.ts";

describe("TPR API v3 - Subjects (e2e)", () => {
  let app: NestFastifyApplication;
  let server: RawServerDefault | string;
  let configService: ConfigService<ApiConfig, true>;
  let subjectAddress: string;

  beforeAll(async () => {
    app = await getNestFastifyApplication({
      imports: [AppModule],
    });

    if (process.env.TEST_ENV !== "remote") {
      await app.init();
      const fastifyInstance = app.getHttpAdapter().getInstance();
      await fastifyInstance.ready();
    }

    configService = app.get<ConfigService<ApiConfig, true>>(ConfigService);

    server = getServer(app, configService);

    subjectAddress = configService.get("testSubjectAddress", { infer: true });
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /subjects", () => {
    it("should return a paginated collection of subjects", async () => {
      expect.assertions(2);

      const response = await request(server).get("/subjects");
      expect(response.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining(
            "/subjects?page[after]=1&page[size]=10",
          ),
          last: expect.stringMatching(
            /\/subjects\?page\[after\]=\d*&page\[size\]=10/,
          ),
          next: expect.stringMatching(
            /\/subjects\?page\[after\]=\d*&page\[size\]=10/,
          ),
          prev: expect.stringContaining(
            "/subjects?page[after]=1&page[size]=10",
          ),
        },
        pageSize: 10,
        self: expect.stringContaining("/subjects?page[after]=1&page[size]=10"),
        total: expect.any(Number),
      });
      expect(response.status).toBe(200);
    });

    it("should handle the pagination properly", async () => {
      expect.assertions(11);

      const response1 = await request(server).get("/subjects?page[size]=3");
      expect(response1.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining(
            "/subjects?page[after]=1&page[size]=3",
          ),
          last: expect.stringMatching(
            /\/subjects\?page\[after\]=\d*&page\[size\]=3/,
          ),
          next: expect.stringMatching(
            /\/subjects\?page\[after\]=\d*&page\[size\]=3/,
          ),
          prev: expect.stringContaining("/subjects?page[after]=1&page[size]=3"),
        },
        pageSize: 3,
        self: expect.stringContaining("/subjects?page[after]=1&page[size]=3"),
        total: expect.any(Number),
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
          last: expect.stringMatching(
            /\/subjects\?page\[after\]=\d*&page\[size\]=3/,
          ),
          next: expect.stringMatching(
            /\/subjects\?page\[after\]=\d*&page\[size\]=3/,
          ),
          prev: expect.stringContaining("/subjects?page[after]=1&page[size]=3"),
        },
        pageSize: 3,
        self: expect.stringContaining("/subjects"),
        total: expect.any(Number),
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
          last: expect.stringMatching(
            /\/subjects\?page\[after\]=\d*&page\[size\]=3/,
          ),
          next: expect.stringMatching(
            /\/subjects\?page\[after\]=\d*&page\[size\]=3/,
          ),
          prev: expect.stringMatching(
            /\/subjects\?page\[after\]=\d*&page\[size\]=3/,
          ),
        },
        pageSize: 3,
        self: expect.stringContaining("/subjects?page[after]=100&page[size]=3"),
        total: expect.any(Number),
      });
      expect(response3.status).toBe(200);

      // page after defined but page size undefined
      const response4 = await request(server).get("/subjects?page[after]=1");
      expect(response4.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining(
            "/subjects?page[after]=1&page[size]=10",
          ),
          last: expect.stringMatching(
            /\/subjects\?page\[after\]=\d*&page\[size\]=10/,
          ),
          next: expect.stringMatching(
            /\/subjects\?page\[after\]=\d*&page\[size\]=10/,
          ),
          prev: expect.stringContaining(
            "/subjects?page[after]=1&page[size]=10",
          ),
        },
        pageSize: 10,
        self: expect.stringContaining("/subjects"),
        total: expect.any(Number),
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

      const response = await request(server).get(`/subjects/${subjectAddress}`);

      expect(response.body).toStrictEqual({ subject: subjectAddress });
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
      expect.assertions(2);

      const response = await request(server).get(
        `/subjects/${subjectAddress}/policies`,
      );
      expect(response.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining(
            `/subjects/${subjectAddress}/policies?page[after]=1&page[size]=10`,
          ),
          last: expect.stringMatching(
            /\/subjects\/0x\w*\/policies\?page\[after\]=\d*&page\[size\]=10/,
          ),
          next: expect.stringMatching(
            /\/subjects\/0x\w*\/policies\?page\[after\]=\d*&page\[size\]=10/,
          ),
          prev: expect.stringContaining(
            `/subjects/${subjectAddress}/policies?page[after]=1&page[size]=10`,
          ),
        },
        pageSize: 10,
        self: expect.stringContaining(
          `/subjects/${subjectAddress}/policies?page[after]=1&page[size]=10`,
        ),
        total: expect.any(Number),
      });
      expect(response.status).toBe(200);
    });

    it("should handle the pagination properly", async () => {
      expect.assertions(8);

      const response1 = await request(server).get(
        `/subjects/${subjectAddress}/policies?page[size]=2`,
      );
      expect(response1.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining(
            `/subjects/${subjectAddress}/policies?page[after]=1&page[size]=2`,
          ),
          last: expect.stringMatching(
            /\/subjects\/0x\w*\/policies\?page\[after\]=\d*&page\[size\]=2/,
          ),
          next: expect.stringMatching(
            /\/subjects\/0x\w*\/policies\?page\[after\]=\d*&page\[size\]=2/,
          ),
          prev: expect.stringContaining(
            `/subjects/${subjectAddress}/policies?page[after]=1&page[size]=2`,
          ),
        },
        pageSize: 2,
        self: expect.stringContaining(
          `/subjects/${subjectAddress}/policies?page[after]=1&page[size]=2`,
        ),
        total: expect.any(Number),
      });
      expect(response1.status).toBe(200);

      // next page
      const response2 = await request(server).get(
        `/subjects/${subjectAddress}/policies?page[after]=2&page[size]=2`,
      );
      expect(response2.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining(
            `/subjects/${subjectAddress}/policies?page[after]=1&page[size]=2`,
          ),
          last: expect.stringMatching(
            /\/subjects\/0x\w*\/policies\?page\[after\]=\d*&page\[size\]=2/,
          ),
          next: expect.stringMatching(
            /\/subjects\/0x\w*\/policies\?page\[after\]=\d*&page\[size\]=2/,
          ),
          prev: expect.stringContaining(
            `/subjects/${subjectAddress}/policies?page[after]=1&page[size]=2`,
          ),
        },
        pageSize: 2,
        self: expect.stringContaining("/subjects"),
        total: expect.any(Number),
      });
      expect(response2.status).toBe(200);

      // big page
      const response3 = await request(server).get(
        `/subjects/${subjectAddress}/policies?page[after]=100&page[size]=2`,
      );
      expect(response3.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining(
            `/subjects/${subjectAddress}/policies?page[after]=1&page[size]=2`,
          ),
          last: expect.stringMatching(
            /\/subjects\/0x\w*\/policies\?page\[after\]=\d*&page\[size\]=2/,
          ),
          next: expect.stringMatching(
            /\/subjects\/0x\w*\/policies\?page\[after\]=\d*&page\[size\]=2/,
          ),
          prev: expect.stringMatching(
            /\/subjects\/0x\w*\/policies\?page\[after\]=\d*&page\[size\]=2/,
          ),
        },
        pageSize: 2,
        self: expect.stringContaining(
          `/subjects/${subjectAddress}/policies?page[after]=100&page[size]=2`,
        ),
        total: expect.any(Number),
      });
      expect(response3.status).toBe(200);

      // page after defined but page size undefined
      const response4 = await request(server).get(
        `/subjects/${subjectAddress}/policies?page[after]=1`,
      );
      expect(response4.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining(
            `/subjects/${subjectAddress}/policies?page[after]=1&page[size]=10`,
          ),
          last: expect.stringMatching(
            /\/subjects\/0x\w*\/policies\?page\[after\]=\d*&page\[size\]=10/,
          ),
          next: expect.stringMatching(
            /\/subjects\/0x\w*\/policies\?page\[after\]=\d*&page\[size\]=10/,
          ),
          prev: expect.stringContaining(
            `/subjects/${subjectAddress}/policies?page[after]=1&page[size]=10`,
          ),
        },
        pageSize: 10,
        self: expect.stringContaining("/subjects"),
        total: expect.any(Number),
      });
      expect(response4.status).toBe(200);
    });

    it("should throw a Bad Request for bad pagination", async () => {
      expect.assertions(8);

      const response1 = await request(server).get(
        `/subjects/${subjectAddress}/policies?page[size]=100`,
      );
      expect(response1.body).toStrictEqual({
        detail: '["page[size] must not be greater than 50"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response1.status).toBe(400);

      const response2 = await request(server).get(
        `/subjects/${subjectAddress}/policies?page[size]=0`,
      );
      expect(response2.body).toStrictEqual({
        detail: '["page[size] must not be less than 1"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response2.status).toBe(400);

      const response3 = await request(server).get(
        `/subjects/${subjectAddress}/policies?page[after]=0`,
      );
      expect(response3.body).toStrictEqual({
        detail: '["page[after] must not be less than 1"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response3.status).toBe(400);

      const response4 = await request(server).get(
        `/subjects/${subjectAddress}/policies?page[after]=abc`,
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
        `/subjects/${subjectAddress}/policies/DIDR:insertHashAlgorithm`,
      );

      expect(response.body).toStrictEqual({
        policyName: "DIDR:insertHashAlgorithm",
        subject: subjectAddress,
      });
      expect(response.status).toBe(200);
    });

    it("should throw an error for bad requests (invalid checksum)", async () => {
      expect.assertions(2);

      const response = await request(server).get(
        "/subjects/0x69e48d89bf5e09588E858D757323b4abBAB3f814/policies/DIDR:insertHashAlgorithm",
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
        `/subjects/${randomAddress}/policies/DIDR:insertHashAlgorithm`,
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
        `/subjects/${subjectAddress}/policies/bad-policy`,
      );

      expect(response.body).toStrictEqual({
        detail: `Subject ${subjectAddress} doesn't have the policy bad-policy`,
        status: 404,
        title: "Subject Policy Not Found",
        type: "about:blank",
      });
      expect(response.status).toBe(404);
    });
  });
});
