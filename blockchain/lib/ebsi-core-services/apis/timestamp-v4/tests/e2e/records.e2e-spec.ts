import type { PaginatedList } from "@ebsiint-api/shared";
import type { EbsiIssuer } from "@europeum-ebsi/verifiable-credential";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { RawServerDefault } from "fastify";

import { multibase, prefixWith0x, waitToBeMined } from "@ebsiint-api/shared";
import { HttpStatus } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ethers } from "ethers";
import crypto from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { ApiConfig } from "../../src/config/configuration.ts";
import type { JsonRpcResponseObject } from "../../src/modules/jsonrpc/jsonrpc.interface.ts";
import type { AppendRecordVersionHashesSchema } from "../../src/modules/jsonrpc/validators/RequestAppendRecordVersionHashes.ts";
import type { DetachRecordVersionHashSchema } from "../../src/modules/jsonrpc/validators/RequestDetachRecordVersionHashes.ts";
import type { InsertRecordOwnerSchema } from "../../src/modules/jsonrpc/validators/RequestInsertRecordOwner.ts";
import type { InsertRecordVersionInfoSchema } from "../../src/modules/jsonrpc/validators/RequestInsertRecordVersionInfo.ts";
import type { RevokeRecordOwnerSchema } from "../../src/modules/jsonrpc/validators/RequestRevokeRecordOwner.ts";
import type { TimestampRecordHashesSchema } from "../../src/modules/jsonrpc/validators/RequestTimestampRecordHashes.ts";
import type { TimestampRecordVersionHashesSchema } from "../../src/modules/jsonrpc/validators/RequestTimestampRecordVersionHashes.ts";
import type { TimestampVersionHashesSchema } from "../../src/modules/jsonrpc/validators/RequestTimestampVersionHashes.ts";
import type { UnsignedTransactionSchema } from "../../src/modules/jsonrpc/validators/UnsignedTransaction.ts";
import type {
  RecordLink,
  VersionLink,
} from "../../src/modules/records/records.interface.ts";

import { AppModule } from "../../src/app.module.ts";
import { formatEthersUnsignedTransaction } from "../../src/modules/jsonrpc/jsonrpc.utils.ts";
import { getNestFastifyApplication } from "../utils/app.ts";
import { getTimestampWriteAccessToken } from "../utils/getAccessToken.ts";
import { getEbsiIssuer } from "../utils/getEbsiIssuer.ts";
import { getServer } from "../utils/getServer.ts";
import { describeWriteOps, itWriteOps, writeOps } from "../utils/writeOps.ts";

type JsonRpcParams =
  | AppendRecordVersionHashesSchema
  | DetachRecordVersionHashSchema
  | InsertRecordOwnerSchema
  | InsertRecordVersionInfoSchema
  | RevokeRecordOwnerSchema
  | TimestampRecordHashesSchema
  | TimestampRecordVersionHashesSchema
  | TimestampVersionHashesSchema
  | UnsignedTransactionSchema;

interface SupertestJsonRpcResponse {
  body: JsonRpcResponseObject;
  status: number;
}

const multihashToNodeHashAlg = {
  "sha2-256": "sha256",
  "sha2-512": "sha512",
  "sha3-224": "sha3-224",
  "sha3-256": "sha3-256",
  "sha3-384": "sha3-384",
  "sha3-512": "sha3-512",
} as const;

interface TestUser {
  info: EbsiIssuer;
  token: string;
  wallet: ethers.BaseWallet;
}

