import type { HashName } from "@ebsiint-api/shared";
import type { EbsiIssuer } from "@europeum-ebsi/verifiable-credential";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { RawServerDefault } from "fastify";

import { prefixWith0x, waitToBeMined } from "@ebsiint-api/shared";
import { ConfigService } from "@nestjs/config";
import { ethers } from "ethers";
import { randomInt } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { ApiConfig } from "../../src/config/configuration.ts";
import type { HashAlgorithmLink } from "../../src/modules/hash-algorithms/hash-algorithms.interface.ts";
import type { JsonRpcResponseObject } from "../../src/modules/jsonrpc/jsonrpc.interface.ts";
import type { InsertHashAlgorithmSchema } from "../../src/modules/jsonrpc/validators/RequestInsertHashAlgorithm.ts";
import type { UpdateHashAlgorithmSchema } from "../../src/modules/jsonrpc/validators/RequestUpdateHashAlgorithm.ts";
import type { UnsignedTransactionSchema } from "../../src/modules/jsonrpc/validators/UnsignedTransaction.ts";

import { AppModule } from "../../src/app.module.ts";
import { formatEthersUnsignedTransaction } from "../../src/modules/jsonrpc/jsonrpc.utils.ts";
import { getNestFastifyApplication } from "../utils/app.ts";
import { getTimestampWriteAccessToken } from "../utils/getAccessToken.ts";
import { getEbsiIssuer } from "../utils/getEbsiIssuer.ts";
import { getServer } from "../utils/getServer.ts";
import { describeWriteOps, itWriteOps, writeOps } from "../utils/writeOps.ts";

type JsonRpcParams =
  | InsertHashAlgorithmSchema
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

const newHashAlgorithm = {
  ianaName: `test-${Date.now()}`,
  multiHash: "sha2-256",
  oid: "2.16.840.1.101.3.4.2.1",
  outputLength: 256,
} as const satisfies {
  ianaName: string;
  multiHash: HashName;
  oid: string;
  outputLength: number;
};

