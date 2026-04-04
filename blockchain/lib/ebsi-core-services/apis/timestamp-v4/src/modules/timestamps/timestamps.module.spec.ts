import type { Timestamp } from "@ebsiint-sc/timestamp-v4";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { RawServerDefault } from "fastify";

import { multibase, multihashEncode } from "@ebsiint-api/shared";
import { Timestamp__factory } from "@ebsiint-sc/timestamp-v4";
import { ethers } from "ethers";
import crypto from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { TimestampLink } from "./timestamps.interface.ts";

import { getNestFastifyApplication } from "../../../tests/utils/app.ts";
import { insertHash, setupTestEnv } from "../../../tests/utils/timestamp.ts";
import { LedgerService } from "../ledger/ledger.service.ts";
import { TimestampsModule } from "./timestamps.module.ts";

const HASHES_TOTAL = 3;

describe("Timestamps Module", () => {
  let app: NestFastifyApplication;
  let server: RawServerDefault;
  let timestampContract: Timestamp;
  let testEnv: Awaited<ReturnType<typeof setupTestEnv>>;

  beforeAll(async () => {
    // Spin up test blockchain (hardhat)
    testEnv = await setupTestEnv({
      hashesTotal: HASHES_TOTAL,
      recordsTotal: 0,
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
      imports: [TimestampsModule],
    });

    await app.init();
    const fastifyInstance = app.getHttpAdapter().getInstance();
    await fastifyInstance.ready();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /timestamps", () => {
    it("should return a paginated collection of timestamps", async () => {
      expect.assertions(3);

      const response = await request(server).get("/timestamps");
      expect(response.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining(
            "/timestamps?page[after]=1&page[size]=10",
          ),
          last: expect.stringContaining(
            "/timestamps?page[after]=1&page[size]=10",
          ),
          next: expect.stringContaining(
            "/timestamps?page[after]=1&page[size]=10",
          ),
          prev: expect.stringContaining(
            "/timestamps?page[after]=1&page[size]=10",
          ),
        },
        pageSize: 10,
        self: expect.stringContaining(
          "/timestamps?page[after]=1&page[size]=10",
        ),
        total: HASHES_TOTAL,
      });
      expect((response.body as { items: string }).items).toHaveLength(3);
      expect(response.status).toBe(200);
    });

    it("should handle the pagination properly", async () => {
      expect.assertions(12);

      const response1 = await request(server).get("/timestamps?page[size]=2");
      expect(response1.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining(
            "/timestamps?page[after]=1&page[size]=2",
          ),
          last: expect.stringContaining(
            "/timestamps?page[after]=2&page[size]=2",
          ),
          next: expect.stringContaining(
            "/timestamps?page[after]=2&page[size]=2",
          ),
          prev: expect.stringContaining(
            "/timestamps?page[after]=1&page[size]=2",
          ),
        },
        pageSize: 2,
        self: expect.stringContaining("/timestamps?page[after]=1&page[size]=2"),
        total: HASHES_TOTAL,
      });
      expect((response1.body as { items: string }).items).toHaveLength(2);
      expect(response1.status).toBe(200);

      // next page
      const response2 = await request(server).get(
        "/timestamps?page[after]=2&page[size]=2",
      );
      expect(response2.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining(
            "/timestamps?page[after]=1&page[size]=2",
          ),
          last: expect.stringContaining(
            "/timestamps?page[after]=2&page[size]=2",
          ),
          next: expect.stringContaining(
            "/timestamps?page[after]=2&page[size]=2",
          ),
          prev: expect.stringContaining(
            "/timestamps?page[after]=1&page[size]=2",
          ),
        },
        pageSize: 2,
        self: expect.stringContaining("/timestamps?page[after]=2&page[size]=2"),
        total: HASHES_TOTAL,
      });
      expect((response2.body as { items: string }).items).toHaveLength(1);
      expect(response2.status).toBe(200);

      // big page
      const response3 = await request(server).get(
        "/timestamps?page[after]=100&page[size]=2",
      );
      expect(response3.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining(
            "/timestamps?page[after]=1&page[size]=2",
          ),
          last: expect.stringContaining(
            "/timestamps?page[after]=2&page[size]=2",
          ),
          next: expect.stringContaining(
            "/timestamps?page[after]=2&page[size]=2",
          ),
          prev: expect.stringContaining(
            "/timestamps?page[after]=2&page[size]=2",
          ),
        },
        pageSize: 2,
        self: expect.stringContaining(
          "/timestamps?page[after]=100&page[size]=2",
        ),
        total: HASHES_TOTAL,
      });
      expect((response3.body as { items: string }).items).toHaveLength(0);
      expect(response3.status).toBe(200);

      // page["after"] defined but page["size"] undefined
      const response4 = await request(server).get("/timestamps?page[after]=1");
      expect(response4.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining(
            "/timestamps?page[after]=1&page[size]=10",
          ),
          last: expect.stringContaining(
            "/timestamps?page[after]=1&page[size]=10",
          ),
          next: expect.stringContaining(
            "/timestamps?page[after]=1&page[size]=10",
          ),
          prev: expect.stringContaining(
            "/timestamps?page[after]=1&page[size]=10",
          ),
        },
        pageSize: 10,
        self: expect.stringContaining(
          "/timestamps?page[after]=1&page[size]=10",
        ),
        total: HASHES_TOTAL,
      });
      expect((response4.body as { items: string }).items).toHaveLength(3);
      expect(response4.status).toBe(200);
    });

    it("should throw a Bad Request for bad pagination", async () => {
      expect.assertions(8);

      const response1 = await request(server).get("/timestamps?page[size]=100");
      expect(response1.body).toStrictEqual({
        detail: '["page[size] must not be greater than 50"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response1.status).toBe(400);

      const response2 = await request(server).get("/timestamps?page[size]=0");
      expect(response2.body).toStrictEqual({
        detail: '["page[size] must not be less than 1"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response2.status).toBe(400);

      const response3 = await request(server).get("/timestamps?page[after]=0");
      expect(response3.body).toStrictEqual({
        detail: '["page[after] must not be less than 1"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response3.status).toBe(400);

      const response4 = await request(server).get(
        "/timestamps?page[after]=abc",
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

    it("should reject a non whitelisted query", async () => {
      expect.assertions(2);

      const response = await request(server).get(
        "/timestamps?invalid-query=abc",
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

  describe("GET /timestamps/{timestampId}", () => {
    it("should return a specific timestamp (1)", async () => {
      // Test when we already know some info about the timestamp
      expect.assertions(2);

      const { hashAlgorithms, hashes } = testEnv;
      const hash = hashes[0]!;
      const hashValue = hash.hashValues[0]!;
      const timestampId = multibase.base64url.encode(
        multihashEncode(
          ethers.sha256(hashValue).replace(/^0x/, ""),
          "sha2-256",
          32,
        ),
      );

      const response = await request(server).get(`/timestamps/${timestampId}`);

      // multi-hash (base64 multi-encoded)
      const multihashEncodedHash = multibase.base64.encode(
        multihashEncode(
          hashValue,
          hashAlgorithms[0]!.multihash,
          hashAlgorithms[0]!.outputLength / 8,
        ),
      );

      expect(response.body).toStrictEqual({
        blockNumber: expect.any(Number),
        data: hash.timestampData[0],
        hash: multihashEncodedHash,
        timestamp: expect.any(String),
        timestampedBy: expect.stringContaining("0x"),
        transactionHash: expect.stringContaining("0x"),
      });
      expect(response.status).toBe(200);
    });

    it("should return a specific timestamp (2)", async () => {
      // Test when we don't know the timestamp (will just check the first one)
      expect.assertions(2);

      const respTimestamps = await request(server).get("/timestamps");

      const { timestampId } = (
        respTimestamps.body as {
          items: TimestampLink[];
        }
      ).items[0]!;

      const response = await request(server).get(`/timestamps/${timestampId}`);

      expect(response.body).toStrictEqual({
        blockNumber: expect.any(Number),
        data: expect.stringContaining("0x"),
        hash: expect.any(String),
        timestamp: expect.any(String),
        timestampedBy: expect.stringContaining("0x"),
        transactionHash: expect.stringContaining("0x"),
      });
      expect(response.status).toBe(200);
    });

    it("should return a specific timestamp when there are many transactions in the same block", async () => {
      expect.assertions(5);

      // Disable auto mine
      await testEnv.provider.send("evm_setAutomine", [false]);

      // Send multiple tx
      const hash1 = await insertHash(
        testEnv.timestampContract,
        testEnv.hashAlgorithms[0]!,
      );
      const hash2 = await insertHash(
        testEnv.timestampContract,
        testEnv.hashAlgorithms[0]!,
      );
      const hash3 = await insertHash(
        testEnv.timestampContract,
        testEnv.hashAlgorithms[0]!,
      );

      // Mine block
      await testEnv.provider.send("evm_mine", []);
      await testEnv.provider.send("evm_setAutomine", [true]);

      // Get block numbers
      const tx1 = await testEnv.provider.getTransaction(hash1.tx.hash);
      const tx2 = await testEnv.provider.getTransaction(hash2.tx.hash);
      const tx3 = await testEnv.provider.getTransaction(hash3.tx.hash);

      if (!tx1 || !tx2 || !tx3) {
        throw new Error("Failed to get transaction");
      }

      const { blockNumber: blockNumberTx1 } = tx1;
      const { blockNumber: blockNumberTx2 } = tx2;
      const { blockNumber: blockNumberTx3 } = tx3;

      // Make sure all the transactions are in the same block
      expect(blockNumberTx1).not.toBeNull();
      expect(blockNumberTx1).toStrictEqual(blockNumberTx2);
      expect(blockNumberTx2).toStrictEqual(blockNumberTx3);

      // Get second hash data
      const timestampId = multibase.base64url.encode(
        multihashEncode(
          ethers.sha256(hash2.hashValues[0]!).replace(/^0x/, ""),
          "sha2-256",
          32,
        ),
      );

      const response = await request(server).get(`/timestamps/${timestampId}`);

      // Verify response (especially "transactionHash")
      const signer = await testEnv.provider.getSigner();
      expect(response.body).toStrictEqual({
        blockNumber: blockNumberTx1,
        data: hash2.timestampData[0],
        hash: multibase.base64.encode(
          multihashEncode(
            hash2.hashValues[0]!,
            testEnv.hashAlgorithms[0]!.multihash,
          ),
        ),
        timestamp: expect.any(String),
        timestampedBy: await signer.getAddress(),
        transactionHash: hash2.tx.hash,
      });
      expect(response.status).toBe(200);
    });

    it("should throw an error if the timestamp ID is not a valid multibase64url value", async () => {
      expect.assertions(2);

      const timestampId = `0x${crypto.randomBytes(32).toString("hex")}`;

      const response = await request(server).get(`/timestamps/${timestampId}`);

      expect(response.body).toStrictEqual({
        detail: '["timestampId must be multihash encoded in multi-base64url"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
    });

    it("should throw an error if the timestamp is not found", async () => {
      expect.assertions(2);

      const timestampId = multibase.base64url.encode(
        multihashEncode(crypto.randomBytes(32).toString("hex"), "sha2-256", 32),
      );

      const response = await request(server).get(`/timestamps/${timestampId}`);

      expect(response.body).toStrictEqual({
        detail: `Timestamp ${timestampId} not found`,
        status: 404,
        title: "Timestamp Not Found",
        type: "about:blank",
      });
      expect(response.status).toBe(404);
    });
  });
});