describe("Timestamp API v4 - Records (e2e)", () => {
  let app: NestFastifyApplication;
  let server: RawServerDefault | string;
  let configService: ConfigService<ApiConfig, true>;
  let hashAlgorithmId: number;
  let hashAlgorithmMultihash: keyof typeof multihashToNodeHashAlg;
  let hashValue1: string;
  let hashValue2: string;
  let hashValue3: string;
  let blockNumber1 = 0;
  let blockNumber2 = 0;
  let authorisationApiUrl: string;
  let adminUser: TestUser;
  let testUser: TestUser;
  let ledgerApi: string;

  const getFirstRecordId = async () => {
    const respRecords = await request(server).get("/records");
    const { recordId } = (respRecords.body as { items: RecordLink[] })
      .items[0]!;
    return recordId;
  };

  const getRecordVersions = async (recordId: string) => {
    const respRecords = await request(server).get(
      `/records/${recordId}/versions`,
    );
    const { items, total } = respRecords.body as {
      items: VersionLink[];
      total: number;
    };
    return { items, total };
  };

  beforeAll(async () => {
    // Start server
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

    authorisationApiUrl = configService.get("authorisationApiUrl", {
      infer: true,
    });

    if (writeOps()) {
      const configTestAdmin = configService.get("testAdmin", { infer: true });
      const adminKid = configTestAdmin.kid;
      const adminPrivateKeyHex = configTestAdmin.privateKey;
      const adminDid = adminKid.split("#")[0]!;
      const adminWallet = new ethers.Wallet(prefixWith0x(adminPrivateKeyHex));
      const adminIssuerInfo = await getEbsiIssuer(
        adminPrivateKeyHex,
        adminDid,
        adminKid,
      );

      ledgerApi = `${configService.get("ledgerApiUrl", { infer: true })}/blockchains/besu`;
      const ebsiEnvConfig = configService.get("ebsiEnvConfig", { infer: true });

      try {
        adminUser = {
          info: adminIssuerInfo,
          token: await getTimestampWriteAccessToken(
            authorisationApiUrl,
            adminIssuerInfo,
            ebsiEnvConfig,
          ),
          wallet: adminWallet,
        };
      } catch (error) {
        console.error(error);
        throw error;
      }

      const configTestUser = configService.get("testUser", { infer: true });
      const userKid = configTestUser.kid;
      const userDid = userKid.split("#")[0]!;
      const userPrivateKeyHex = configTestUser.privateKey;
      const userWallet = new ethers.Wallet(prefixWith0x(userPrivateKeyHex));
      const userInfo = await getEbsiIssuer(userPrivateKeyHex, userDid, userKid);

      try {
        testUser = {
          info: userInfo,
          token: await getTimestampWriteAccessToken(
            authorisationApiUrl,
            userInfo,
            ebsiEnvConfig,
          ),
          wallet: userWallet,
        };
      } catch (error) {
        console.error(error);
        throw error;
      }
    }

    // During the tests, we'll use the last hash algorithm
    const getHashAlgorithmsResponse =
      await request(server).get("/hash-algorithms");
    hashAlgorithmId =
      (getHashAlgorithmsResponse.body as { total: number }).total - 1;

    // Get info about the hash algorithm
    const getHashAlgorithmResponse = await request(server).get(
      `/hash-algorithms/${hashAlgorithmId}`,
    );
    hashAlgorithmMultihash = (
      getHashAlgorithmResponse.body as {
        multihash: keyof typeof multihashToNodeHashAlg;
      }
    ).multihash;

    // Compute 2 hashes with the last hash algorithm
    hashValue1 = `0x${crypto
      .createHash(multihashToNodeHashAlg[hashAlgorithmMultihash])
      .update(crypto.randomBytes(32).toString("hex"), "hex")
      .digest()
      .toString("hex")}`;

    hashValue2 = `0x${crypto
      .createHash(multihashToNodeHashAlg[hashAlgorithmMultihash])
      .update(crypto.randomBytes(32).toString("hex"), "hex")
      .digest()
      .toString("hex")}`;

    hashValue3 = `0x${crypto
      .createHash(multihashToNodeHashAlg[hashAlgorithmMultihash])
      .update(crypto.randomBytes(32).toString("hex"), "hex")
      .digest()
      .toString("hex")}`;

    ledgerApi = `${configService.get("ledgerApiUrl", { infer: true })}/blockchains/besu`;
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /records", () => {
    it("should return a paginated collection of records", async () => {
      expect.assertions(2);

      const response = await request(server).get("/records");
      expect(response.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining(
            "/records?page[after]=1&page[size]=10",
          ),
          last: expect.stringContaining("/records?page[after]="),
          next: expect.stringContaining("/records?page[after]="),
          prev: expect.stringContaining("/records?page[after]=1&page[size]=10"),
        },
        pageSize: 10,
        self: expect.stringContaining("/records?page[after]=1&page[size]=10"),
        total: expect.any(Number),
      });
      expect(response.status).toBe(200);
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
        totalVersions: expect.any(Number),
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
  });

  describe("GET /records/{recordId}/versions", () => {
    it("should return a paginated collection of versions", async () => {
      expect.assertions(2);

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
            `/records/${recordId}/versions?page[after]=`,
          ),
          next: expect.stringContaining(
            `/records/${recordId}/versions?page[after]=`,
          ),
          prev: expect.stringContaining(
            `/records/${recordId}/versions?page[after]=1&page[size]=10`,
          ),
        },
        pageSize: 10,
        self: expect.stringContaining(
          `/records/${recordId}/versions?page[after]=1&page[size]=10`,
        ),
        total: expect.any(Number),
      });
      expect(response.status).toBe(200);
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

    it("should return an error when the record doesn't exist", async () => {
      expect.assertions(2);

      const randomRecordId = multibase.base64url.encode(crypto.randomBytes(32));

      const response = await request(server).get(
        `/records/${randomRecordId}/versions/0`,
      );

      expect(response.body).toStrictEqual({
        detail: `Record ${randomRecordId} not found`,
        status: 404,
        title: "Record Not Found",
        type: "about:blank",
      });
      expect(response.status).toBe(404);
    });

    it("should return an error when the version doesn't exist", async () => {
      expect.assertions(2);

      const recordId = await getFirstRecordId();
      const versions = await getRecordVersions(recordId);
      const versionId = versions.total;

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

  describeWriteOps().each([
    "timestampRecordHashes",
    "timestampVersionHashes",
    "timestampRecordVersionHashes",
    "insertRecordOwner",
    "revokeRecordOwner",
    "insertRecordVersionInfo",
    "detachRecordVersionHash",
    "appendRecordVersionHashes",
  ])("/jsonrpc - send transaction for %s", (method: string) => {
    it("should work", async () => {
      expect.assertions(5);

      let param: JsonRpcParams;
      switch (method) {
        case "appendRecordVersionHashes": {
          const recordId = ethers.sha256(
            ethers.AbiCoder.defaultAbiCoder().encode(
              ["address", "uint256", "bytes"],
              [testUser.wallet.address, blockNumber1, hashValue1],
            ),
          );
          param = {
            from: testUser.wallet.address,
            hashAlgorithmIds: [hashAlgorithmId, hashAlgorithmId],
            hashValues: [hashValue1, hashValue2],
            recordId,
            timestampData: [
              `0x${Buffer.from(JSON.stringify({ test: 42 }), "utf8").toString(
                "hex",
              )}`,
              `0x${Buffer.from(JSON.stringify({ test: 82 }), "utf8").toString(
                "hex",
              )}`,
              // `0x${crypto.randomBytes(32).toString("hex")}`,
              // `0x${crypto.randomBytes(32).toString("hex")}`,
            ],
            versionId: 0,
            versionInfo: `0x${Buffer.from(
              JSON.stringify({ info: 42 }),
              "utf8",
            ).toString("hex")}`,
          } satisfies AppendRecordVersionHashesSchema;
          break;
        }
        case "detachRecordVersionHash": {
          const recordId = ethers.sha256(
            ethers.AbiCoder.defaultAbiCoder().encode(
              ["address", "uint256", "bytes"],
              [testUser.wallet.address, blockNumber1, hashValue1],
            ),
          );
          param = {
            from: testUser.wallet.address,
            hashValue: hashValue1,
            recordId,
            versionId: 0,
          } satisfies DetachRecordVersionHashSchema;
          break;
        }
        case "insertRecordOwner": {
          const recordId = ethers.sha256(
            ethers.AbiCoder.defaultAbiCoder().encode(
              ["address", "uint256", "bytes"],
              [testUser.wallet.address, blockNumber1, hashValue1],
            ),
          );
          const notBefore = Date.now();
          param = {
            from: testUser.wallet.address,
            notAfter: notBefore + 1_000_000,
            notBefore,
            ownerId: "myownerid",
            recordId,
          } satisfies InsertRecordOwnerSchema;
          break;
        }
        case "insertRecordVersionInfo": {
          const recordId = ethers.sha256(
            ethers.AbiCoder.defaultAbiCoder().encode(
              ["address", "uint256", "bytes"],
              [testUser.wallet.address, blockNumber1, hashValue1],
            ),
          );

          param = {
            from: testUser.wallet.address,
            recordId,
            versionId: 0,
            versionInfo: `0x${Buffer.from(
              JSON.stringify({ test: 42 }),
              "utf8",
            ).toString("hex")}`,
          } satisfies InsertRecordVersionInfoSchema;
          break;
        }
        case "revokeRecordOwner": {
          const recordId = ethers.sha256(
            ethers.AbiCoder.defaultAbiCoder().encode(
              ["address", "uint256", "bytes"],
              [testUser.wallet.address, blockNumber1, hashValue1],
            ),
          );
          param = {
            from: testUser.wallet.address,
            ownerId: "myownerid",
            recordId,
          } satisfies RevokeRecordOwnerSchema;
          break;
        }
        case "timestampRecordHashes": {
          param = {
            from: testUser.wallet.address,
            hashAlgorithmIds: [hashAlgorithmId, hashAlgorithmId],
            hashValues: [hashValue1, hashValue2],
            timestampData: [
              `0x${Buffer.from(JSON.stringify({ test: 42 }), "utf8").toString(
                "hex",
              )}`,
              `0x${Buffer.from(JSON.stringify({ test: 82 }), "utf8").toString(
                "hex",
              )}`,
            ],
            versionInfo: `0x${Buffer.from(
              JSON.stringify({ info: 42 }),
              "utf8",
            ).toString("hex")}`,
          } satisfies TimestampRecordHashesSchema;
          break;
        }
        case "timestampRecordVersionHashes": {
          const recordId = ethers.sha256(
            ethers.AbiCoder.defaultAbiCoder().encode(
              ["address", "uint256", "bytes"],
              [testUser.wallet.address, blockNumber1, hashValue1],
            ),
          );

          param = {
            from: testUser.wallet.address,
            hashAlgorithmIds: [hashAlgorithmId, hashAlgorithmId],
            hashValues: [hashValue1, hashValue2],
            recordId,
            timestampData: [
              `0x${Buffer.from(JSON.stringify({ test: 42 }), "utf8").toString(
                "hex",
              )}`,
              `0x${Buffer.from(JSON.stringify({ test: 82 }), "utf8").toString(
                "hex",
              )}`,
            ],
            versionInfo: `0x${Buffer.from(
              JSON.stringify({ info: 42 }),
              "utf8",
            ).toString("hex")}`,
          } satisfies TimestampRecordVersionHashesSchema;
          break;
        }
        case "timestampVersionHashes": {
          param = {
            from: testUser.wallet.address,
            hashAlgorithmIds: [hashAlgorithmId, hashAlgorithmId],
            hashValues: [hashValue1, hashValue2],
            timestampData: [
              `0x${Buffer.from(JSON.stringify({ test: 42 }), "utf8").toString(
                "hex",
              )}`,
              `0x${Buffer.from(JSON.stringify({ test: 82 }), "utf8").toString(
                "hex",
              )}`,
            ],
            versionHash: hashValue1,
            versionInfo: `0x${Buffer.from(
              JSON.stringify({ info: 42 }),
              "utf8",
            ).toString("hex")}`,
          } satisfies TimestampVersionHashesSchema;
          break;
        }
        default: {
          throw new Error(`Test Error: Invalid method ${method}`);
        }
      }

      const responseBuild: SupertestJsonRpcResponse = await request(server)
        .post("/jsonrpc")
        .auth(testUser.token, { type: "bearer" })
        .send({
          id: 231,
          jsonrpc: "2.0",
          method,
          params: [param],
        });

      expect(responseBuild.body).toStrictEqual({
        id: 231,
        jsonrpc: "2.0",
        result: {
          chainId: expect.any(String),
          data: expect.any(String),
          from: testUser.wallet.address,
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
        unsignedTransaction as UnsignedTransactionSchema,
      );

      const sgnTx = await testUser.wallet.signTransaction(
        uTx as ethers.TransactionLike,
      );
      const signature = ethers.Transaction.from(sgnTx).signature;
      if (!signature) {
        throw new Error("Signature not found");
      }
      const { r, s, v } = signature;

      const responseSend: SupertestJsonRpcResponse = await request(server)
        .post("/jsonrpc")
        .auth(testUser.token, { type: "bearer" })
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

      if (method === "timestampRecordHashes") {
        // we need the blocknumber to be able to compute the recordId
        // created by timestampRecordHashes
        blockNumber1 = receipt.blockNumber;
      }
      expect(receipt.status).toBe("0x1");
    });

    it("should work with empty data", async () => {
      expect.assertions(5);

      let param: JsonRpcParams;

      switch (method) {
        case "appendRecordVersionHashes": {
          const recordId = ethers.sha256(
            ethers.AbiCoder.defaultAbiCoder().encode(
              ["address", "uint256", "bytes"],
              [testUser.wallet.address, blockNumber2, hashValue3],
            ),
          );
          param = {
            from: testUser.wallet.address,
            hashAlgorithmIds: [hashAlgorithmId],
            hashValues: [hashValue3],
            recordId,
            versionId: 0,
            versionInfo: `0x${Buffer.from(
              JSON.stringify({ info: 42 }),
              "utf8",
            ).toString("hex")}`,
          } satisfies AppendRecordVersionHashesSchema;
          break;
        }
        case "detachRecordVersionHash": {
          expect.assertions(0);
          return;
        }
        case "insertRecordOwner": {
          expect.assertions(0);
          return;
        }
        case "insertRecordVersionInfo": {
          expect.assertions(0);
          return;
        }
        case "revokeRecordOwner": {
          expect.assertions(0);
          return;
        }
        case "timestampRecordHashes": {
          param = {
            from: testUser.wallet.address,
            hashAlgorithmIds: [hashAlgorithmId],
            hashValues: [hashValue3],
            versionInfo: `0x${Buffer.from(
              JSON.stringify({ info: 42 }),
              "utf8",
            ).toString("hex")}`,
          } satisfies TimestampRecordHashesSchema;
          break;
        }
        case "timestampRecordVersionHashes": {
          const recordId = ethers.sha256(
            ethers.AbiCoder.defaultAbiCoder().encode(
              ["address", "uint256", "bytes"],
              [testUser.wallet.address, blockNumber2, hashValue3],
            ),
          );

          param = {
            from: testUser.wallet.address,
            hashAlgorithmIds: [hashAlgorithmId],
            hashValues: [hashValue3],
            recordId,
            versionInfo: `0x${Buffer.from(
              JSON.stringify({ info: 42 }),
              "utf8",
            ).toString("hex")}`,
          } satisfies TimestampRecordVersionHashesSchema;
          break;
        }
        case "timestampVersionHashes": {
          param = {
            from: testUser.wallet.address,
            hashAlgorithmIds: [hashAlgorithmId],
            hashValues: [hashValue3],
            versionHash: hashValue3,
            versionInfo: `0x${Buffer.from(
              JSON.stringify({ info: 42 }),
              "utf8",
            ).toString("hex")}`,
          } satisfies TimestampVersionHashesSchema;
          break;
        }
        default: {
          throw new Error(`Test Error: Invalid method ${method}`);
        }
      }

      const responseBuild: SupertestJsonRpcResponse = await request(server)
        .post("/jsonrpc")
        .auth(testUser.token, { type: "bearer" })
        .send({
          id: 231,
          jsonrpc: "2.0",
          method,
          params: [param],
        });

      expect(responseBuild.body).toStrictEqual({
        id: 231,
        jsonrpc: "2.0",
        result: {
          chainId: expect.any(String),
          data: expect.any(String),
          from: testUser.wallet.address,
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
        unsignedTransaction as UnsignedTransactionSchema,
      );

      const sgnTx = await testUser.wallet.signTransaction(
        uTx as ethers.TransactionLike,
      );
      const signature = ethers.Transaction.from(sgnTx).signature;
      if (!signature) {
        throw new Error("Signature not found");
      }
      const { r, s, v } = signature;

      const responseSend: SupertestJsonRpcResponse = await request(server)
        .post("/jsonrpc")
        .auth(testUser.token, { type: "bearer" })
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
      if (method === "timestampRecordHashes") {
        // we need the blocknumber to be able to compute the recordId
        // created by timestampRecordHashes
        blockNumber2 = receipt.blockNumber;
      }
      expect(receipt.status).toBe("0x1");
    });
  });

  describeWriteOps().each([
    "timestampRecordVersionHashes",
    "appendRecordVersionHashes",
  ])("/jsonrpc - send transaction for %s", (method: string) => {
    it("should fail with admin using an user recordId", async () => {
      expect.assertions(6);

      let param: JsonRpcParams;
      switch (method) {
        case "appendRecordVersionHashes": {
          const recordId = ethers.sha256(
            ethers.AbiCoder.defaultAbiCoder().encode(
              ["address", "uint256", "bytes"],
              [testUser.wallet.address, blockNumber1, hashValue1],
            ),
          );
          param = {
            from: adminUser.wallet.address,
            hashAlgorithmIds: [hashAlgorithmId, hashAlgorithmId],
            hashValues: [hashValue1, hashValue2],
            recordId,
            timestampData: [
              `0x${Buffer.from(JSON.stringify({ test: 42 }), "utf8").toString(
                "hex",
              )}`,
              `0x${Buffer.from(JSON.stringify({ test: 82 }), "utf8").toString(
                "hex",
              )}`,
              // `0x${crypto.randomBytes(32).toString("hex")}`,
              // `0x${crypto.randomBytes(32).toString("hex")}`,
            ],
            versionId: 0,
            versionInfo: `0x${Buffer.from(
              JSON.stringify({ info: 42 }),
              "utf8",
            ).toString("hex")}`,
          } satisfies AppendRecordVersionHashesSchema;
          break;
        }
        case "timestampRecordVersionHashes": {
          const recordId = ethers.sha256(
            ethers.AbiCoder.defaultAbiCoder().encode(
              ["address", "uint256", "bytes"],
              [testUser.wallet.address, blockNumber1, hashValue1],
            ),
          );

          param = {
            from: adminUser.wallet.address,
            hashAlgorithmIds: [hashAlgorithmId, hashAlgorithmId],
            hashValues: [hashValue1, hashValue2],
            recordId,
            timestampData: [
              `0x${Buffer.from(JSON.stringify({ test: 42 }), "utf8").toString(
                "hex",
              )}`,
              `0x${Buffer.from(JSON.stringify({ test: 82 }), "utf8").toString(
                "hex",
              )}`,
            ],
            versionInfo: `0x${Buffer.from(
              JSON.stringify({ info: 42 }),
              "utf8",
            ).toString("hex")}`,
          } satisfies TimestampRecordVersionHashesSchema;
          break;
        }
        default: {
          throw new Error(`Test Error: Invalid method ${method}`);
        }
      }

      const responseBuild: SupertestJsonRpcResponse = await request(server)
        .post("/jsonrpc")
        .auth(adminUser.token, { type: "bearer" })
        .send({
          id: 231,
          jsonrpc: "2.0",
          method,
          params: [param],
        });

      expect(responseBuild.body).toStrictEqual({
        id: 231,
        jsonrpc: "2.0",
        result: {
          chainId: expect.any(String),
          data: expect.any(String),
          from: adminUser.wallet.address,
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
        unsignedTransaction as UnsignedTransactionSchema,
      );

      const sgnTx = await adminUser.wallet.signTransaction(
        uTx as ethers.TransactionLike,
      );
      const signature = ethers.Transaction.from(sgnTx).signature;
      if (!signature) {
        throw new Error("Signature not found");
      }
      const { r, s, v } = signature;

      const responseSend: SupertestJsonRpcResponse = await request(server)
        .post("/jsonrpc")
        .auth(adminUser.token, { type: "bearer" })
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

      expect(receipt.revertReason).toBe(`sender is not listed as owner`);
      expect(receipt.status).toBe("0x0");
    });
  });

  itWriteOps()(
    "should reject impersonating transactions: admin wallet using jwt from user",
    async () => {
      expect.assertions(2);

      const param = {
        from: adminUser.wallet.address,
        hashAlgorithmIds: [hashAlgorithmId, hashAlgorithmId],
        hashValues: [hashValue1, hashValue2],
        timestampData: [
          `0x${Buffer.from(JSON.stringify({ test: 42 }), "utf8").toString(
            "hex",
          )}`,
          `0x${Buffer.from(JSON.stringify({ test: 82 }), "utf8").toString(
            "hex",
          )}`,
        ],
        versionInfo: `0x${Buffer.from(
          JSON.stringify({ info: 42 }),
          "utf8",
        ).toString("hex")}`,
      } satisfies TimestampRecordHashesSchema;

      const responseBuild: SupertestJsonRpcResponse = await request(server)
        .post("/jsonrpc")
        .auth(testUser.token, { type: "bearer" })
        .send({
          id: 231,
          jsonrpc: "2.0",
          method: "timestampRecordHashes",
          params: [param],
        });

      const unsignedTransaction = responseBuild.body.result;
      const uTx = formatEthersUnsignedTransaction(
        unsignedTransaction as UnsignedTransactionSchema,
      );

      const sgnTx = await adminUser.wallet.signTransaction(
        uTx as ethers.TransactionLike,
      );
      const signature = ethers.Transaction.from(sgnTx).signature;
      if (!signature) {
        throw new Error("Signature not found");
      }
      const { r, s, v } = signature;

      const responseSend: SupertestJsonRpcResponse = await request(server)
        .post("/jsonrpc")
        .auth(testUser.token, { type: "bearer" })
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
        error: {
          code: -32_600,
          message: `The DID ${
            testUser.info.did
          } is not controlled by the address ${adminUser.wallet.address.toLowerCase()}`,
        },
        id: "45",
        jsonrpc: "2.0",
      });

      expect(responseSend.status).toBe(400);
    },
  );

  // Tests to verify that only record owners can update the records
  describeWriteOps().each([
    "insertRecordOwner",
    "insertRecordVersionInfo",
    "detachRecordVersionHash",
    "timestampRecordVersionHashes",
    "appendRecordVersionHashes",
    "revokeRecordOwner",
  ])("record owners test suite for method %s", (method: string) => {
    it("should fail when trying to invoke sendSignedTransaction", async () => {
      expect.assertions(6);
      const insertParam: JsonRpcParams = {
        from: adminUser.wallet.address,
        hashAlgorithmIds: [hashAlgorithmId, hashAlgorithmId],
        hashValues: [hashValue1, hashValue2],
        timestampData: [
          `0x${Buffer.from(JSON.stringify({ test: 42 }), "utf8").toString(
            "hex",
          )}`,
          `0x${Buffer.from(JSON.stringify({ test: 82 }), "utf8").toString(
            "hex",
          )}`,
        ],
        versionInfo: `0x${Buffer.from(
          JSON.stringify({ info: 42 }),
          "utf8",
        ).toString("hex")}`,
      } satisfies TimestampRecordHashesSchema;

      const insertResponseBuild: SupertestJsonRpcResponse = await request(
        server,
      )
        .post("/jsonrpc")
        .auth(adminUser.token, { type: "bearer" })
        .send({
          id: 231,
          jsonrpc: "2.0",
          method: "timestampRecordHashes",
          params: [insertParam],
        });

      const insertUnsignedTransaction = insertResponseBuild.body.result;
      const insertUTx = formatEthersUnsignedTransaction(
        insertUnsignedTransaction as UnsignedTransactionSchema,
      );
      insertUTx.chainId = Number(insertUTx.chainId);
      const insertSgnTx = await adminUser.wallet.signTransaction(
        insertUTx as ethers.TransactionLike,
      );
      const parseTransactionResponse =
        ethers.Transaction.from(insertSgnTx).signature;

      if (!parseTransactionResponse) {
        throw new Error("Signature not found");
      }

      const insertResponseSend: SupertestJsonRpcResponse = await request(server)
        .post("/jsonrpc")
        .auth(adminUser.token, { type: "bearer" })
        .send({
          id: "45",
          jsonrpc: "2.0",
          method: "sendSignedTransaction",
          params: [
            {
              protocol: "eth",
              r: parseTransactionResponse.r,
              s: parseTransactionResponse.s,
              signedRawTransaction: insertSgnTx,
              unsignedTransaction: insertUnsignedTransaction,
              v: `0x${Number(parseTransactionResponse.v).toString(16)}`,
            },
          ],
        });
      expect(insertResponseSend.status).toBe(HttpStatus.OK);
      let param: JsonRpcParams;

      // wait to be mined
      await waitToBeMined(ledgerApi, insertResponseSend.body.result as string);

      const response = await request(server).get("/records");
      expect((response.body as { items: string }).items).not.toHaveLength(0);
      expect(response.status).toBe(200);
      const responseLast = await request(server).get(
        (response.body as PaginatedList<unknown>).links?.last.split("v4")[1] ??
          "",
      );

      const { recordId } = (responseLast.body as { items: string }).items.at(
        -1,
      ) as unknown as RecordLink;

      const decodedRecordId = `0x${Buffer.from(
        multibase.base64url.decode(recordId),
      ).toString("hex")}`;

      switch (method) {
        case "appendRecordVersionHashes": {
          param = {
            from: testUser.wallet.address,
            hashAlgorithmIds: [hashAlgorithmId, hashAlgorithmId],
            hashValues: [hashValue1, hashValue2],
            recordId: decodedRecordId,
            timestampData: [
              `0x${Buffer.from(JSON.stringify({ test: 42 }), "utf8").toString(
                "hex",
              )}`,
              `0x${Buffer.from(JSON.stringify({ test: 82 }), "utf8").toString(
                "hex",
              )}`,
              // `0x${crypto.randomBytes(32).toString("hex")}`,
              // `0x${crypto.randomBytes(32).toString("hex")}`,
            ],
            versionId: 0,
            versionInfo: `0x${Buffer.from(
              JSON.stringify({ info: 42 }),
              "utf8",
            ).toString("hex")}`,
          } satisfies AppendRecordVersionHashesSchema;
          break;
        }
        case "detachRecordVersionHash": {
          param = {
            from: testUser.wallet.address,
            hashValue: hashValue1,
            recordId: decodedRecordId,
            versionId: 0,
          } satisfies DetachRecordVersionHashSchema;
          break;
        }
        case "insertRecordOwner": {
          const notBefore = Date.now();
          param = {
            from: testUser.wallet.address,
            notAfter: notBefore + 1_000_000,
            notBefore,
            ownerId: "myownerid",
            recordId: decodedRecordId,
          } satisfies InsertRecordOwnerSchema;
          break;
        }
        case "insertRecordVersionInfo": {
          param = {
            from: testUser.wallet.address,
            recordId: decodedRecordId,
            versionId: 0,
            versionInfo: `0x${Buffer.from(
              JSON.stringify({ test: 42 }),
              "utf8",
            ).toString("hex")}`,
          } satisfies InsertRecordVersionInfoSchema;
          break;
        }
        case "revokeRecordOwner": {
          param = {
            from: testUser.wallet.address,
            ownerId: "myownerid",
            recordId: decodedRecordId,
          } satisfies RevokeRecordOwnerSchema;
          break;
        }
        case "timestampRecordVersionHashes": {
          param = {
            from: testUser.wallet.address,
            hashAlgorithmIds: [hashAlgorithmId, hashAlgorithmId],
            hashValues: [hashValue1, hashValue2],
            recordId: decodedRecordId,
            timestampData: [
              `0x${Buffer.from(JSON.stringify({ test: 42 }), "utf8").toString(
                "hex",
              )}`,
              `0x${Buffer.from(JSON.stringify({ test: 82 }), "utf8").toString(
                "hex",
              )}`,
            ],
            versionInfo: `0x${Buffer.from(
              JSON.stringify({ info: 42 }),
              "utf8",
            ).toString("hex")}`,
          } satisfies TimestampRecordVersionHashesSchema;
          break;
        }
        default: {
          throw new Error(`Test Error: Invalid method ${method}`);
        }
      }

      const responseBuild: SupertestJsonRpcResponse = await request(server)
        .post("/jsonrpc")
        .auth(testUser.token, { type: "bearer" })
        .send({
          id: 231,
          jsonrpc: "2.0",
          method,
          params: [param],
        });

      expect(responseBuild.body).toStrictEqual({
        id: 231,
        jsonrpc: "2.0",
        result: {
          chainId: expect.any(String),
          data: expect.any(String),
          from: testUser.wallet.address,
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
        unsignedTransaction as UnsignedTransactionSchema,
      );

      const sgnTx = await testUser.wallet.signTransaction(
        uTx as ethers.TransactionLike,
      );
      const signature = ethers.Transaction.from(sgnTx).signature;
      if (!signature) {
        throw new Error("Signature not found");
      }
      const { r, s, v } = signature;

      const responseSend: SupertestJsonRpcResponse = await request(server)
        .post("/jsonrpc")
        .auth(testUser.token, { type: "bearer" })
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

      // wait to be mined
      const receipt = await waitToBeMined(
        ledgerApi,
        responseSend.body.result as string,
      );
      expect(receipt).toStrictEqual(
        expect.objectContaining({
          revertReason: expect.stringContaining(
            `sender is not listed as owner`,
          ),
          status: "0x0",
        }),
      );
    });
  });
});
