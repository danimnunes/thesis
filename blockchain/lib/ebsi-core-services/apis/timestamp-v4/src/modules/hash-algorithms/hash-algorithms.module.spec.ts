import type { Timestamp } from "@ebsiint-sc/timestamp-v4";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { RawServerDefault } from "fastify";

import { Timestamp__factory } from "@ebsiint-sc/timestamp-v4";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { getNestFastifyApplication } from "../../../tests/utils/app.ts";
import { setupTestEnv } from "../../../tests/utils/timestamp.ts";
import { LedgerService } from "../ledger/ledger.service.ts";
import { HashAlgorithmsModule } from "./hash-algorithms.module.ts";

const HASH_ALGORITHMS_TOTAL = 3;

describe("HashAlgorithms Module", () => {
  let app: NestFastifyApplication;
  let server: RawServerDefault;
  let timestampContract: Timestamp;
  let testEnv: Awaited<ReturnType<typeof setupTestEnv>>;

  beforeAll(async () => {
    // Spin up test blockchain (hardhat)
    testEnv = await setupTestEnv({
      hashAlgorithmsTotal: HASH_ALGORITHMS_TOTAL,
    });
    timestampContract = testEnv.timestampContract;

    // Mock Timestamp contract
    vi.spyOn(Timestamp__factory, "connect").mockImplementation(() =>
      // Create new instance without runner (provider)
      timestampContract.connect(),
    );

    // Mock LedgerService
    vi.spyOn(LedgerService.prototype, "getProvider").mockImplementation(
      // @ts-expect-error Error due to a mismatch between ESM and CommonJS modules
      () => testEnv.provider,
    );

    app = await getNestFastifyApplication({
      imports: [HashAlgorithmsModule],
    });

    await app.init();
    const fastifyInstance = app.getHttpAdapter().getInstance();
    await fastifyInstance.ready();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /hash-algorithms", () => {
    it("should return a paginated collection of hash-algorithms", async () => {
      expect.assertions(3);

      const response = await request(server).get("/hash-algorithms");

      expect(response.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining(
            "/hash-algorithms?page[after]=1&page[size]=10",
          ),
          last: expect.stringContaining(
            "/hash-algorithms?page[after]=1&page[size]=10",
          ),
          next: expect.stringContaining(
            "/hash-algorithms?page[after]=1&page[size]=10",
          ),
          prev: expect.stringContaining(
            "/hash-algorithms?page[after]=1&page[size]=10",
          ),
        },
        pageSize: 10,
        self: expect.stringContaining(
          "/hash-algorithms?page[after]=1&page[size]=10",
        ),
        total: HASH_ALGORITHMS_TOTAL,
      });
      expect((response.body as { items: string }).items).toHaveLength(3);
      expect(response.status).toBe(200);
    });

    it("should handle the pagination properly", async () => {
      expect.assertions(12);

      const response1 = await request(server).get(
        "/hash-algorithms?page[size]=2",
      );
      expect(response1.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining(
            "/hash-algorithms?page[after]=1&page[size]=2",
          ),
          last: expect.stringContaining(
            "/hash-algorithms?page[after]=2&page[size]=2",
          ),
          next: expect.stringContaining(
            "/hash-algorithms?page[after]=2&page[size]=2",
          ),
          prev: expect.stringContaining(
            "/hash-algorithms?page[after]=1&page[size]=2",
          ),
        },
        pageSize: 2,
        self: expect.stringContaining(
          "/hash-algorithms?page[after]=1&page[size]=2",
        ),
        total: HASH_ALGORITHMS_TOTAL,
      });
      expect((response1.body as { items: string }).items).toHaveLength(2);
      expect(response1.status).toBe(200);

      // next page
      const response2 = await request(server).get(
        "/hash-algorithms?page[after]=2&page[size]=2",
      );
      expect(response2.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining(
            "/hash-algorithms?page[after]=1&page[size]=2",
          ),
          last: expect.stringContaining(
            "/hash-algorithms?page[after]=2&page[size]=2",
          ),
          next: expect.stringContaining(
            "/hash-algorithms?page[after]=2&page[size]=2",
          ),
          prev: expect.stringContaining(
            "/hash-algorithms?page[after]=1&page[size]=2",
          ),
        },
        pageSize: 2,
        self: expect.stringContaining(
          "/hash-algorithms?page[after]=2&page[size]=2",
        ),
        total: HASH_ALGORITHMS_TOTAL,
      });
      expect((response2.body as { items: string }).items).toHaveLength(1);
      expect(response2.status).toBe(200);

      // big page
      const response3 = await request(server).get(
        "/hash-algorithms?page[after]=100&page[size]=2",
      );
      expect(response3.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining(
            "/hash-algorithms?page[after]=1&page[size]=2",
          ),
          last: expect.stringContaining(
            "/hash-algorithms?page[after]=2&page[size]=2",
          ),
          next: expect.stringContaining(
            "/hash-algorithms?page[after]=2&page[size]=2",
          ),
          prev: expect.stringContaining(
            "/hash-algorithms?page[after]=2&page[size]=2",
          ),
        },
        pageSize: 2,
        self: expect.stringContaining(
          "/hash-algorithms?page[after]=100&page[size]=2",
        ),
        total: HASH_ALGORITHMS_TOTAL,
      });
      expect((response3.body as { items: string }).items).toHaveLength(0);
      expect(response3.status).toBe(200);

      // page["after"] defined but page["size"] undefined
      const response4 = await request(server).get(
        "/hash-algorithms?page[after]=1",
      );
      expect(response4.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining(
            "/hash-algorithms?page[after]=1&page[size]=10",
          ),
          last: expect.stringContaining(
            "/hash-algorithms?page[after]=1&page[size]=10",
          ),
          next: expect.stringContaining(
            "/hash-algorithms?page[after]=1&page[size]=10",
          ),
          prev: expect.stringContaining(
            "/hash-algorithms?page[after]=1&page[size]=10",
          ),
        },
        pageSize: 10,
        self: expect.stringContaining(
          "/hash-algorithms?page[after]=1&page[size]=10",
        ),
        total: HASH_ALGORITHMS_TOTAL,
      });
      expect((response4.body as { items: string }).items).toHaveLength(3);
      expect(response4.status).toBe(200);
    });

    it("should throw a Bad Request for bad pagination", async () => {
      expect.assertions(8);

      const response1 = await request(server).get(
        "/hash-algorithms?page[size]=100",
      );
      expect(response1.body).toStrictEqual({
        detail: '["page[size] must not be greater than 50"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response1.status).toBe(400);

      const response2 = await request(server).get(
        "/hash-algorithms?page[size]=0",
      );
      expect(response2.body).toStrictEqual({
        detail: '["page[size] must not be less than 1"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response2.status).toBe(400);

      const response3 = await request(server).get(
        "/hash-algorithms?page[after]=0",
      );
      expect(response3.body).toStrictEqual({
        detail: '["page[after] must not be less than 1"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response3.status).toBe(400);

      const response4 = await request(server).get(
        "/hash-algorithms?page[after]=abc",
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
  });

  describe("GET /hash-algorithms/{hashAlgorithmId}", () => {
    it("should return a specific hash algorithm", async () => {
      expect.assertions(2);

      const response = await request(server).get("/hash-algorithms/0");

      const firstHashAlgorithm = testEnv.hashAlgorithms[0]!;

      expect(response.body).toStrictEqual({
        ianaName: firstHashAlgorithm.ianaName,
        multihash: firstHashAlgorithm.multihash,
        oid: firstHashAlgorithm.oid,
        outputLengthBits: firstHashAlgorithm.outputLength,
        status: "active",
      });
      expect(response.status).toBe(200);
    });

    it("should throw an error if the hash algorithm is not found", async () => {
      expect.assertions(2);

      const hashAlgorithmId = "1234567890";

      const response = await request(server).get(
        `/hash-algorithms/${hashAlgorithmId}`,
      );

      expect(response.body).toStrictEqual({
        detail: `Hash algorithm ${hashAlgorithmId} not found`,
        status: 404,
        title: "Hash algorithm Not Found",
        type: "about:blank",
      });
      expect(response.status).toBe(404);
    });
  });
});
