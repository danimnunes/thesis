import type { JSONSchema } from "@apidevtools/json-schema-ref-parser";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { RawServerDefault } from "fastify";

import {
  computeId,
  computeId__deprecated,
  prefixWith0x,
  waitToBeMined,
} from "@ebsiint-api/shared";
import { ConfigService } from "@nestjs/config";
import { ethers } from "ethers";
import crypto from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { ApiConfig } from "../../src/config/configuration.ts";
import type { JsonRpcResponseObject } from "../../src/modules/jsonrpc/jsonrpc.interface.ts";
import type { InsertSchemaSchema } from "../../src/modules/jsonrpc/validators/RequestInsertSchemaSchema.ts";
import type { UnsignedTransaction } from "../../src/modules/jsonrpc/validators/RequestSendSignedTransactionSchema.ts";
import type { UpdateMetadataSchema } from "../../src/modules/jsonrpc/validators/RequestUpdateMetadataSchema.ts";
import type { UpdateSchemaSchema } from "../../src/modules/jsonrpc/validators/RequestUpdateSchemaSchema.ts";

import { AppModule } from "../../src/app.module.ts";
import { formatEthersUnsignedTransaction } from "../../src/modules/jsonrpc/jsonrpc.utils.ts";
import { hexToMultibaseBase58Btc } from "../../src/modules/schemas/schemas.utils.ts";
import { getNestFastifyApplication } from "../utils/app.ts";
import { createVerifiableAuthorisationSchema } from "../utils/data.ts";
import { getTsrWriteAccessToken } from "../utils/getAccessToken.ts";
import { getEbsiIssuer } from "../utils/getEbsiIssuer.ts";
import { getServer } from "../utils/getServer.ts";
import { describeWriteOps, writeOps } from "../utils/writeOps.ts";

type JsonRpcParams =
  | InsertSchemaSchema
  | UpdateMetadataSchema
  | UpdateSchemaSchema;

interface SupertestJsonRpcResponse {
  body: JsonRpcResponseObject;
  status: number;
}

