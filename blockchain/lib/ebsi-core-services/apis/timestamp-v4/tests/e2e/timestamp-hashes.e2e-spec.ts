import type { EbsiIssuer } from "@europeum-ebsi/verifiable-credential";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { RawServerDefault } from "fastify";

import {
  multibase,
  multihashEncode,
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
import type { InsertHashAlgorithmSchema } from "../../src/modules/jsonrpc/validators/RequestInsertHashAlgorithm.ts";
import type { TimestampHashesSchema } from "../../src/modules/jsonrpc/validators/RequestTimestampHashes.ts";
import type { UpdateHashAlgorithmSchema } from "../../src/modules/jsonrpc/validators/RequestUpdateHashAlgorithm.ts";
import type { UnsignedTransactionSchema } from "../../src/modules/jsonrpc/validators/UnsignedTransaction.ts";

import { AppModule } from "../../src/app.module.ts";
import { formatEthersUnsignedTransaction } from "../../src/modules/jsonrpc/jsonrpc.utils.ts";
import { getNestFastifyApplication } from "../utils/app.ts";
import { getTimestampWriteAccessToken } from "../utils/getAccessToken.ts";
import { getEbsiIssuer } from "../utils/getEbsiIssuer.ts";
import { getServer } from "../utils/getServer.ts";
import { describeWriteOps, writeOps } from "../utils/writeOps.ts";

type JsonRpcParams =
  | InsertHashAlgorithmSchema
  | TimestampHashesSchema
  | UnsignedTransactionSchema
  | UpdateHashAlgorithmSchema;

interface SupertestJsonRpcResponse {
  body: JsonRpcResponseObject;
  status: number;
}

interface TestUser {
  info: EbsiIssuer;
  token: string;
  wallet: ethers.BaseWallet;
}

const multihashToNodeHashAlg = {
  "sha2-256": "sha256",
  "sha2-512": "sha512",
  "sha3-224": "sha3-224",
  "sha3-256": "sha3-256",
  "sha3-384": "sha3-384",
  "sha3-512": "sha3-512",
} as const;

describe("Timestamp API v4 - Timestamp (e2e)", () => {
  let app: NestFastifyApplication;
  let server: RawServerDefault | string;
  let hashAlgorithmId: number;
  let hashAlgorithmMultihash: keyof typeof multihashToNodeHashAlg;
  let hashValue1: string;
  let hashValue2: string;
  let ledgerApi: string;
  let sampleTransaction: string;
  let authorisationApiUrl: string;
  let adminUser: TestUser;
  let testUser: TestUser;
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

    const configBlockscout = configService.get("blockscout", { infer: true });

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

    blockscout = configBlockscout;

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

    ledgerApi = `${configService.get("ledgerApiUrl", { infer: true })}/blockchains/besu`;
  });

  afterAll(async () => {
    await app.close();
  });

  describeWriteOps().each(["timestampHashes"])(
    "/jsonrpc - send transaction for %s",
    (method: string) => {
      it("should work", async () => {
        expect.assertions(5);

        let param: JsonRpcParams;

        switch (method) {
          case "timestampHashes": {
            param = {
              from: testUser.wallet.address,
              hashAlgorithmIds: [hashAlgorithmId, hashAlgorithmId],
              hashValues: [hashValue1, hashValue2],
              timestampData: [
                `0x${Buffer.from(
                  JSON.stringify({ test: 742 }),
                  "utf8",
                ).toString("hex")}`,
                `0x${Buffer.from(
                  JSON.stringify({ test: 842 }),
                  "utf8",
                ).toString("hex")}`,
              ],
            } satisfies TimestampHashesSchema;
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
        expect(receipt.status).toBe("0x1");
        sampleTransaction = responseSend.body.result as string;
      });

      it("should work with empty data", async () => {
        expect.assertions(5);

        let param: JsonRpcParams;

        switch (method) {
          case "timestampHashes": {
            param = {
              from: testUser.wallet.address,
              hashAlgorithmIds: [hashAlgorithmId, hashAlgorithmId],
              hashValues: [hashValue1, hashValue2],
            } satisfies TimestampHashesSchema;
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
        expect(receipt.status).toBe("0x1");
      });

      it("should reject impersonating transactions: admin wallet using jwt from user", async () => {
        expect.assertions(2);

        let param: JsonRpcParams;

        switch (method) {
          case "timestampHashes": {
            param = {
              from: adminUser.wallet.address,
              hashAlgorithmIds: [hashAlgorithmId, hashAlgorithmId],
              hashValues: [hashValue1, hashValue2],
              timestampData: [
                `0x${Buffer.from(
                  JSON.stringify({ test: 742 }),
                  "utf8",
                ).toString("hex")}`,
                `0x${Buffer.from(
                  JSON.stringify({ test: 842 }),
                  "utf8",
                ).toString("hex")}`,
              ],
            } satisfies TimestampHashesSchema;
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

  describe("GET /timestamps", () => {
    it("should return a paginated collection of timestamps", async () => {
      expect.assertions(2);

      const response = await request(server).get("/timestamps");
      expect(response.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining(
            "/timestamps?page[after]=1&page[size]=10",
          ),
          last: expect.stringContaining("/timestamps?page[after]="),
          next: expect.stringContaining("/timestamps?page[after]="),
          prev: expect.stringContaining(
            "/timestamps?page[after]=1&page[size]=10",
          ),
        },
        pageSize: 10,
        self: expect.stringContaining(
          "/timestamps?page[after]=1&page[size]=10",
        ),
        total: expect.any(Number),
      });
      expect(response.status).toBe(200);
    });
  });

  describe("GET /timestamps/{timestampId}", () => {
    describeWriteOps()("Test requiring actual data", () => {
      it("should return a specific timestamp", async () => {
        expect.assertions(2);

        const timestampId = multibase.base64url.encode(
          multihashEncode(
            ethers.sha256(hashValue1).replace(/^0x/, ""),
            "sha2-256",
            32,
          ),
        );

        const response = await request(server).get(
          `/timestamps/${timestampId}`,
        );

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
    });

    it("should throw an error if the record is not found", async () => {
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
