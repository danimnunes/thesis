import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { RawServerDefault } from "fastify";

import { SchemaSCRegistry__factory } from "@ebsiint-sc/trusted-schemas-registry-v3";
import { ethers } from "ethers";
import crypto from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { getNestFastifyApplication } from "../../../tests/utils/app.ts";
import { setupTestEnv } from "../../../tests/utils/schemaRegistry.ts";
import { LedgerService } from "../ledger/ledger.service.ts";
import { SchemasModule } from "./schemas.module.ts";
import { hexToMultibaseBase58Btc } from "./schemas.utils.ts";

const SCHEMAS_TOTAL = 3;
const SCHEMA_REVISIONS_TOTAL = 3;
const SCHEMA_METADATA_TOTAL = 3;

describe("Schemas Module", () => {
  let app: NestFastifyApplication;
  let server: RawServerDefault;
  let testEnv: Awaited<ReturnType<typeof setupTestEnv>>;

  beforeAll(async () => {
    // Spin up test blockchain
    testEnv = await setupTestEnv("fixed", {
      schemaMetadataTotal: SCHEMA_METADATA_TOTAL,
      schemaRevisionsTotal: SCHEMA_REVISIONS_TOTAL,
      schemasTotal: SCHEMAS_TOTAL,
    });

    // Mock contract
    vi.spyOn(SchemaSCRegistry__factory, "connect").mockImplementation(
      // Create new instance without runner (provider)
      () => testEnv.schemasRegistryContract.connect(),
    );

    // Mock LedgerService
    vi.spyOn(LedgerService.prototype, "getProvider").mockImplementation(
      // @ts-expect-error Error due to a mismatch between ESM and CommonJS modules
      () => testEnv.provider,
    );

    app = await getNestFastifyApplication({ imports: [SchemasModule] });

    await app.init();
    const fastifyInstance = app.getHttpAdapter().getInstance();
    await fastifyInstance.ready();

    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /schemas", () => {
    it("should return a paginated collection of schemas", async () => {
      expect.assertions(3);

      const response = await request(server).get("/schemas");

      expect(response.body).toStrictEqual({
        items: expect.arrayContaining(
          testEnv.schemas.map((schema) => {
            const schemaId = hexToMultibaseBase58Btc(schema.schemaId);
            return {
              href: expect.stringContaining(`/schemas/${schemaId}`),
              schemaId,
            };
          }),
        ),
        links: {
          first: expect.stringContaining(
            "/schemas?page[after]=1&page[size]=10",
          ),
          last: expect.stringContaining("/schemas?page[after]=1&page[size]=10"),
          next: expect.stringContaining("/schemas?page[after]=1&page[size]=10"),
          prev: expect.stringContaining("/schemas?page[after]=1&page[size]=10"),
        },
        pageSize: 10,
        self: expect.stringContaining("/schemas?page[after]=1&page[size]=10"),
        total: SCHEMAS_TOTAL,
      });
      expect((response.body as { items: string }).items).toHaveLength(
        SCHEMAS_TOTAL,
      );
      expect(response.status).toBe(200);
    });

    it("should handle the pagination properly", async () => {
      expect.assertions(12);

      const response1 = await request(server).get("/schemas?page[size]=2");
      expect(response1.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining("/schemas?page[after]=1&page[size]=2"),
          last: expect.stringContaining("/schemas?page[after]=2&page[size]=2"),
          next: expect.stringContaining("/schemas?page[after]=2&page[size]=2"),
          prev: expect.stringContaining("/schemas?page[after]=1&page[size]=2"),
        },
        pageSize: 2,
        self: expect.stringContaining("/schemas?page[after]=1&page[size]=2"),
        total: SCHEMAS_TOTAL,
      });
      expect((response1.body as { items: string }).items).toHaveLength(2);
      expect(response1.status).toBe(200);

      // next page
      const response2 = await request(server).get(
        "/schemas?page[after]=2&page[size]=2",
      );
      expect(response2.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining("/schemas?page[after]=1&page[size]=2"),
          last: expect.stringContaining("/schemas?page[after]=2&page[size]=2"),
          next: expect.stringContaining("/schemas?page[after]=2&page[size]=2"),
          prev: expect.stringContaining("/schemas?page[after]=1&page[size]=2"),
        },
        pageSize: 2,
        self: expect.stringContaining("/schemas?page[after]=2&page[size]=2"),
        total: SCHEMAS_TOTAL,
      });
      expect((response2.body as { items: string }).items).toHaveLength(1);
      expect(response2.status).toBe(200);

      // big page
      const response3 = await request(server).get(
        "/schemas?page[after]=100&page[size]=2",
      );
      expect(response3.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining("/schemas?page[after]=1&page[size]=2"),
          last: expect.stringContaining("/schemas?page[after]=2&page[size]=2"),
          next: expect.stringContaining("/schemas?page[after]=2&page[size]=2"),
          prev: expect.stringContaining("/schemas?page[after]=2&page[size]=2"),
        },
        pageSize: 2,
        self: expect.stringContaining("/schemas?page[after]=100&page[size]=2"),
        total: SCHEMAS_TOTAL,
      });
      expect((response3.body as { items: string }).items).toHaveLength(0);
      expect(response3.status).toBe(200);

      // page["after"] defined but page["size"] undefined
      const response4 = await request(server).get("/schemas?page[after]=1");
      expect(response4.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining(
            "/schemas?page[after]=1&page[size]=10",
          ),
          last: expect.stringContaining("/schemas?page[after]=1&page[size]=10"),
          next: expect.stringContaining("/schemas?page[after]=1&page[size]=10"),
          prev: expect.stringContaining("/schemas?page[after]=1&page[size]=10"),
        },
        pageSize: 10,
        self: expect.stringContaining("/schemas?page[after]=1&page[size]=10"),
        total: SCHEMAS_TOTAL,
      });
      expect((response4.body as { items: string }).items).toHaveLength(
        SCHEMAS_TOTAL,
      );
      expect(response4.status).toBe(200);
    });

    it("should throw a Bad Request for bad pagination", async () => {
      expect.assertions(12);

      const response1 = await request(server).get("/schemas?page[size]=100");
      expect(response1.body).toStrictEqual({
        detail: '["page[size] must not be greater than 50"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response1.status).toBe(400);
      expect(
        (response1.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));

      const response2 = await request(server).get("/schemas?page[size]=0");
      expect(response2.body).toStrictEqual({
        detail: '["page[size] must not be less than 1"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response2.status).toBe(400);
      expect(
        (response2.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));

      const response3 = await request(server).get("/schemas?page[after]=0");
      expect(response3.body).toStrictEqual({
        detail: '["page[after] must not be less than 1"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response3.status).toBe(400);
      expect(
        (response3.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));

      const response4 = await request(server).get("/schemas?page[after]=abc");
      expect(response4.body).toStrictEqual({
        detail:
          '["page[after] must not be less than 1","page[after] must be a number conforming to the specified constraints"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response4.status).toBe(400);
      expect(
        (response4.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));
    });

    it("should reject a non whitelisted query", async () => {
      expect.assertions(2);

      const response = await request(server).get("/schemas?invalid-query=abc");

      expect(response.body).toStrictEqual({
        detail: '["property invalid-query should not exist"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
    });
  });

  describe("GET /schemas/{schemaId}", () => {
    it("should throw an error if the schema ID is not hexadecimal or multibase base58btc", async () => {
      expect.assertions(3);

      const response = await request(server).get("/schemas/no-schema");

      expect(response.body).toStrictEqual({
        detail: '["schemaId must be a valid schema ID"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));
    });

    it("should throw an error if the multibase base58btc schema ID is not 32 bytes long", async () => {
      expect.assertions(3);

      const schemaId = hexToMultibaseBase58Btc(
        crypto.randomBytes(24).toString("hex"),
      );

      const response = await request(server).get(`/schemas/${schemaId}`);

      expect(response.body).toStrictEqual({
        detail: '["schemaId must be a valid schema ID"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));
    });

    it("should throw an error if the schema is not found", async () => {
      expect.assertions(3);

      const schemaId = `0x${crypto.randomBytes(32).toString("hex")}`;
      const response = await request(server).get(`/schemas/${schemaId}`);

      expect(response.body).toStrictEqual({
        detail: `Schema ${schemaId} not found`,
        status: 404,
        title: "Schema Not Found",
        type: "about:blank",
      });
      expect(response.status).toBe(404);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));
    });

    it("should throw an error if the schema is not found (multibase base58btc)", async () => {
      expect.assertions(3);

      const schemaId = hexToMultibaseBase58Btc(
        crypto.randomBytes(32).toString("hex"),
      );
      const response = await request(server).get(`/schemas/${schemaId}`);

      expect(response.body).toStrictEqual({
        detail: `Schema ${schemaId} not found`,
        status: 404,
        title: "Schema Not Found",
        type: "about:blank",
      });
      expect(response.status).toBe(404);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));
    });

    it("should return a specific schema identified by an hexadecimal schema ID", async () => {
      expect.assertions(3);

      const schema = testEnv.schemas[0]!;

      const response = await request(server).get(`/schemas/${schema.schemaId}`);

      // Expect to receive the last revision
      const revision = testEnv.schemaRevisions[SCHEMA_REVISIONS_TOTAL - 2]!;

      expect(response.body).toStrictEqual(revision.schema);
      expect(response.status).toBe(200);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/json"));
    });

    it("should return a specific schema identified by a multibase base58btc schema ID", async () => {
      expect.assertions(3);

      const schema = testEnv.schemas[0]!;
      const schemaId = hexToMultibaseBase58Btc(schema.schemaId);

      const response = await request(server).get(`/schemas/${schemaId}`);

      // Expect to receive the last revision
      const revision = testEnv.schemaRevisions[SCHEMA_REVISIONS_TOTAL - 2]!;

      expect(response.body).toStrictEqual(revision.schema);
      expect(response.status).toBe(200);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/json"));
    });
  });

  describe("GET /schemas/{schemaId}/revisions", () => {
    it("should throw an error if the schema ID is not hexadecimal", async () => {
      expect.assertions(3);

      const response = await request(server).get(
        "/schemas/no-schema/revisions",
      );

      expect(response.body).toStrictEqual({
        detail: '["schemaId must be a valid schema ID"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));
    });

    it("should throw an error if the schema is not found", async () => {
      expect.assertions(3);

      const schemaId = `0x${crypto.randomBytes(32).toString("hex")}`;
      const response = await request(server).get(
        `/schemas/${schemaId}/revisions`,
      );

      expect(response.body).toStrictEqual({
        detail: `Schema ${schemaId} not found`,
        status: 404,
        title: "Schema Not Found",
        type: "about:blank",
      });
      expect(response.status).toBe(404);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));
    });

    it("should throw a Bad Request for bad pagination", async () => {
      expect.assertions(12);

      const schema = testEnv.schemas[0]!;
      const { schemaId } = schema;

      const response1 = await request(server).get(
        `/schemas/${schemaId}/revisions?page[size]=100`,
      );
      expect(response1.body).toStrictEqual({
        detail: '["page[size] must not be greater than 50"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response1.status).toBe(400);
      expect(
        (response1.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));

      const response2 = await request(server).get(
        `/schemas/${schemaId}/revisions?page[size]=0`,
      );
      expect(response2.body).toStrictEqual({
        detail: '["page[size] must not be less than 1"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response2.status).toBe(400);
      expect(
        (response2.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));

      const response3 = await request(server).get(
        `/schemas/${schemaId}/revisions?page[after]=0`,
      );
      expect(response3.body).toStrictEqual({
        detail: '["page[after] must not be less than 1"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response3.status).toBe(400);
      expect(
        (response3.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));

      const response4 = await request(server).get(
        `/schemas/${schemaId}/revisions?page[after]=abc`,
      );
      expect(response4.body).toStrictEqual({
        detail:
          '["page[after] must not be less than 1","page[after] must be a number conforming to the specified constraints"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response4.status).toBe(400);
      expect(
        (response4.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));
    });

    it("should throw an error if valid-at query parameter is not valid", async () => {
      expect.assertions(3);

      const schema = testEnv.schemas[0]!;

      const response = await request(server).get(
        `/schemas/${schema.schemaId}/revisions?valid-at=abc`,
      );

      expect(response.body).toStrictEqual({
        detail: '["valid-at must be a valid ISO 8601 date string"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));
    });

    it("should throw an error if valid-at query parameter is used without version=deprecated", async () => {
      expect.assertions(3);

      const schema = testEnv.schemas[0]!;

      const validAt = new Date().toISOString();

      const response = await request(server).get(
        `/schemas/${schema.schemaId}/revisions?valid-at=${validAt}`,
      );

      expect(response.body).toStrictEqual({
        detail:
          "Query parameter 'version' must be set to 'deprecated' in order to use 'valid-at'",
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));
    });

    it("should return the revisions of the specified schema", async () => {
      expect.assertions(3);

      const schema = testEnv.schemas[0]!;
      const { schemaRevisions } = testEnv;

      const response = await request(server).get(
        `/schemas/${schema.schemaId}/revisions`,
      );

      const revisionId1 = ethers.sha256(schema.serializedSchema);
      const revisionId2 = ethers.sha256(schemaRevisions[0]!.serializedSchema);
      const revisionId3 = ethers.sha256(schemaRevisions[1]!.serializedSchema);

      expect(response.body).toStrictEqual({
        items: expect.arrayContaining([
          {
            href: expect.stringContaining(
              `/schemas/${schema.schemaId}/revisions/${revisionId1}`,
            ),
            schemaRevisionId: revisionId1,
          },
          {
            href: expect.stringContaining(
              `/schemas/${schema.schemaId}/revisions/${revisionId2}`,
            ),
            schemaRevisionId: revisionId2,
          },
          {
            href: expect.stringContaining(
              `/schemas/${schema.schemaId}/revisions/${revisionId3}`,
            ),
            schemaRevisionId: revisionId3,
          },
        ]),
        links: {
          first: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions?page[after]=1&page[size]=10`,
          ),
          last: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions?page[after]=1&page[size]=10`,
          ),
          next: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions?page[after]=1&page[size]=10`,
          ),
          prev: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions?page[after]=1&page[size]=10`,
          ),
        },
        pageSize: 10,
        self: expect.stringContaining(
          `/schemas/${schema.schemaId}/revisions?page[after]=1&page[size]=10`,
        ),
        total: SCHEMA_REVISIONS_TOTAL,
      });
      expect(response.status).toBe(200);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/json"));
    });

    it("should return the revisions valid at a specific date", async () => {
      expect.assertions(3);

      const schema = testEnv.schemas[0]!;
      const { schemaRevisions } = testEnv;
      const validAt = new Date().toISOString();

      const response = await request(server).get(
        `/schemas/${schema.schemaId}/revisions?valid-at=${validAt}&version=deprecated`,
      );

      const revisionId1 = ethers.sha256(schema.serializedSchema);
      const revisionId2 = ethers.sha256(schemaRevisions[0]!.serializedSchema);
      const revisionId3 = ethers.sha256(schemaRevisions[1]!.serializedSchema);

      expect(response.body).toStrictEqual({
        items: expect.arrayContaining([
          {
            href: expect.stringContaining(
              `/schemas/${schema.schemaId}/revisions/${revisionId1}`,
            ),
            schemaRevisionId: revisionId1,
          },
          {
            href: expect.stringContaining(
              `/schemas/${schema.schemaId}/revisions/${revisionId2}`,
            ),
            schemaRevisionId: revisionId2,
          },
          {
            href: expect.stringContaining(
              `/schemas/${schema.schemaId}/revisions/${revisionId3}`,
            ),
            schemaRevisionId: revisionId3,
          },
        ]),
        links: {
          first: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions?page[after]=1&page[size]=10&valid-at=${validAt}&version=deprecated`,
          ),
          last: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions?page[after]=1&page[size]=10&valid-at=${validAt}&version=deprecated`,
          ),
          next: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions?page[after]=1&page[size]=10&valid-at=${validAt}&version=deprecated`,
          ),
          prev: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions?page[after]=1&page[size]=10&valid-at=${validAt}&version=deprecated`,
          ),
        },
        pageSize: 10,
        self: expect.stringContaining(
          `/schemas/${schema.schemaId}/revisions?page[after]=1&page[size]=10&valid-at=${validAt}&version=deprecated`,
        ),
        total: SCHEMA_REVISIONS_TOTAL,
      });
      expect(response.status).toBe(200);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/json"));
    });

    it("should handle the pagination properly", async () => {
      expect.assertions(12);

      const schema = testEnv.schemas[0]!;

      const response1 = await request(server).get(
        `/schemas/${schema.schemaId}/revisions?page[size]=2`,
      );
      expect(response1.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions?page[after]=1&page[size]=2`,
          ),
          last: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions?page[after]=2&page[size]=2`,
          ),
          next: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions?page[after]=2&page[size]=2`,
          ),
          prev: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions?page[after]=1&page[size]=2`,
          ),
        },
        pageSize: 2,
        self: expect.stringContaining(
          `/schemas/${schema.schemaId}/revisions?page[after]=1&page[size]=2`,
        ),
        total: SCHEMA_REVISIONS_TOTAL,
      });
      expect((response1.body as { items: string }).items).toHaveLength(2);
      expect(response1.status).toBe(200);

      // next page
      const response2 = await request(server).get(
        `/schemas/${schema.schemaId}/revisions?page[after]=2&page[size]=2`,
      );
      expect(response2.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions?page[after]=1&page[size]=2`,
          ),
          last: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions?page[after]=2&page[size]=2`,
          ),
          next: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions?page[after]=2&page[size]=2`,
          ),
          prev: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions?page[after]=1&page[size]=2`,
          ),
        },
        pageSize: 2,
        self: expect.stringContaining(
          `/schemas/${schema.schemaId}/revisions?page[after]=2&page[size]=2`,
        ),
        total: SCHEMA_REVISIONS_TOTAL,
      });
      expect((response2.body as { items: string }).items).toHaveLength(1);
      expect(response2.status).toBe(200);

      // big page
      const response3 = await request(server).get(
        `/schemas/${schema.schemaId}/revisions?page[after]=100&page[size]=2`,
      );
      expect(response3.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions?page[after]=1&page[size]=2`,
          ),
          last: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions?page[after]=2&page[size]=2`,
          ),
          next: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions?page[after]=2&page[size]=2`,
          ),
          prev: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions?page[after]=2&page[size]=2`,
          ),
        },
        pageSize: 2,
        self: expect.stringContaining(
          `/schemas/${schema.schemaId}/revisions?page[after]=100&page[size]=2`,
        ),
        total: SCHEMA_REVISIONS_TOTAL,
      });
      expect((response3.body as { items: string }).items).toHaveLength(0);
      expect(response3.status).toBe(200);

      // page["after"] defined but page["size"] undefined
      const response4 = await request(server).get(
        `/schemas/${schema.schemaId}/revisions?page[after]=1`,
      );
      expect(response4.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions?page[after]=1&page[size]=10`,
          ),
          last: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions?page[after]=1&page[size]=10`,
          ),
          next: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions?page[after]=1&page[size]=10`,
          ),
          prev: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions?page[after]=1&page[size]=10`,
          ),
        },
        pageSize: 10,
        self: expect.stringContaining(
          `/schemas/${schema.schemaId}/revisions?page[after]=1&page[size]=10`,
        ),
        total: SCHEMA_REVISIONS_TOTAL,
      });
      expect((response4.body as { items: string }).items).toHaveLength(
        SCHEMA_REVISIONS_TOTAL,
      );
      expect(response4.status).toBe(200);
    });
  });

  describe("GET /schemas/{schemaId}/revisions/{schemaRevisionId}", () => {
    it("should throw an error if the schema ID is not hexadecimal", async () => {
      expect.assertions(3);

      const schemaRevisionId = `0x${crypto.randomBytes(32).toString("hex")}`;

      const response = await request(server).get(
        `/schemas/no-schema/revisions/${schemaRevisionId}`,
      );

      expect(response.body).toStrictEqual({
        detail: '["schemaId must be a valid schema ID"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));
    });

    it("should throw an error if the schema is not found", async () => {
      expect.assertions(3);

      const schemaId = `0x${crypto.randomBytes(32).toString("hex")}`;
      const schemaRevisionId = `0x${crypto.randomBytes(32).toString("hex")}`;

      const response = await request(server).get(
        `/schemas/${schemaId}/revisions/${schemaRevisionId}`,
      );

      expect(response.body).toStrictEqual({
        detail: `Schema ${schemaId} not found`,
        status: 404,
        title: "Schema Not Found",
        type: "about:blank",
      });
      expect(response.status).toBe(404);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));
    });

    it("should throw an error if the schema revision ID is not hexadecimal", async () => {
      expect.assertions(3);

      const schemaId = `0x${crypto.randomBytes(32).toString("hex")}`;

      const response = await request(server).get(
        `/schemas/${schemaId}/revisions/no-revision`,
      );

      expect(response.body).toStrictEqual({
        detail:
          '["schemaRevisionId must start with 0x","schemaRevisionId must have 66 characters","schemaRevisionId must be a hexadecimal number"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));
    });

    it("should throw an error if the schema revision is not found", async () => {
      expect.assertions(3);

      const schema = testEnv.schemas[0]!;
      const { schemaId } = schema;
      const schemaRevisionId = `0x${crypto.randomBytes(32).toString("hex")}`;

      const response = await request(server).get(
        `/schemas/${schemaId}/revisions/${schemaRevisionId}`,
      );

      expect(response.body).toStrictEqual({
        detail: `Revision ${schemaRevisionId} not found`,
        status: 404,
        title: "Revision Not Found",
        type: "about:blank",
      });
      expect(response.status).toBe(404);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));
    });

    it("should return a specific schema revision", async () => {
      expect.assertions(3);

      const schema = testEnv.schemas[0]!;
      const { schemaId } = schema;
      const schemaRevisionId = ethers.sha256(schema.serializedSchema);

      const response = await request(server).get(
        `/schemas/${schemaId}/revisions/${schemaRevisionId}`,
      );

      expect(response.body).toStrictEqual(schema.schema);
      expect(response.status).toBe(200);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/json"));
    });

    it("should handle the pagination properly", async () => {
      expect.assertions(12);

      const schema = testEnv.schemas[0]!;

      const response1 = await request(server).get(
        `/schemas/${schema.schemaId}/revisions?page[size]=2`,
      );
      expect(response1.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions?page[after]=1&page[size]=2`,
          ),
          last: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions?page[after]=2&page[size]=2`,
          ),
          next: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions?page[after]=2&page[size]=2`,
          ),
          prev: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions?page[after]=1&page[size]=2`,
          ),
        },
        pageSize: 2,
        self: expect.stringContaining(
          `/schemas/${schema.schemaId}/revisions?page[after]=1&page[size]=2`,
        ),
        total: SCHEMA_REVISIONS_TOTAL,
      });
      expect((response1.body as { items: string }).items).toHaveLength(2);
      expect(response1.status).toBe(200);

      // next page
      const response2 = await request(server).get(
        `/schemas/${schema.schemaId}/revisions?page[after]=2&page[size]=2`,
      );
      expect(response2.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions?page[after]=1&page[size]=2`,
          ),
          last: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions?page[after]=2&page[size]=2`,
          ),
          next: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions?page[after]=2&page[size]=2`,
          ),
          prev: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions?page[after]=1&page[size]=2`,
          ),
        },
        pageSize: 2,
        self: expect.stringContaining(
          `/schemas/${schema.schemaId}/revisions?page[after]=2&page[size]=2`,
        ),
        total: SCHEMA_REVISIONS_TOTAL,
      });
      expect((response2.body as { items: string }).items).toHaveLength(1);
      expect(response2.status).toBe(200);

      // big page
      const response3 = await request(server).get(
        `/schemas/${schema.schemaId}/revisions?page[after]=100&page[size]=2`,
      );
      expect(response3.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions?page[after]=1&page[size]=2`,
          ),
          last: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions?page[after]=2&page[size]=2`,
          ),
          next: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions?page[after]=2&page[size]=2`,
          ),
          prev: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions?page[after]=2&page[size]=2`,
          ),
        },
        pageSize: 2,
        self: expect.stringContaining(
          `/schemas/${schema.schemaId}/revisions?page[after]=100&page[size]=2`,
        ),
        total: SCHEMA_REVISIONS_TOTAL,
      });
      expect((response3.body as { items: string }).items).toHaveLength(0);
      expect(response3.status).toBe(200);

      // page["after"] defined but page["size"] undefined
      const response4 = await request(server).get(
        `/schemas/${schema.schemaId}/revisions?page[after]=1`,
      );
      expect(response4.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions?page[after]=1&page[size]=10`,
          ),
          last: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions?page[after]=1&page[size]=10`,
          ),
          next: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions?page[after]=1&page[size]=10`,
          ),
          prev: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions?page[after]=1&page[size]=10`,
          ),
        },
        pageSize: 10,
        self: expect.stringContaining(
          `/schemas/${schema.schemaId}/revisions?page[after]=1&page[size]=10`,
        ),
        total: SCHEMA_REVISIONS_TOTAL,
      });
      expect((response4.body as { items: string }).items).toHaveLength(
        SCHEMA_REVISIONS_TOTAL,
      );
      expect(response4.status).toBe(200);
    });
  });

  describe("GET /schemas/{schemaId}/revisions/{schemaRevisionId}/metadata", () => {
    it("should throw an error if the schema ID is not hexadecimal", async () => {
      expect.assertions(3);

      const schemaRevisionId = `0x${crypto.randomBytes(32).toString("hex")}`;

      const response = await request(server).get(
        `/schemas/no-schema/revisions/${schemaRevisionId}/metadata`,
      );

      expect(response.body).toStrictEqual({
        detail: '["schemaId must be a valid schema ID"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));
    });

    it("should throw an error if the schema is not found", async () => {
      expect.assertions(3);

      const schemaId = `0x${crypto.randomBytes(32).toString("hex")}`;
      const schemaRevisionId = `0x${crypto.randomBytes(32).toString("hex")}`;

      const response = await request(server).get(
        `/schemas/${schemaId}/revisions/${schemaRevisionId}/metadata`,
      );

      expect(response.body).toStrictEqual({
        detail: `Schema ${schemaId} not found`,
        status: 404,
        title: "Schema Not Found",
        type: "about:blank",
      });
      expect(response.status).toBe(404);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));
    });

    it("should throw an error if the schema revision ID is not hexadecimal", async () => {
      expect.assertions(3);

      const schemaId = `0x${crypto.randomBytes(32).toString("hex")}`;

      const response = await request(server).get(
        `/schemas/${schemaId}/revisions/no-revision/metadata`,
      );

      expect(response.body).toStrictEqual({
        detail:
          '["schemaRevisionId must start with 0x","schemaRevisionId must have 66 characters","schemaRevisionId must be a hexadecimal number"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));
    });

    it("should throw an error if the schema revision is not found", async () => {
      expect.assertions(3);

      const schema = testEnv.schemas[0]!;
      const { schemaId } = schema;
      const schemaRevisionId = `0x${crypto.randomBytes(32).toString("hex")}`;

      const response = await request(server).get(
        `/schemas/${schemaId}/revisions/${schemaRevisionId}/metadata`,
      );

      expect(response.body).toStrictEqual({
        detail: `Revision ${schemaRevisionId} not found`,
        status: 404,
        title: "Revision Not Found",
        type: "about:blank",
      });
      expect(response.status).toBe(404);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));
    });

    it("should return the metadata of the specified schema revision", async () => {
      expect.assertions(3);

      const schema = testEnv.schemas[0]!;
      const revisionId = ethers.sha256(schema.serializedSchema);
      const metadataId = ethers.sha256(schema.serializedMetadata);
      const { schemaMetadata } = testEnv;
      const metadataId2 = ethers.sha256(schemaMetadata[0]!.serializedMetadata);
      const metadataId3 = ethers.sha256(schemaMetadata[1]!.serializedMetadata);

      const response = await request(server).get(
        `/schemas/${schema.schemaId}/revisions/${revisionId}/metadata`,
      );

      expect(response.body).toStrictEqual({
        items: expect.arrayContaining([
          {
            href: expect.stringContaining(
              `/schemas/${schema.schemaId}/revisions/${revisionId}/metadata/${metadataId}`,
            ),
            metadataId,
          },
          {
            href: expect.stringContaining(
              `/schemas/${schema.schemaId}/revisions/${revisionId}/metadata/${metadataId2}`,
            ),
            metadataId: metadataId2,
          },
          {
            href: expect.stringContaining(
              `/schemas/${schema.schemaId}/revisions/${revisionId}/metadata/${metadataId3}`,
            ),
            metadataId: metadataId3,
          },
        ]),
        links: {
          first: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions/${revisionId}/metadata?page[after]=1&page[size]=10`,
          ),
          last: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions/${revisionId}/metadata?page[after]=1&page[size]=10`,
          ),
          next: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions/${revisionId}/metadata?page[after]=1&page[size]=10`,
          ),
          prev: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions/${revisionId}/metadata?page[after]=1&page[size]=10`,
          ),
        },
        pageSize: 10,
        self: expect.stringContaining(
          `/schemas/${schema.schemaId}/revisions/${revisionId}/metadata?page[after]=1&page[size]=10`,
        ),
        total: SCHEMA_METADATA_TOTAL,
      });
      expect(response.status).toBe(200);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/json"));
    });

    it("should handle the pagination properly", async () => {
      expect.assertions(12);

      const schema = testEnv.schemas[0]!;
      const revisionId = ethers.sha256(schema.serializedSchema);

      const response1 = await request(server).get(
        `/schemas/${schema.schemaId}/revisions/${revisionId}/metadata?page[size]=2`,
      );
      expect(response1.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions/${revisionId}/metadata?page[after]=1&page[size]=2`,
          ),
          last: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions/${revisionId}/metadata?page[after]=2&page[size]=2`,
          ),
          next: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions/${revisionId}/metadata?page[after]=2&page[size]=2`,
          ),
          prev: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions/${revisionId}/metadata?page[after]=1&page[size]=2`,
          ),
        },
        pageSize: 2,
        self: expect.stringContaining(
          `/schemas/${schema.schemaId}/revisions/${revisionId}/metadata?page[after]=1&page[size]=2`,
        ),
        total: SCHEMA_REVISIONS_TOTAL,
      });
      expect((response1.body as { items: string }).items).toHaveLength(2);
      expect(response1.status).toBe(200);

      // next page
      const response2 = await request(server).get(
        `/schemas/${schema.schemaId}/revisions/${revisionId}/metadata?page[after]=2&page[size]=2`,
      );
      expect(response2.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions/${revisionId}/metadata?page[after]=1&page[size]=2`,
          ),
          last: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions/${revisionId}/metadata?page[after]=2&page[size]=2`,
          ),
          next: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions/${revisionId}/metadata?page[after]=2&page[size]=2`,
          ),
          prev: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions/${revisionId}/metadata?page[after]=1&page[size]=2`,
          ),
        },
        pageSize: 2,
        self: expect.stringContaining(
          `/schemas/${schema.schemaId}/revisions/${revisionId}/metadata?page[after]=2&page[size]=2`,
        ),
        total: SCHEMA_REVISIONS_TOTAL,
      });
      expect((response2.body as { items: string }).items).toHaveLength(1);
      expect(response2.status).toBe(200);

      // big page
      const response3 = await request(server).get(
        `/schemas/${schema.schemaId}/revisions/${revisionId}/metadata?page[after]=100&page[size]=2`,
      );
      expect(response3.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions/${revisionId}/metadata?page[after]=1&page[size]=2`,
          ),
          last: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions/${revisionId}/metadata?page[after]=2&page[size]=2`,
          ),
          next: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions/${revisionId}/metadata?page[after]=2&page[size]=2`,
          ),
          prev: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions/${revisionId}/metadata?page[after]=2&page[size]=2`,
          ),
        },
        pageSize: 2,
        self: expect.stringContaining(
          `/schemas/${schema.schemaId}/revisions/${revisionId}/metadata?page[after]=100&page[size]=2`,
        ),
        total: SCHEMA_REVISIONS_TOTAL,
      });
      expect((response3.body as { items: string }).items).toHaveLength(0);
      expect(response3.status).toBe(200);

      // page["after"] defined but page["size"] undefined
      const response4 = await request(server).get(
        `/schemas/${schema.schemaId}/revisions/${revisionId}/metadata?page[after]=1`,
      );
      expect(response4.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions/${revisionId}/metadata?page[after]=1&page[size]=10`,
          ),
          last: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions/${revisionId}/metadata?page[after]=1&page[size]=10`,
          ),
          next: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions/${revisionId}/metadata?page[after]=1&page[size]=10`,
          ),
          prev: expect.stringContaining(
            `/schemas/${schema.schemaId}/revisions/${revisionId}/metadata?page[after]=1&page[size]=10`,
          ),
        },
        pageSize: 10,
        self: expect.stringContaining(
          `/schemas/${schema.schemaId}/revisions/${revisionId}/metadata?page[after]=1&page[size]=10`,
        ),
        total: SCHEMA_REVISIONS_TOTAL,
      });
      expect((response4.body as { items: string }).items).toHaveLength(
        SCHEMA_REVISIONS_TOTAL,
      );
      expect(response4.status).toBe(200);
    });
  });

  describe("GET /schemas/{schemaId}/revisions/{schemaRevisionId}/metadata/{metadataId}", () => {
    it("should throw an error if the schema ID is not hexadecimal", async () => {
      expect.assertions(3);

      const schemaRevisionId = `0x${crypto.randomBytes(32).toString("hex")}`;
      const metadataId = `0x${crypto.randomBytes(32).toString("hex")}`;

      const response = await request(server).get(
        `/schemas/no-schema/revisions/${schemaRevisionId}/metadata/${metadataId}`,
      );

      expect(response.body).toStrictEqual({
        detail: '["schemaId must be a valid schema ID"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));
    });

    it("should throw an error if the schema is not found", async () => {
      expect.assertions(3);

      const schemaId = `0x${crypto.randomBytes(32).toString("hex")}`;
      const schemaRevisionId = `0x${crypto.randomBytes(32).toString("hex")}`;
      const metadataId = `0x${crypto.randomBytes(32).toString("hex")}`;

      const response = await request(server).get(
        `/schemas/${schemaId}/revisions/${schemaRevisionId}/metadata/${metadataId}`,
      );

      expect(response.body).toStrictEqual({
        detail: `Schema ${schemaId} not found`,
        status: 404,
        title: "Schema Not Found",
        type: "about:blank",
      });
      expect(response.status).toBe(404);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));
    });

    it("should throw an error if the schema revision ID is not hexadecimal", async () => {
      expect.assertions(3);

      const schemaId = `0x${crypto.randomBytes(32).toString("hex")}`;
      const metadataId = `0x${crypto.randomBytes(32).toString("hex")}`;

      const response = await request(server).get(
        `/schemas/${schemaId}/revisions/no-revision/metadata/${metadataId}`,
      );

      expect(response.body).toStrictEqual({
        detail:
          '["schemaRevisionId must start with 0x","schemaRevisionId must have 66 characters","schemaRevisionId must be a hexadecimal number"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));
    });

    it("should throw an error if the schema revision is not found", async () => {
      expect.assertions(3);

      const schema = testEnv.schemas[0]!;
      const { schemaId } = schema;
      const schemaRevisionId = `0x${crypto.randomBytes(32).toString("hex")}`;
      const metadataId = `0x${crypto.randomBytes(32).toString("hex")}`;

      const response = await request(server).get(
        `/schemas/${schemaId}/revisions/${schemaRevisionId}/metadata/${metadataId}`,
      );

      expect(response.body).toStrictEqual({
        detail: `Revision ${schemaRevisionId} not found`,
        status: 404,
        title: "Revision Not Found",
        type: "about:blank",
      });
      expect(response.status).toBe(404);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));
    });

    it("should throw an error if the metadata ID is not hexadecimal", async () => {
      expect.assertions(3);

      const schema = testEnv.schemas[0]!;
      const { schemaId } = schema;
      const schemaRevisionId = ethers.sha256(schema.serializedSchema);

      const response = await request(server).get(
        `/schemas/${schemaId}/revisions/${schemaRevisionId}/metadata/no-metadata`,
      );

      expect(response.body).toStrictEqual({
        detail:
          '["metadataId must start with 0x","metadataId must have 66 characters","metadataId must be a hexadecimal number"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));
    });

    it("should throw an error if the schema revision is not found", async () => {
      expect.assertions(3);

      const schema = testEnv.schemas[0]!;
      const { schemaId } = schema;
      const schemaRevisionId = `0x${crypto.randomBytes(32).toString("hex")}`;
      const metadataId = `0x${crypto.randomBytes(32).toString("hex")}`;

      const response = await request(server).get(
        `/schemas/${schemaId}/revisions/${schemaRevisionId}/metadata/${metadataId}`,
      );

      expect(response.body).toStrictEqual({
        detail: `Revision ${schemaRevisionId} not found`,
        status: 404,
        title: "Revision Not Found",
        type: "about:blank",
      });
      expect(response.status).toBe(404);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));
    });

    it("should throw an error if the schema revision metadata is not found", async () => {
      expect.assertions(3);

      const schema = testEnv.schemas[0]!;
      const { schemaId } = schema;
      const schemaRevisionId = ethers.sha256(schema.serializedSchema);
      const metadataId = `0x${crypto.randomBytes(32).toString("hex")}`;

      const response = await request(server).get(
        `/schemas/${schemaId}/revisions/${schemaRevisionId}/metadata/${metadataId}`,
      );

      expect(response.body).toStrictEqual({
        detail: `Metadata ${metadataId} not found`,
        status: 404,
        title: "Metadata Not Found",
        type: "about:blank",
      });
      expect(response.status).toBe(404);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));
    });

    it("should return the expected metadata", async () => {
      expect.assertions(3);

      const schema = testEnv.schemas[0]!;
      const { schemaId } = schema;
      const schemaRevisionId = ethers.sha256(schema.serializedSchema);
      const metadataId = ethers.sha256(schema.serializedMetadata);

      const response = await request(server).get(
        `/schemas/${schemaId}/revisions/${schemaRevisionId}/metadata/${metadataId}`,
      );

      expect(response.body).toStrictEqual(schema.metadata);
      expect(response.status).toBe(200);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/ld+json"));
    });
  });
});