describe("Timestamp API v4 - HashAlgorithms (e2e)", () => {
  let app: NestFastifyApplication;
  let server: RawServerDefault | string;
  let authorisationApiUrl: string;
  let adminUser: TestUser;
  let testUser: TestUser;

  let ledgerApi: string;

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

    ledgerApi = `${configService.get("ledgerApiUrl", { infer: true })}/blockchains/besu`;
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /hash-algorithms", () => {
    it("should return a paginated collection of hash algorithms", async () => {
      expect.assertions(2);

      const response = await request(server).get("/hash-algorithms");
      expect(response.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining(
            "/hash-algorithms?page[after]=1&page[size]=10",
          ),
          last: expect.stringContaining("/hash-algorithms?page[after]="),
          next: expect.stringContaining("/hash-algorithms?page[after]="),
          prev: expect.stringContaining(
            "/hash-algorithms?page[after]=1&page[size]=10",
          ),
        },
        pageSize: 10,
        self: expect.stringContaining(
          "/hash-algorithms?page[after]=1&page[size]=10",
        ),
        total: expect.any(Number),
      });
      expect(response.status).toBe(200);
    });
  });

  describe("GET /hash-algorithms/{hashAlgorithmId}", () => {
    it("should return a specific hash algorithm", async () => {
      expect.assertions(2);

      const respHashAlgorithms = await request(server).get("/hash-algorithms");
      const { hashAlgorithmId } = (
        respHashAlgorithms.body as {
          items: HashAlgorithmLink[];
        }
      ).items[0]!;

      const response = await request(server).get(
        `/hash-algorithms/${hashAlgorithmId}`,
      );

      expect(response.body).toStrictEqual({
        ianaName: expect.any(String),
        multihash: expect.any(String),
        oid: expect.any(String),
        outputLengthBits: expect.any(Number),
        status: expect.any(String),
      });
      expect(response.status).toBe(200);
    });

    it("should throw an error if the hash algorithm is not found", async () => {
      expect.assertions(2);

      const hashAlgorithmId = randomInt(10_000) + 10_000; // some random number between 10,000 and 20,000

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

  describeWriteOps().each([
    "insertHashAlgorithm",
    "updateHashAlgorithm",
  ] as const)(
    "/jsonrpc - send transaction for %s",
    (method: "insertHashAlgorithm" | "updateHashAlgorithm") => {
      it("should work", async () => {
        expect.assertions(5);

        let params: JsonRpcParams;
        const { ianaName, multiHash, oid, outputLength } = newHashAlgorithm;

        switch (method) {
          case "insertHashAlgorithm": {
            params = {
              from: adminUser.wallet.address,
              ianaName,
              multiHash,
              oid,
              outputLength,
              status: 1,
            } satisfies InsertHashAlgorithmSchema;
            break;
          }
          case "updateHashAlgorithm": {
            const response = await request(server).get("/hash-algorithms");
            const hashAlgorithmId =
              (response.body as { total: number }).total - 1;

            params = {
              from: adminUser.wallet.address,
              hashAlgorithmId,
              ianaName,
              multiHash,
              oid,
              outputLength,
              status: 1,
            } satisfies UpdateHashAlgorithmSchema;
            break;
          }
          default: {
            // Never happens
            throw new Error("Unsupported method");
          }
        }

        const responseBuild: SupertestJsonRpcResponse = await request(server)
          .post("/jsonrpc")
          .auth(adminUser.token, { type: "bearer" })
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
        expect(receipt.status).toBe("0x1");
      });
    },
  );

  describeWriteOps().each([
    "insertHashAlgorithm",
    "updateHashAlgorithm",
  ] as const)(
    "/jsonrpc - send transaction for %s",
    (method: "insertHashAlgorithm" | "updateHashAlgorithm") => {
      it("should not work with testUser data", async () => {
        expect.assertions(6);

        let params: JsonRpcParams;
        const { ianaName, multiHash, oid, outputLength } = newHashAlgorithm;

        switch (method) {
          case "insertHashAlgorithm": {
            params = {
              from: testUser.wallet.address,
              ianaName,
              multiHash,
              oid,
              outputLength,
              status: 1,
            } satisfies InsertHashAlgorithmSchema;
            break;
          }
          case "updateHashAlgorithm": {
            const response = await request(server).get("/hash-algorithms");
            const hashAlgorithmId =
              (response.body as { total: number }).total - 1;

            params = {
              from: testUser.wallet.address,
              hashAlgorithmId,
              ianaName,
              multiHash,
              oid,
              outputLength,
              status: 1,
            } satisfies UpdateHashAlgorithmSchema;
            break;
          }
          default: {
            // Never happens
            throw new Error("Unsupported method");
          }
        }

        const responseBuild: SupertestJsonRpcResponse = await request(server)
          .post("/jsonrpc")
          .auth(testUser.token, { type: "bearer" })
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

        expect(receipt.revertReason).toBe(
          `Policy error: sender doesn't have the attribute TS:${method}`,
        );
        expect(receipt.status).toBe("0x0");
      });
    },
  );

  itWriteOps()(
    "should reject impersonating transactions: admin wallet using jwt from user",
    async () => {
      expect.assertions(2);

      const { ianaName, multiHash, oid, outputLength } = newHashAlgorithm;

      const param = {
        from: adminUser.wallet.address,
        ianaName,
        multiHash,
        oid,
        outputLength,
        status: 1,
      } satisfies InsertHashAlgorithmSchema;

      const responseBuild: SupertestJsonRpcResponse = await request(server)
        .post("/jsonrpc")
        .auth(testUser.token, { type: "bearer" })
        .send({
          id: 231,
          jsonrpc: "2.0",
          method: "insertHashAlgorithm",
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
});