describe.each([
  "fixed",
  "deprecated (invalid $ref, document stringified twice)",
  "deprecated (invalid $ref, document ok)",
] as const)("TSR API v3 - Schemas (e2e, %s schema IDs)", (schemaIdType) => {
  let app: NestFastifyApplication;
  let server: RawServerDefault | string;
  let adminTestWallet: ethers.Wallet;
  let testAdminAccessToken: string;

  let rawSchema: JSONSchema;
  let schemaId: string;
  let serializedSchema: string;
  let serializedSchemaBuffer: Buffer;
  let schemaRevisionId: string;

  let rawUpdatedSchema: JSONSchema;
  let serializedUpdatedSchema: string;
  let serializedSchemaUpdatedBuffer: Buffer;

  let rawMetadata: Record<string, unknown>;
  let serializedMetadata: string;
  let serializedMetadataBuffer: Buffer;
  let schemaRevisionMetadataId: string;

  let rawMetadata2: Record<string, unknown>;
  let serializedMetadata2: string;
  let serializedMetadataBuffer2: Buffer;

  let rawUpdatedMetadata: Record<string, unknown>;
  let serializedUpdatedMetadata: string;
  let serializedUpdatedMetadataBuffer: Buffer;

  let ledgerApi: string;

  let sampleTransaction: string;

  let blockscout: {
    bearerToken: string | undefined;
    url: string | undefined;
  };

  beforeAll(async () => {
    app = await getNestFastifyApplication({
      imports: [AppModule],
    });

    if (process.env.TEST_ENV !== "remote") {
      await app.init();
      const fastifyInstance = app.getHttpAdapter().getInstance();
      await fastifyInstance.ready();
    }

    const configService =
      app.get<ConfigService<ApiConfig, true>>(ConfigService);

    server = getServer(app, configService);

    if (writeOps()) {
      const ebsiEnvConfig = configService.get("ebsiEnvConfig", {
        infer: true,
      });

      const testAdminPrivateKeyHex = configService.get("testAdminPrivateKey", {
        infer: true,
      });

      if (!testAdminPrivateKeyHex) {
        throw new Error("Missing testAdminPrivateKey");
      }

      const testAdminKid = configService.get("testAdminKid", { infer: true });

      if (!testAdminKid) {
        throw new Error("Missing testAdminKid");
      }

      const testAdminDid = testAdminKid.split("#")[0]!;
      const testAdminIssuerInfo = await getEbsiIssuer(
        testAdminPrivateKeyHex,
        testAdminDid,
        testAdminKid,
      );

      adminTestWallet = new ethers.Wallet(
        prefixWith0x(configService.get("testAdminPrivateKey", { infer: true })),
      );

      const authorisationApiUrl = configService.get("authorisationApiUrl", {
        infer: true,
      });

      try {
        testAdminAccessToken = await getTsrWriteAccessToken(
          authorisationApiUrl,
          testAdminIssuerInfo,
          ebsiEnvConfig,
        );
      } catch (error) {
        console.error(error);
        throw error;
      }
    }

    ledgerApi = `${configService.get("ledgerApiUrl", { infer: true })}/blockchains/besu`;

    rawSchema = createVerifiableAuthorisationSchema(
      configService.get("testVaSchemaUrl", { infer: true }),
    );

    blockscout = configService.get("blockscout", { infer: true });

    const schemaIdBuffer =
      schemaIdType === "fixed"
        ? await computeId(rawSchema)
        : await computeId__deprecated(
            rawSchema,
            schemaIdType ===
              "deprecated (invalid $ref, document stringified twice)",
          );
    schemaId = `0x${schemaIdBuffer.toString("hex")}`;

    serializedSchema = JSON.stringify(rawSchema);
    serializedSchemaBuffer = Buffer.from(serializedSchema);
    schemaRevisionId = ethers.sha256(serializedSchemaBuffer);

    rawUpdatedSchema = {
      ...rawSchema,
      description: "Updated schema of an EBSI Verifiable Attestation",
    };
    serializedUpdatedSchema = JSON.stringify(rawUpdatedSchema);
    serializedSchemaUpdatedBuffer = Buffer.from(serializedUpdatedSchema);

    rawMetadata = {
      data: crypto.randomBytes(16).toString("hex"),
      meta: "value",
      validFrom: new Date(Date.now() - 60 * 1000).toISOString(), // -1 minute
      validTo: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // +5 minutes
    };
    serializedMetadata = JSON.stringify(rawMetadata);
    serializedMetadataBuffer = Buffer.from(serializedMetadata);
    schemaRevisionMetadataId = ethers.sha256(serializedMetadataBuffer);

    rawMetadata2 = {
      data: crypto.randomBytes(16).toString("hex"),
      meta: "value 2",
      validFrom: new Date(Date.now() - 60 * 1000).toISOString(), // -1 minute
      validTo: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // +5 minutes
    };
    serializedMetadata2 = JSON.stringify(rawMetadata2);
    serializedMetadataBuffer2 = Buffer.from(serializedMetadata2);
    rawUpdatedMetadata = {
      data: crypto.randomBytes(16).toString("hex"),
      meta: "value updated",
      validFrom: new Date(Date.now() - 60 * 1000).toISOString(), // -1 minute
      validTo: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // +5 minutes
    };
    serializedUpdatedMetadata = JSON.stringify(rawUpdatedMetadata);
    serializedUpdatedMetadataBuffer = Buffer.from(serializedUpdatedMetadata);
  });

  afterAll(async () => {
    await app.close();
  });

  describeWriteOps().each(["insertSchema", "updateSchema", "updateMetadata"])(
    "/jsonrpc - send transaction for %s",
    (method: string) => {
      it("should work", async () => {
        expect.assertions(5);

        let params: JsonRpcParams;

        switch (method) {
          case "insertSchema": {
            params = {
              from: adminTestWallet.address,
              metadata: `0x${serializedMetadataBuffer.toString("hex")}`,
              schema: `0x${serializedSchemaBuffer.toString("hex")}`,
              schemaId,
            } satisfies InsertSchemaSchema;
            break;
          }
          case "updateMetadata": {
            params = {
              from: adminTestWallet.address,
              metadata: `0x${serializedMetadataBuffer2.toString("hex")}`,
              schemaId,
              schemaRevisionId,
            } satisfies UpdateMetadataSchema;
            break;
          }
          case "updateSchema": {
            params = {
              from: adminTestWallet.address,
              metadata: `0x${serializedUpdatedMetadataBuffer.toString("hex")}`,
              schema: `0x${serializedSchemaUpdatedBuffer.toString("hex")}`,
              schemaId,
            } satisfies UpdateSchemaSchema;
            break;
          }
          default: {
            throw new Error(`Test Error: Invalid method ${method}`);
          }
        }

        const responseBuild: SupertestJsonRpcResponse = await request(server)
          .post("/jsonrpc")
          .auth(testAdminAccessToken, { type: "bearer" })
          .send({
            id: 231,
            jsonrpc: "2.0",
            method,
            params: [params],
          });

        expect(responseBuild.body).toStrictEqual({
          id: 231,
          jsonrpc: "2.0",
          result: {
            chainId: expect.any(String),
            data: expect.any(String),
            from: adminTestWallet.address,
            gasLimit: expect.any(String),
            gasPrice: expect.any(String),
            nonce: expect.any(String),
            to: expect.any(String),
            value: expect.any(String),
          },
        });
        expect(responseBuild.status).toBe(200);

        const unsignedTransaction = responseBuild.body.result;
        const uTx = formatEthersUnsignedTransaction(
          unsignedTransaction as UnsignedTransaction,
        );

        const sgnTx = await adminTestWallet.signTransaction(
          uTx as ethers.TransactionLike,
        );
        const signature = ethers.Transaction.from(sgnTx).signature;
        if (!signature) {
          throw new Error("Signature not found");
        }
        const { r, s, v } = signature;

        const responseSend: SupertestJsonRpcResponse = await request(server)
          .post("/jsonrpc")
          .auth(testAdminAccessToken, { type: "bearer" })
          .send({
            id: "45",
            jsonrpc: "2.0",
            method: "sendSignedTransaction",
            params: [
              {
                protocol: "eth",
                r,
                s,
                signedRawTransaction: sgnTx,
                unsignedTransaction,
                v: `0x${v.toString(16)}`,
              },
            ],
          });

        expect(responseSend.body).toStrictEqual({
          id: "45",
          jsonrpc: "2.0",
          result: expect.any(String),
        });
        expect(responseSend.status).toBe(200);

        // wait to be mined
        const receipt = await waitToBeMined(
          ledgerApi,
          responseSend.body.result as string,
        );
        expect(receipt.status).toBe("0x1");
        sampleTransaction = responseSend.body.result as string;
      });

      it("should return transaction data from blockscout", async () => {
        if (!blockscout.url || !sampleTransaction) return;

        expect.assertions(1);

        await new Promise((f) => {
          setTimeout(f, 5000);
        });

        // check if blockscout is working properly
        const blockscoutCheck = await request(blockscout.url)
          .get(`/tx/${sampleTransaction}`)
          .set({
            ...(blockscout.bearerToken && {
              Authorization: blockscout.bearerToken,
            }),
          });

        expect(blockscoutCheck.status).toBe(200);
      });
    },
  );

  describe("GET /schemas", () => {
    it("should return a paginated collection of schemas", async () => {
      expect.assertions(2);

      const response = await request(server).get("/schemas");

      expect(response.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining(
            "/schemas?page[after]=1&page[size]=10",
          ),
          last: expect.stringContaining("/schemas?page[after]="),
          next: expect.stringContaining("/schemas?page[after]="),
          prev: expect.stringContaining("/schemas?page[after]=1&page[size]=10"),
        },
        pageSize: 10,
        self: expect.stringContaining("/schemas?page[after]=1&page[size]=10"),
        total: expect.any(Number),
      });
      expect(response.status).toBe(200);
    });
  });

  describe("GET /schemas/{schemaId}", () => {
    describeWriteOps()("Test requiring actual data", () => {
      it("should return a specific schema identified by an hexadecimal schema ID", async () => {
        expect.assertions(3);

        const response = await request(server).get(`/schemas/${schemaId}`);

        expect(response.body).toStrictEqual(rawUpdatedSchema);
        expect(response.status).toBe(200);
        expect(
          (response.headers as { "content-type": string })["content-type"],
        ).toStrictEqual(expect.stringContaining("application/json"));
      });

      it("should return a specific schema identified by a multibase base58btc schema ID", async () => {
        expect.assertions(3);

        const multibaseSchemaId = hexToMultibaseBase58Btc(schemaId);

        const response = await request(server).get(
          `/schemas/${multibaseSchemaId}`,
        );

        expect(response.body).toStrictEqual(rawUpdatedSchema);
        expect(response.status).toBe(200);
        expect(
          (response.headers as { "content-type": string })["content-type"],
        ).toStrictEqual(expect.stringContaining("application/json"));
      });
    });

    it("should throw an error if the schema is not found", async () => {
      expect.assertions(3);

      const fakeId = `0x${crypto.randomBytes(16).toString("hex")}`;

      const response = await request(server).get(`/schemas/${fakeId}`);

      expect(response.body).toStrictEqual({
        detail: `Schema ${fakeId} not found`,
        status: 404,
        title: "Schema Not Found",
        type: "about:blank",
      });
      expect(response.status).toBe(404);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));
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

      const fakeId = `0x${crypto.randomBytes(32).toString("hex")}`;
      const response = await request(server).get(
        `/schemas/${fakeId}/revisions`,
      );

      expect(response.body).toStrictEqual({
        detail: `Schema ${fakeId} not found`,
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

      const response = await request(server).get(
        `/schemas/${schemaId}/revisions?valid-at=abc`,
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

      const validAt = new Date().toISOString();

      const response = await request(server).get(
        `/schemas/${schemaId}/revisions?valid-at=${validAt}`,
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

    describeWriteOps()("Test requiring actual data", () => {
      it("should return the revisions of the specified schema", async () => {
        expect.assertions(3);

        const response = await request(server).get(
          `/schemas/${schemaId}/revisions`,
        );

        const revisionId2 = ethers.sha256(Buffer.from(serializedUpdatedSchema));

        expect(response.body).toStrictEqual({
          items: expect.arrayContaining([
            {
              href: expect.stringContaining(
                `/schemas/${schemaId}/revisions/${schemaRevisionId}`,
              ),
              schemaRevisionId,
            },
            {
              href: expect.stringContaining(
                `/schemas/${schemaId}/revisions/${revisionId2}`,
              ),
              schemaRevisionId: revisionId2,
            },
          ]),
          links: {
            first: expect.stringContaining(
              `/schemas/${schemaId}/revisions?page[after]=1&page[size]=10`,
            ),
            last: expect.stringContaining(
              `/schemas/${schemaId}/revisions?page[after]=1&page[size]=10`,
            ),
            next: expect.stringContaining(
              `/schemas/${schemaId}/revisions?page[after]=1&page[size]=10`,
            ),
            prev: expect.stringContaining(
              `/schemas/${schemaId}/revisions?page[after]=1&page[size]=10`,
            ),
          },
          pageSize: 10,
          self: expect.stringContaining(
            `/schemas/${schemaId}/revisions?page[after]=1&page[size]=10`,
          ),
          total: expect.any(Number),
        });
        expect(response.status).toBe(200);
        expect(
          (response.headers as { "content-type": string })["content-type"],
        ).toStrictEqual(expect.stringContaining("application/json"));
      });
    });
  });

  describe("GET /schemas/{schemaId}/revisions/{schemaRevisionId}", () => {
    it("should throw an error if the schema ID is not hexadecimal", async () => {
      expect.assertions(3);

      const fakeSchemaRevisionId = `0x${crypto
        .randomBytes(32)
        .toString("hex")}`;

      const response = await request(server).get(
        `/schemas/no-schema/revisions/${fakeSchemaRevisionId}`,
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

      const fakeSchemaId = `0x${crypto.randomBytes(32).toString("hex")}`;
      const fakeSchemaRevisionId = `0x${crypto
        .randomBytes(32)
        .toString("hex")}`;

      const response = await request(server).get(
        `/schemas/${fakeSchemaId}/revisions/${fakeSchemaRevisionId}`,
      );

      expect(response.body).toStrictEqual({
        detail: `Schema ${fakeSchemaId} not found`,
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

      const fakeSchemaId = `0x${crypto.randomBytes(32).toString("hex")}`;

      const response = await request(server).get(
        `/schemas/${fakeSchemaId}/revisions/no-revision`,
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

    describeWriteOps()("Test requiring actual data", () => {
      it("should throw an error if the schema revision is not found", async () => {
        expect.assertions(3);

        const fakeSchemaRevisionId = `0x${crypto
          .randomBytes(32)
          .toString("hex")}`;

        const response = await request(server).get(
          `/schemas/${schemaId}/revisions/${fakeSchemaRevisionId}`,
        );

        expect(response.body).toStrictEqual({
          detail: `Revision ${fakeSchemaRevisionId} not found`,
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

        const response = await request(server).get(
          `/schemas/${schemaId}/revisions/${schemaRevisionId}`,
        );

        expect(response.body).toStrictEqual(rawSchema);
        expect(response.status).toBe(200);
        expect(
          (response.headers as { "content-type": string })["content-type"],
        ).toStrictEqual(expect.stringContaining("application/json"));
      });
    });
  });

  describe("GET /schemas/{schemaId}/revisions/{schemaRevisionId}/metadata", () => {
    it("should throw an error if the schema ID is not hexadecimal", async () => {
      expect.assertions(3);

      const fakeSchemaRevisionId = `0x${crypto
        .randomBytes(32)
        .toString("hex")}`;

      const response = await request(server).get(
        `/schemas/no-schema/revisions/${fakeSchemaRevisionId}/metadata`,
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

      const fakeSchemaId = `0x${crypto.randomBytes(32).toString("hex")}`;
      const fakeSchemaRevisionId = `0x${crypto
        .randomBytes(32)
        .toString("hex")}`;

      const response = await request(server).get(
        `/schemas/${fakeSchemaId}/revisions/${fakeSchemaRevisionId}/metadata`,
      );

      expect(response.body).toStrictEqual({
        detail: `Schema ${fakeSchemaId} not found`,
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

      const fakeSchemaId = `0x${crypto.randomBytes(32).toString("hex")}`;

      const response = await request(server).get(
        `/schemas/${fakeSchemaId}/revisions/no-revision/metadata`,
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

    describeWriteOps()("Test requiring actual data", () => {
      it("should throw an error if the schema revision is not found", async () => {
        expect.assertions(3);

        const fakeSchemaRevisionId = `0x${crypto
          .randomBytes(32)
          .toString("hex")}`;

        const response = await request(server).get(
          `/schemas/${schemaId}/revisions/${fakeSchemaRevisionId}/metadata`,
        );

        expect(response.body).toStrictEqual({
          detail: `Revision ${fakeSchemaRevisionId} not found`,
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

        const response = await request(server).get(
          `/schemas/${schemaId}/revisions/${schemaRevisionId}/metadata`,
        );

        expect(response.body).toStrictEqual({
          items: expect.arrayContaining([
            {
              href: expect.stringContaining(
                `/schemas/${schemaId}/revisions/${schemaRevisionId}/metadata/${schemaRevisionMetadataId}`,
              ),
              metadataId: schemaRevisionMetadataId,
            },
          ]),
          links: {
            first: expect.stringContaining(
              `/schemas/${schemaId}/revisions/${schemaRevisionId}/metadata?page[after]=1&page[size]=10`,
            ),
            last: expect.stringContaining(
              `/schemas/${schemaId}/revisions/${schemaRevisionId}/metadata?page[after]=1&page[size]=10`,
            ),
            next: expect.stringContaining(
              `/schemas/${schemaId}/revisions/${schemaRevisionId}/metadata?page[after]=1&page[size]=10`,
            ),
            prev: expect.stringContaining(
              `/schemas/${schemaId}/revisions/${schemaRevisionId}/metadata?page[after]=1&page[size]=10`,
            ),
          },
          pageSize: 10,
          self: expect.stringContaining(
            `/schemas/${schemaId}/revisions/${schemaRevisionId}/metadata?page[after]=1&page[size]=10`,
          ),
          total: expect.any(Number),
        });
        expect(response.status).toBe(200);
        expect(
          (response.headers as { "content-type": string })["content-type"],
        ).toStrictEqual(expect.stringContaining("application/json"));
      });
    });
  });

  describe("GET /schemas/{schemaId}/revisions/{schemaRevisionId}/metadata/{metadataId}", () => {
    it("should throw an error if the schema ID is not hexadecimal", async () => {
      expect.assertions(3);

      const fakeSchemaRevisionId = `0x${crypto
        .randomBytes(32)
        .toString("hex")}`;

      const fakeSchemaMetadataId = `0x${crypto
        .randomBytes(32)
        .toString("hex")}`;

      const response = await request(server).get(
        `/schemas/no-schema/revisions/${fakeSchemaRevisionId}/metadata/${fakeSchemaMetadataId}`,
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

      const fakeSchemaId = `0x${crypto.randomBytes(32).toString("hex")}`;
      const fakeSchemaRevisionId = `0x${crypto
        .randomBytes(32)
        .toString("hex")}`;
      const fakeSchemaMetadataId = `0x${crypto
        .randomBytes(32)
        .toString("hex")}`;

      const response = await request(server).get(
        `/schemas/${fakeSchemaId}/revisions/${fakeSchemaRevisionId}/metadata/${fakeSchemaMetadataId}`,
      );

      expect(response.body).toStrictEqual({
        detail: `Schema ${fakeSchemaId} not found`,
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

      const fakeSchemaId = `0x${crypto.randomBytes(32).toString("hex")}`;
      const fakeSchemaMetadataId = `0x${crypto
        .randomBytes(32)
        .toString("hex")}`;

      const response = await request(server).get(
        `/schemas/${fakeSchemaId}/revisions/no-revision/metadata/${fakeSchemaMetadataId}`,
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

    describeWriteOps()("Test requiring actual data", () => {
      it("should throw an error if the schema revision is not found", async () => {
        expect.assertions(3);

        const fakeSchemaRevisionId = `0x${crypto
          .randomBytes(32)
          .toString("hex")}`;
        const fakeSchemaMetadataId = `0x${crypto
          .randomBytes(32)
          .toString("hex")}`;

        const response = await request(server).get(
          `/schemas/${schemaId}/revisions/${fakeSchemaRevisionId}/metadata/${fakeSchemaMetadataId}`,
        );

        expect(response.body).toStrictEqual({
          detail: `Revision ${fakeSchemaRevisionId} not found`,
          status: 404,
          title: "Revision Not Found",
          type: "about:blank",
        });
        expect(response.status).toBe(404);
        expect(
          (response.headers as { "content-type": string })["content-type"],
        ).toStrictEqual(expect.stringContaining("application/problem+json"));
      });

      it("should throw an error if the schema revision metadata ID is not hexadecimal", async () => {
        expect.assertions(3);

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

      it("should return a specific schema revision metadata", async () => {
        expect.assertions(3);

        const response = await request(server).get(
          `/schemas/${schemaId}/revisions/${schemaRevisionId}/metadata/${schemaRevisionMetadataId}`,
        );

        expect(response.body).toStrictEqual(rawMetadata);
        expect(response.status).toBe(200);
        expect(
          (response.headers as { "content-type": string })["content-type"],
        ).toStrictEqual(expect.stringContaining("application/ld+json"));
      });

      it("should throw an error if the schema revision metadata is not found", async () => {
        expect.assertions(3);

        const fakeSchemaMetadataId = `0x${crypto
          .randomBytes(32)
          .toString("hex")}`;

        const response = await request(server).get(
          `/schemas/${schemaId}/revisions/${schemaRevisionId}/metadata/${fakeSchemaMetadataId}`,
        );

        expect(response.body).toStrictEqual({
          detail: `Metadata ${fakeSchemaMetadataId} not found`,
          status: 404,
          title: "Metadata Not Found",
          type: "about:blank",
        });
        expect(response.status).toBe(404);
        expect(
          (response.headers as { "content-type": string })["content-type"],
        ).toStrictEqual(expect.stringContaining("application/problem+json"));
      });
    });
  });
});
