import type { Timestamp } from "@ebsiint-sc/timestamp-v4";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { RawServerDefault } from "fastify";

import { multibase } from "@ebsiint-api/shared";
import { Timestamp__factory } from "@ebsiint-sc/timestamp-v4";
import crypto from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { RecordLink } from "./records.interface.ts";

import { getNestFastifyApplication } from "../../../tests/utils/app.ts";
import { setupTestEnv } from "../../../tests/utils/timestamp.ts";
import { LedgerService } from "../ledger/ledger.service.ts";
import { RecordsModule } from "./records.module.ts";

const RECORDS_TOTAL = 3;

describe("Records Module", () => {
  let app: NestFastifyApplication;
  let server: RawServerDefault;
  let timestampContract: Timestamp;
  let testEnv: Awaited<ReturnType<typeof setupTestEnv>>;
  let sender: string;

  const getFirstRecordId = async () => {
    const respRecords = await request(server).get("/records");
    const { recordId } = (respRecords.body as { items: RecordLink[] })
      .items[0]!;
    return recordId;
  };

  beforeAll(async () => {
    // Spin up test blockchain (hardhat)
    testEnv = await setupTestEnv({
      recordsTotal: RECORDS_TOTAL,
    });
    timestampContract = testEnv.timestampContract;
    sender = testEnv.sender;

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
      imports: [RecordsModule],
    });

    await app.init();
    const fastifyInstance = app.getHttpAdapter().getInstance();
    await fastifyInstance.ready();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /records", () => {
    describe.each([() => "/records", () => `/records?owner=${sender}`])(
      "GET %s",
      (url: () => string) => {
        it("should return a paginated collection of records", async () => {
          expect.assertions(3);

          const response = await request(server).get(url());
          expect(response.body).toStrictEqual({
            items: expect.arrayContaining([]),
            links: {
              first: expect.stringContaining(
                "/records?page[after]=1&page[size]=10",
              ),
              last: expect.stringContaining(
                "/records?page[after]=1&page[size]=10",
              ),
              next: expect.stringContaining(
                "/records?page[after]=1&page[size]=10",
              ),
              prev: expect.stringContaining(
                "/records?page[after]=1&page[size]=10",
              ),
            },
            pageSize: 10,
            self: expect.stringContaining(
              "/records?page[after]=1&page[size]=10",
            ),
            total: RECORDS_TOTAL,
          });
          expect((response.body as { items: string }).items).toHaveLength(
            RECORDS_TOTAL,
          );
          expect(response.status).toBe(200);
        });
      },
    );

    it("should handle the pagination properly", async () => {
      expect.assertions(12);

      const response1 = await request(server).get("/records?page[size]=2");
      expect(response1.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining("/records?page[after]=1&page[size]=2"),
          last: expect.stringContaining("/records?page[after]=2&page[size]=2"),
          next: expect.stringContaining("/records?page[after]=2&page[size]=2"),
          prev: expect.stringContaining("/records?page[after]=1&page[size]=2"),
        },
        pageSize: 2,
        self: expect.stringContaining("/records?page[after]=1&page[size]=2"),
        total: RECORDS_TOTAL,
      });
      expect((response1.body as { items: string }).items).toHaveLength(2);
      expect(response1.status).toBe(200);

      // next page
      const response2 = await request(server).get(
        "/records?page[after]=2&page[size]=2",
      );
      expect(response2.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining("/records?page[after]=1&page[size]=2"),
          last: expect.stringContaining("/records?page[after]=2&page[size]=2"),
          next: expect.stringContaining("/records?page[after]=2&page[size]=2"),
          prev: expect.stringContaining("/records?page[after]=1&page[size]=2"),
        },
        pageSize: 2,
        self: expect.stringContaining("/records?page[after]=2&page[size]=2"),
        total: RECORDS_TOTAL,
      });
      expect((response2.body as { items: string }).items).toHaveLength(1);
      expect(response2.status).toBe(200);

      // big page
      const response3 = await request(server).get(
        "/records?page[after]=100&page[size]=2",
      );
      expect(response3.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining("/records?page[after]=1&page[size]=2"),
          last: expect.stringContaining("/records?page[after]=2&page[size]=2"),
          next: expect.stringContaining("/records?page[after]=2&page[size]=2"),
          prev: expect.stringContaining("/records?page[after]=2&page[size]=2"),
        },
        pageSize: 2,
        self: expect.stringContaining("/records?page[after]=100&page[size]=2"),
        total: RECORDS_TOTAL,
      });
      expect((response3.body as { items: string }).items).toHaveLength(0);
      expect(response3.status).toBe(200);

      // page["after"] defined but page["size"] undefined
      const response4 = await request(server).get("/records?page[after]=1");
      expect(response4.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining(
            "/records?page[after]=1&page[size]=10",
          ),
          last: expect.stringContaining("/records?page[after]=1&page[size]=10"),
          next: expect.stringContaining("/records?page[after]=1&page[size]=10"),
          prev: expect.stringContaining("/records?page[after]=1&page[size]=10"),
        },
        pageSize: 10,
        self: expect.stringContaining("/records?page[after]=1&page[size]=10"),
        total: RECORDS_TOTAL,
      });
      expect((response4.body as { items: string }).items).toHaveLength(3);
      expect(response4.status).toBe(200);
    });

    it("should throw a Bad Request for bad pagination", async () => {
      expect.assertions(8);

      const response1 = await request(server).get("/records?page[size]=100");
      expect(response1.body).toStrictEqual({
        detail: '["page[size] must not be greater than 50"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response1.status).toBe(400);

      const response2 = await request(server).get("/records?page[size]=0");
      expect(response2.body).toStrictEqual({
        detail: '["page[size] must not be less than 1"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response2.status).toBe(400);

      const response3 = await request(server).get("/records?page[after]=0");
      expect(response3.body).toStrictEqual({
        detail: '["page[after] must not be less than 1"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response3.status).toBe(400);

      const response4 = await request(server).get("/records?page[after]=abc");
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

  describe("GET /records/{recordId}", () => {
    it("should return a specific record", async () => {
      expect.assertions(2);

      const respRecords = await request(server).get("/records");

      const { recordId } = (
        respRecords.body as {
          items: RecordLink[];
        }
      ).items[0]!;

      const response = await request(server).get(`/records/${recordId}`);

      expect(response.body).toStrictEqual({
        firstVersionTimestamps: expect.arrayContaining([]),
        lastVersionTimestamps: expect.arrayContaining([]),
        ownerIds: expect.arrayContaining([]),
        revokedOwnerIds: expect.arrayContaining([]),
        totalVersions: 1,
      });
      expect(response.status).toBe(200);
    });

    it("should throw an error if the record is not found", async () => {
      expect.assertions(2);

      const recordId = multibase.base64url.encode(crypto.randomBytes(32));

      const response = await request(server).get(`/records/${recordId}`);

      expect(response.body).toStrictEqual({
        detail: `Record ${recordId} not found`,
        status: 404,
        title: "Record Not Found",
        type: "about:blank",
      });
      expect(response.status).toBe(404);
    });

    it("should throw an error if the record id is not a valid multibase64url value", async () => {
      expect.assertions(2);

      const recordId = `0x${crypto.randomBytes(32).toString("hex")}`;

      const response = await request(server).get(`/records/${recordId}`);

      expect(response.body).toStrictEqual({
        detail: '["recordId must be multi-base64url encoded"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
    });
  });

  describe("GET /records/{recordId}/versions", () => {
    it("should return a paginated collection of versions", async () => {
      expect.assertions(3);

      const recordId = await getFirstRecordId();

      const response = await request(server).get(
        `/records/${recordId}/versions`,
      );
      expect(response.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining(
            `/records/${recordId}/versions?page[after]=1&page[size]=10`,
          ),
          last: expect.stringContaining(
            `/records/${recordId}/versions?page[after]=1&page[size]=10`,
          ),
          next: expect.stringContaining(
            `/records/${recordId}/versions?page[after]=1&page[size]=10`,
          ),
          prev: expect.stringContaining(
            `/records/${recordId}/versions?page[after]=1&page[size]=10`,
          ),
        },
        pageSize: 10,
        self: expect.stringContaining(
          `/records/${recordId}/versions?page[after]=1&page[size]=10`,
        ),
        total: 1,
      });
      expect((response.body as { items: string[] }).items).toHaveLength(1);
      expect(response.status).toBe(200);
    });

    it("should handle the pagination properly", async () => {
      expect.assertions(12);

      const recordId = await getFirstRecordId();

      const response1 = await request(server).get(
        `/records/${recordId}/versions?page[size]=2`,
      );
      expect(response1.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining(
            `/records/${recordId}/versions?page[after]=1&page[size]=2`,
          ),
          last: expect.stringContaining(
            `/records/${recordId}/versions?page[after]=1&page[size]=2`,
          ),
          next: expect.stringContaining(
            `/records/${recordId}/versions?page[after]=1&page[size]=2`,
          ),
          prev: expect.stringContaining(
            `/records/${recordId}/versions?page[after]=1&page[size]=2`,
          ),
        },
        pageSize: 2,
        self: expect.stringContaining(
          `/records/${recordId}/versions?page[after]=1&page[size]=2`,
        ),
        total: 1,
      });
      expect((response1.body as { items: string }).items).toHaveLength(1);
      expect(response1.status).toBe(200);

      // next page
      const response2 = await request(server).get(
        `/records/${recordId}/versions?page[after]=2&page[size]=2`,
      );
      expect(response2.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining(
            `/records/${recordId}/versions?page[after]=1&page[size]=2`,
          ),
          last: expect.stringContaining(
            `/records/${recordId}/versions?page[after]=1&page[size]=2`,
          ),
          next: expect.stringContaining(
            `/records/${recordId}/versions?page[after]=1&page[size]=2`,
          ),
          prev: expect.stringContaining(
            `/records/${recordId}/versions?page[after]=1&page[size]=2`,
          ),
        },
        pageSize: 2,
        self: expect.stringContaining(
          `/records/${recordId}/versions?page[after]=2&page[size]=2`,
        ),
        total: 1,
      });
      expect((response2.body as { items: string }).items).toHaveLength(0);
      expect(response2.status).toBe(200);

      // big page
      const response3 = await request(server).get(
        `/records/${recordId}/versions?page[after]=100&page[size]=2`,
      );
      expect(response3.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining(
            `/records/${recordId}/versions?page[after]=1&page[size]=2`,
          ),
          last: expect.stringContaining(
            `/records/${recordId}/versions?page[after]=1&page[size]=2`,
          ),
          next: expect.stringContaining(
            `/records/${recordId}/versions?page[after]=1&page[size]=2`,
          ),
          prev: expect.stringContaining(
            `/records/${recordId}/versions?page[after]=1&page[size]=2`,
          ),
        },
        pageSize: 2,
        self: expect.stringContaining(
          `/records/${recordId}/versions?page[after]=100&page[size]=2`,
        ),
        total: 1,
      });
      expect((response3.body as { items: string }).items).toHaveLength(0);
      expect(response3.status).toBe(200);

      // page["after"] defined but page["size"] undefined
      const response4 = await request(server).get(
        `/records/${recordId}/versions?page[after]=1`,
      );
      expect(response4.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining(
            `/records/${recordId}/versions?page[after]=1&page[size]=10`,
          ),
          last: expect.stringContaining(
            `/records/${recordId}/versions?page[after]=1&page[size]=10`,
          ),
          next: expect.stringContaining(
            `/records/${recordId}/versions?page[after]=1&page[size]=10`,
          ),
          prev: expect.stringContaining(
            `/records/${recordId}/versions?page[after]=1&page[size]=10`,
          ),
        },
        pageSize: 10,
        self: expect.stringContaining(
          `/records/${recordId}/versions?page[after]=1&page[size]=10`,
        ),
        total: 1,
      });
      expect((response4.body as { items: string }).items).toHaveLength(1);
      expect(response4.status).toBe(200);
    });
  });

  describe("GET /records/{recordId}/versions/{versionId}", () => {
    it("should return a specific version", async () => {
      expect.assertions(2);

      const recordId = await getFirstRecordId();

      const response = await request(server).get(
        `/records/${recordId}/versions/0`,
      );

      expect(response.body).toStrictEqual({
        hashes: expect.arrayContaining([]),
        info: expect.arrayContaining([]),
      });
      expect(response.status).toBe(200);
    });

    it("should throw an error if the record is not found", async () => {
      expect.assertions(2);

      const randomRecordId = multibase.base64url.encode(crypto.randomBytes(32));
      const versionId = 800;

      const response = await request(server).get(
        `/records/${randomRecordId}/versions/${versionId}`,
      );

      expect(response.body).toStrictEqual({
        detail: `Record ${randomRecordId} not found`,
        status: 404,
        title: "Record Not Found",
        type: "about:blank",
      });
      expect(response.status).toBe(404);
    });

    it("should throw an error if the version is not found", async () => {
      expect.assertions(2);

      const recordId = await getFirstRecordId();
      const versionId = 800;

      const response = await request(server).get(
        `/records/${recordId}/versions/${versionId}`,
      );

      expect(response.body).toStrictEqual({
        detail: `Version ${versionId} not found`,
        status: 404,
        title: "Version Not Found",
        type: "about:blank",
      });
      expect(response.status).toBe(404);
    });
  });
});
