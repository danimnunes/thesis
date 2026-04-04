import type { Timestamp } from "@ebsiint-sc/timestamp-v4";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { HardhatEthersProvider } from "@nomicfoundation/hardhat-ethers/internal/hardhat-ethers-provider.js";
import type { RawServerDefault } from "fastify";
import type { GenerateKeyPairResult } from "jose";

import { Timestamp__factory } from "@ebsiint-sc/timestamp-v4";
import { ConfigService } from "@nestjs/config";
import { ethers } from "ethers";
import {
  calculateJwkThumbprint,
  exportJWK,
  generateKeyPair,
  SignJWT,
} from "jose";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import crypto from "node:crypto";
import request from "supertest";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type { UserDetails } from "../../../tests/utils/data.ts";
import type { ApiConfig } from "../../config/configuration.ts";
import type { JsonRpcResponseObject } from "./jsonrpc.interface.ts";
import type { AppendRecordVersionHashesSchema } from "./validators/RequestAppendRecordVersionHashes.ts";
import type { DetachRecordVersionHashSchema } from "./validators/RequestDetachRecordVersionHashes.ts";
import type { InsertHashAlgorithmSchema } from "./validators/RequestInsertHashAlgorithm.ts";
import type { InsertRecordOwnerSchema } from "./validators/RequestInsertRecordOwner.ts";
import type { InsertRecordVersionInfoSchema } from "./validators/RequestInsertRecordVersionInfo.ts";
import type { RevokeRecordOwnerSchema } from "./validators/RequestRevokeRecordOwner.ts";
import type { TimestampHashesSchema } from "./validators/RequestTimestampHashes.ts";
import type { TimestampRecordHashesSchema } from "./validators/RequestTimestampRecordHashes.ts";
import type { TimestampRecordVersionHashesSchema } from "./validators/RequestTimestampRecordVersionHashes.ts";
import type { TimestampVersionHashesSchema } from "./validators/RequestTimestampVersionHashes.ts";
import type { UpdateHashAlgorithmSchema } from "./validators/RequestUpdateHashAlgorithm.ts";
import type { UnsignedTransactionSchema } from "./validators/UnsignedTransaction.ts";

import { getNestFastifyApplication } from "../../../tests/utils/app.ts";
import { createUser } from "../../../tests/utils/data.ts";
import {
  multihashToNodeHashAlg,
  setupTestEnv,
} from "../../../tests/utils/timestamp.ts";
import { LedgerService } from "../ledger/ledger.service.ts";
import { JsonRpcModule } from "./jsonrpc.module.ts";
import { formatEthersUnsignedTransaction } from "./jsonrpc.utils.ts";

type JsonRpcParams =
  | AppendRecordVersionHashesSchema
  | DetachRecordVersionHashSchema
  | InsertHashAlgorithmSchema
  | InsertRecordOwnerSchema
  | InsertRecordVersionInfoSchema
  | RevokeRecordOwnerSchema
  | TimestampHashesSchema
  | TimestampRecordHashesSchema
  | TimestampRecordVersionHashesSchema
  | TimestampVersionHashesSchema
  | UnsignedTransactionSchema
  | UpdateHashAlgorithmSchema;

interface SupertestJsonRpcResponse {
  body: JsonRpcResponseObject;
  status: number;
}

/**
 * Escape DID in URLs mocked by MSW
 * @see https://github.com/mswjs/msw/discussions/739#discussioncomment-2524732
 */
function escapeDid(url: string) {
  return url.replace("did:ebsi:", String.raw`did\:ebsi\:`);
}

describe("JSON-RPC Module", () => {
  let app: NestFastifyApplication;
  let configService: ConfigService<ApiConfig, true>;
  let server: RawServerDefault;
  let timestampContract: Timestamp;
  let testEnv: Awaited<ReturnType<typeof setupTestEnv>>;
  let firstHashValue: string;
  let secondHashValue: string;
  let recordId: string;
  let blockNumber = 0;
  let provider: HardhatEthersProvider;
  let newUserTimestampWriteAccessToken: string;
  let adminUserTimestampWriteAccessToken: string;
  let fakeUserTimestampWriteAccessToken: string;
  let newUser: UserDetails;
  let authApiKeyPair: GenerateKeyPairResult;
  let authApiKid: string;

  const testAdmin = {
    did: "did:ebsi:admin",
    token: "",
    wallet: ethers.Wallet.createRandom(),
  };
  const testUser = {
    did: "did:ebsi:user",
    token: "",
    wallet: ethers.Wallet.createRandom(),
  };
  const testFakeUser = {
    did: "did:ebsi:fakeuser",
    token: "",
    wallet: ethers.Wallet.createRandom(),
  };

  const mockServer = setupServer();

  beforeAll(async () => {
    // Intercept network requests
    mockServer.listen({
      onUnhandledRequest: ({ url }, print) => {
        // Bypass local requests
        if (new URL(url).hostname === "127.0.0.1") return;

        print.error();
      },
    });

    // Spin up test blockchain (hardhat)
    testEnv = await setupTestEnv();
    timestampContract = testEnv.timestampContract;
    provider = testEnv.provider;

    const timestampContractAddress = await timestampContract.getAddress();

    vi.stubEnv("CONTRACT_ADDR", timestampContractAddress);

    // Mock Timestamp contract
    vi.spyOn(Timestamp__factory, "connect").mockImplementation(() =>
      // Create new instance without runner (provider)
      timestampContract.connect(),
    );

    // Mock LedgerService
    vi.spyOn(LedgerService.prototype, "getProvider").mockImplementation(
      // @ts-expect-error Error due to a mismatch between ESM and CommonJS modules
      () => provider,
    );

    newUser = await createUser();

    // Generate key pair for Authorisation API v4 and create access token
    authApiKeyPair = await generateKeyPair("ES256");
    const publicKeyJwk = await exportJWK(authApiKeyPair.publicKey);
    authApiKid = await calculateJwkThumbprint(publicKeyJwk);

    newUserTimestampWriteAccessToken = await new SignJWT({
      scp: "openid timestamp_write",
      sub: testUser.did,
    })
      .setProtectedHeader({
        alg: "ES256",
        kid: authApiKid,
        typ: "JWT",
      })
      .sign(authApiKeyPair.privateKey);

    adminUserTimestampWriteAccessToken = await new SignJWT({
      scp: "openid timestamp_write",
      sub: testAdmin.did,
    })
      .setProtectedHeader({
        alg: "ES256",
        kid: authApiKid,
        typ: "JWT",
      })
      .sign(authApiKeyPair.privateKey);

    fakeUserTimestampWriteAccessToken = await new SignJWT({
      scp: "openid timestamp_write",
      sub: testFakeUser.did,
    })
      .setProtectedHeader({
        alg: "ES256",
        kid: authApiKid,
        typ: "JWT",
      })
      .sign(authApiKeyPair.privateKey);

    // For now all users have same token just for testing
    testAdmin.token = adminUserTimestampWriteAccessToken;
    testUser.token = newUserTimestampWriteAccessToken;
    testFakeUser.token = fakeUserTimestampWriteAccessToken;

    firstHashValue = `0x${crypto
      .createHash(multihashToNodeHashAlg[testEnv.hashAlgorithms[0]!.multihash])
      .update(crypto.randomBytes(32).toString("hex"), "hex")
      .digest()
      .toString("hex")}`;

    secondHashValue = `0x${crypto
      .createHash(multihashToNodeHashAlg[testEnv.hashAlgorithms[0]!.multihash])
      .update(crypto.randomBytes(32).toString("hex"), "hex")
      .digest()
      .toString("hex")}`;

    // Start server
    app = await getNestFastifyApplication({
      imports: [JsonRpcModule],
    });

    configService = app.get<ConfigService<ApiConfig, true>>(ConfigService);

    await app.init();
    const fastifyInstance = app.getHttpAdapter().getInstance();
    await fastifyInstance.ready();
    server = app.getHttpServer();

    // Mock Auth API
    const authorisationApiUrl = configService.get("authorisationApiUrl", {
      infer: true,
    });

    mockServer.use(
      // Mock Auth API /.well-known/openid-configuration endpoint
      http.get(
        `${authorisationApiUrl}/.well-known/openid-configuration`,
        ({ request }) => {
          // Make sure the request has the x-request-id header
          if (!request.headers.has("x-request-id")) {
            return HttpResponse.json(
              "Invalid request (missing x-request-id header)",
              { status: 400 },
            );
          }

          return HttpResponse.json({ jwks_uri: `${authorisationApiUrl}/jwks` });
        },
      ),
      // Mock Auth API /jwks endpoint
      http.get(`${authorisationApiUrl}/jwks`, ({ request }) => {
        // Make sure the request has the x-request-id header
        if (!request.headers.has("x-request-id")) {
          return HttpResponse.json(
            "Invalid request (missing x-request-id header)",
            { status: 400 },
          );
        }

        return HttpResponse.json({
          keys: [{ ...publicKeyJwk, kid: authApiKid }],
        });
      }),
    );
  });

  beforeEach(() => {
    // Mock DIDR API
    const didRegistryApiUrl = configService.get("didRegistryApiUrl", {
      infer: true,
    });
    mockServer.use(
      // Mock DIDR API /identifiers/:did/actions endpoint
      http.post(
        `${didRegistryApiUrl}/identifiers/:did/actions`,
        async (info) => {
          const { did } = info.params;
          const requestBody = (await info.request.json()) as {
            params: string[];
          };
          const address = requestBody.params[0]!;

          const result =
            (testAdmin.did === did &&
              testAdmin.wallet.address.toLocaleLowerCase() ===
                address.toLocaleLowerCase()) ||
            (testUser.did === did &&
              testUser.wallet.address.toLocaleLowerCase() ===
                address.toLocaleLowerCase());

          return HttpResponse.json({ jsonrpc: "2.0", result });
        },
      ),
    );
  });

  afterAll(async () => {
    mockServer.close();

    await app.close();
  });

  describe("JWT Authentication", () => {
    it("should reject a POST without JWT", async () => {
      expect.assertions(3);

      const response = await request(server).post("/jsonrpc").send();

      expect(response.body).toStrictEqual({
        detail: "Invalid or missing JWT",
        status: 401,
        title: "Unauthorized",
        type: "about:blank",
      });
      expect(response.status).toBe(401);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));
    });

    it("should reject a POST with an invalid token", async () => {
      expect.assertions(3);

      const response = await request(server)
        .post("/jsonrpc")
        .auth("very.bad.token.123.abc", { type: "bearer" })
        .send();

      expect(response.body).toStrictEqual({
        detail:
          "Invalid Authorisation Token: Only JWTs using Compact JWS serialization can be decoded",
        status: 401,
        title: "Unauthorized",
        type: "about:blank",
      });
      expect(response.status).toBe(401);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));
    });

    it("should reject a POST with an invalid access token", async () => {
      expect.assertions(6);

      const signer = await generateKeyPair("ES256");
      const kid = await calculateJwkThumbprint(
        await exportJWK(signer.publicKey),
      );
      const accessTokenWithInvalidKid = await new SignJWT({
        scp: "openid timestampt_write",
        sub: newUser.did,
      })
        .setProtectedHeader({
          alg: "ES256",
          kid,
          typ: "JWT",
        })
        .sign(signer.privateKey);

      let response = await request(server)
        .post("/jsonrpc")
        .auth(accessTokenWithInvalidKid, { type: "bearer" })
        .send();

      expect(response.body).toStrictEqual({
        detail:
          "Invalid Access Token. Couldn't find a public key related to the given kid.",
        status: 401,
        title: "Unauthorized",
        type: "about:blank",
      });
      expect(response.status).toBe(401);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));

      const accessTokenWithInvalidSignature = await new SignJWT({
        scp: "openid timestampt_write",
        sub: newUser.did,
      })
        .setProtectedHeader({
          alg: "ES256",
          kid: authApiKid,
          typ: "JWT",
        })
        .sign(signer.privateKey);

      response = await request(server)
        .post("/jsonrpc")
        .auth(accessTokenWithInvalidSignature, { type: "bearer" })
        .send();

      expect(response.body).toStrictEqual({
        detail: "Access Token signature validation failed",
        status: 401,
        title: "Unauthorized",
        type: "about:blank",
      });
      expect(response.status).toBe(401);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));
    });
  });

  it("should throw an error if the DID does not exist", async () => {
    expect.assertions(4);

    // The DID does not exist
    mockServer.use(
      http.post(
        escapeDid(
          `${configService.get("didRegistryApiUrl", { infer: true })}/identifiers/${testAdmin.did}/actions`,
        ),
        () =>
          HttpResponse.json(
            {
              error: { code: -32_600, message: "did doesn't exist" },
              // eslint-disable-next-line unicorn/no-null
              id: null,
              jsonrpc: "2.0",
            },
            { status: 400 },
          ),
      ),
    );

    const param = {
      from: testAdmin.wallet.address,
      hashAlgorithmIds: [0],
      hashValues: [secondHashValue],
    };

    const responseBuild: SupertestJsonRpcResponse = await request(server)
      .post("/jsonrpc")
      .auth(testAdmin.token, { type: "bearer" })
      .send({
        id: 231,
        jsonrpc: "2.0",
        method: "timestampHashes",
        params: [param],
      });

    expect(responseBuild.body).toStrictEqual({
      id: 231,
      jsonrpc: "2.0",
      result: {
        chainId: expect.any(String),
        data: expect.any(String),
        from: param.from,
        gasLimit: expect.any(String),
        gasPrice: expect.any(String),
        nonce: expect.any(String),
        to: expect.any(String),
        value: "0x0",
      },
    });
    expect(responseBuild.status).toBe(200);

    const unsignedTransaction = responseBuild.body.result;
    const uTx = formatEthersUnsignedTransaction(
      unsignedTransaction as UnsignedTransactionSchema,
    );

    const sgnTx = await testAdmin.wallet.signTransaction(uTx);
    const signature = ethers.Transaction.from(sgnTx).signature;
    if (!signature) {
      throw new Error("Signature not found");
    }
    const { r, s, v } = signature;

    const responseSend = await request(server)
      .post("/jsonrpc")
      .auth(testAdmin.token, { type: "bearer" })
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
        message: `The DID ${testAdmin.did} does not exist`,
      },
      id: "45",
      jsonrpc: "2.0",
    });
    expect(responseSend.status).toBe(400);
  });

  // Generic tests
  it("should throw Bad Request for a bad JSON-RPC call", async () => {
    expect.assertions(4);

    let response = await request(server)
      .post("/jsonrpc")
      .auth(testUser.token, { type: "bearer" })
      .send();

    expect(response.body).toStrictEqual({
      error: {
        code: -32_600,
        message: "JSON-RPC payload must be an object",
      },
      // eslint-disable-next-line unicorn/no-null
      id: null,
      jsonrpc: "2.0",
    });
    expect(response.status).toBe(400);

    response = await request(server)
      .post("/jsonrpc")
      .auth(testUser.token, { type: "bearer" })
      .send({});

    expect(response.body).toStrictEqual({
      error: {
        code: -32_600,
        message: [
          "Invalid 'jsonrpc': Invalid literal value, expected \"2.0\"",
          "Invalid 'method': Required",
          "Invalid 'params': Required",
        ].join("\n"),
      },
      // eslint-disable-next-line unicorn/no-null
      id: null,
      jsonrpc: "2.0",
    });
    expect(response.status).toBe(400);
  });

  it("should throw an error when sendSignedTransaction is used with a wrong chainId", async () => {
    expect.assertions(2);

    const transaction = {
      chainId: "0x1b3b",
      data: timestampContract.interface.encodeFunctionData(
        "getHashAlgorithms",
        [1, 10],
      ),
      from: testUser.wallet.address,
      gasLimit: "0x1000000",
      gasPrice: "0x00",
      nonce: "0x00",
      to: await timestampContract.getAddress(),
      value: "0x00",
    };

    const uTx = formatEthersUnsignedTransaction(
      transaction as UnsignedTransactionSchema,
    );

    const sgnTx = await testUser.wallet.signTransaction(
      uTx as ethers.TransactionLike,
    );
    const signature = ethers.Transaction.from(sgnTx).signature;
    if (!signature) {
      throw new Error("Signature not found");
    }
    const { r, s, v } = signature;

    const responseSend = await request(server)
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
            unsignedTransaction: transaction,
            v: `0x${v.toString(16)}`,
          },
        ],
      });

    const { chainId } = await provider.getNetwork();
    const actualChainId = `0x${BigInt(chainId).toString(16)}`;

    expect(responseSend.body).toStrictEqual({
      error: {
        code: -32_600,
        message: `Invalid unsignedTransaction.chainId. Expected ${actualChainId}. Received 0x1b3b`,
      },
      id: "45",
      jsonrpc: "2.0",
    });
    expect(responseSend.status).toBe(400);
  });

  it("should throw an Invalid Request error for bad method", async () => {
    expect.assertions(2);

    const response = await request(server)
      .post("/jsonrpc")
      .auth(testUser.token, { type: "bearer" })
      .send({
        id: 123,
        jsonrpc: "2.0",
        method: "unknown-method",
        params: [],
      });

    expect(response.body).toStrictEqual({
      error: {
        code: -32_600,
        message: expect.stringContaining(
          "The method 'unknown-method' is invalid",
        ),
      },
      id: 123,
      jsonrpc: "2.0",
    });
    expect(response.status).toBe(400);
  });

  it("should throw an error when the transaction is not a type 0 (legacy) transaction", async () => {
    expect.assertions(3);

    const param = {
      from: testAdmin.wallet.address,
      ianaName: "sha3-256",
      multiHash: "sha3-256",
      oid: "2.16.840.1.101.3.4.2.1",
      outputLength: 256,
      status: 1,
    } satisfies InsertHashAlgorithmSchema;

    const responseBuild: SupertestJsonRpcResponse = await request(server)
      .post("/jsonrpc")
      .auth(testAdmin.token, { type: "bearer" })
      .send({
        id: 231,
        jsonrpc: "2.0",
        method: "insertHashAlgorithm",
        params: [param],
      });

    expect(responseBuild.status).toBe(200);
    const transaction = responseBuild.body.result as UnsignedTransactionSchema;

    const signer = newUser.wallet;
    const uTx = formatEthersUnsignedTransaction(transaction);

    // Remove "type: 0" from unsigned transaction, let ethers.js infer (incorrectly) that it's a type 1 transaction
    // @ts-expect-error The operand of a 'delete' operator must be optional
    delete uTx.type;

    const sgnTx = await signer.signTransaction(uTx);
    const signature = ethers.Transaction.from(sgnTx).signature;
    if (!signature) {
      throw new Error("Signature not found");
    }
    const { r, s, v } = signature;

    const responseSend = await request(server)
      .post("/jsonrpc")
      .auth(testAdmin.token, { type: "bearer" })
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
            unsignedTransaction: transaction,
            v: `0x${v.toString(16)}`,
          },
        ],
      });

    expect(responseSend.body).toStrictEqual({
      error: {
        code: -32_600,
        message: expect.stringContaining(
          "Invalid 'params.0.signedRawTransaction': Only type 0 (legacy) transactions are supported",
        ),
      },
      id: "45",
      jsonrpc: "2.0",
    });
    expect(responseSend.status).toBe(400);
  });

  // Tests to be repeated for every method
  describe.each([
    "insertHashAlgorithm",
    "updateHashAlgorithm",
    "timestampHashes",
    "timestampRecordHashes",
    "timestampVersionHashes",
    "insertRecordOwner",
    "insertRecordVersionInfo",
    "detachRecordVersionHash",
    "timestampRecordVersionHashes",
    "appendRecordVersionHashes",
    "revokeRecordOwner",
  ])("/jsonrpc with method %s", (method: string) => {
    it("should return a valid unsigned transaction that we can sign and send to sendSignedTransaction", async () => {
      expect.assertions(4);

      let param: JsonRpcParams;

      switch (method) {
        case "appendRecordVersionHashes": {
          recordId = ethers.sha256(
            ethers.AbiCoder.defaultAbiCoder().encode(
              ["address", "uint256", "bytes"],
              [testAdmin.wallet.address, blockNumber, firstHashValue],
            ),
          );
          param = {
            from: testAdmin.wallet.address,
            hashAlgorithmIds: [0],
            hashValues: [firstHashValue],
            recordId,
            timestampData: [
              `0x${Buffer.from(JSON.stringify({ test: 42 }), "utf8").toString(
                "hex",
              )}`,
            ],
            versionId: 1,
            versionInfo: `0x${Buffer.from(
              JSON.stringify({ test: 54 }),
              "utf8",
            ).toString("hex")}`,
          } satisfies AppendRecordVersionHashesSchema;
          break;
        }
        case "detachRecordVersionHash": {
          recordId = ethers.sha256(
            ethers.AbiCoder.defaultAbiCoder().encode(
              ["address", "uint256", "bytes"],
              [testAdmin.wallet.address, blockNumber, firstHashValue],
            ),
          );
          param = {
            from: testAdmin.wallet.address,
            hashValue: firstHashValue,
            recordId,
            versionId: 0,
          } satisfies DetachRecordVersionHashSchema;
          break;
        }
        case "insertHashAlgorithm": {
          param = {
            from: testAdmin.wallet.address,
            ianaName: "sha3-256",
            multiHash: "sha3-256",
            oid: "2.16.840.1.101.3.4.2.1",
            outputLength: 256,
            status: 1,
          } satisfies InsertHashAlgorithmSchema;
          break;
        }
        case "insertRecordOwner": {
          recordId = ethers.sha256(
            ethers.AbiCoder.defaultAbiCoder().encode(
              ["address", "uint256", "bytes"],
              [testAdmin.wallet.address, blockNumber, firstHashValue],
            ),
          );
          param = {
            from: testAdmin.wallet.address,
            notAfter: 1_021_201_545,
            notBefore: 1042,
            ownerId: "owner",
            recordId,
          } satisfies InsertRecordOwnerSchema;
          break;
        }
        case "insertRecordVersionInfo": {
          recordId = ethers.sha256(
            ethers.AbiCoder.defaultAbiCoder().encode(
              ["address", "uint256", "bytes"],
              [testAdmin.wallet.address, blockNumber, firstHashValue],
            ),
          );
          param = {
            from: testAdmin.wallet.address,
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
          recordId = ethers.sha256(
            ethers.AbiCoder.defaultAbiCoder().encode(
              ["address", "uint256", "bytes"],
              [testAdmin.wallet.address, blockNumber, firstHashValue],
            ),
          );
          param = {
            from: testAdmin.wallet.address,
            ownerId: "owner",
            recordId,
          } satisfies RevokeRecordOwnerSchema;
          break;
        }
        case "timestampHashes": {
          param = {
            from: testAdmin.wallet.address,
            hashAlgorithmIds: [0],
            hashValues: [firstHashValue],
            timestampData: [
              `0x${Buffer.from(JSON.stringify({ test: 42 }), "utf8").toString(
                "hex",
              )}`,
            ],
          } satisfies TimestampHashesSchema;
          break;
        }
        case "timestampRecordHashes": {
          param = {
            from: testAdmin.wallet.address,
            hashAlgorithmIds: [0],
            hashValues: [firstHashValue],
            timestampData: [
              `0x${Buffer.from(JSON.stringify({ test: 42 }), "utf8").toString(
                "hex",
              )}`,
            ],
            versionInfo: `0x${Buffer.from(
              JSON.stringify({ test: 54 }),
              "utf8",
            ).toString("hex")}`,
          } satisfies TimestampRecordHashesSchema;
          break;
        }
        case "timestampRecordVersionHashes": {
          recordId = ethers.sha256(
            ethers.AbiCoder.defaultAbiCoder().encode(
              ["address", "uint256", "bytes"],
              [testAdmin.wallet.address, blockNumber, firstHashValue],
            ),
          );
          param = {
            from: testAdmin.wallet.address,
            hashAlgorithmIds: [0],
            hashValues: [firstHashValue],
            recordId,
            timestampData: [
              `0x${Buffer.from(JSON.stringify({ test: 42 }), "utf8").toString(
                "hex",
              )}`,
            ],
            versionInfo: `0x${Buffer.from(
              JSON.stringify({ test: 54 }),
              "utf8",
            ).toString("hex")}`,
          } satisfies TimestampRecordVersionHashesSchema;
          break;
        }
        case "timestampVersionHashes": {
          param = {
            from: testAdmin.wallet.address,
            hashAlgorithmIds: [0],
            hashValues: [firstHashValue],
            timestampData: [
              `0x${Buffer.from(JSON.stringify({ test: 42 }), "utf8").toString(
                "hex",
              )}`,
            ],
            versionHash: firstHashValue,
            versionInfo: `0x${Buffer.from(
              JSON.stringify({ test: 54 }),
              "utf8",
            ).toString("hex")}`,
          } satisfies TimestampVersionHashesSchema;
          break;
        }
        case "updateHashAlgorithm": {
          param = {
            from: testAdmin.wallet.address,
            hashAlgorithmId: 1, // "1" is the ID of the hash we've just inserted
            ianaName: "sha3-512",
            multiHash: "sha3-512",
            oid: "2.16.840.1.101.3.4.2.10",
            outputLength: 512,
            status: 2,
          } satisfies UpdateHashAlgorithmSchema;
          break;
        }
        default: {
          throw new Error(`Test Error: Invalid method ${method}`);
        }
      }

      const responseBuild: SupertestJsonRpcResponse = await request(server)
        .post("/jsonrpc")
        .auth(testAdmin.token, { type: "bearer" })
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
          from: param.from,
          gasLimit: expect.any(String),
          gasPrice: expect.any(String),
          nonce: expect.any(String),
          to: expect.any(String),
          value: "0x0",
        },
      });
      expect(responseBuild.status).toBe(200);

      const unsignedTransaction = responseBuild.body.result;
      const uTx = formatEthersUnsignedTransaction(
        unsignedTransaction as UnsignedTransactionSchema,
      );

      const sgnTx = await testAdmin.wallet.signTransaction(
        uTx as ethers.TransactionLike,
      );
      const signature = ethers.Transaction.from(sgnTx).signature;
      if (!signature) {
        throw new Error("Signature not found");
      }
      const { r, s, v } = signature;

      const responseSend = await request(server)
        .post("/jsonrpc")
        .auth(testAdmin.token, { type: "bearer" })
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
      // blocknumber needed to compute the recordid
      if (method === "timestampRecordHashes") {
        blockNumber = await provider.getBlockNumber();
      }
      expect(responseSend.body).toStrictEqual({
        id: "45",
        jsonrpc: "2.0",
        result: expect.any(String),
      });
      expect(responseSend.status).toBe(200);
    });

    it("should accept a request without id", async () => {
      expect.assertions(2);

      let param: JsonRpcParams;

      switch (method) {
        case "appendRecordVersionHashes": {
          param = {
            from: testAdmin.wallet.address,
            hashAlgorithmIds: [0],
            hashValues: [firstHashValue],
            recordId:
              "0x011742226f9fad758490f98ba3d3a7c841db6ce3b6a889748b419e50eb63513d",
            timestampData: [
              `0x${Buffer.from(JSON.stringify({ test: 42 }), "utf8").toString(
                "hex",
              )}`,
            ],
            versionId: 0,
            versionInfo: `0x${Buffer.from(
              JSON.stringify({ test: 54 }),
              "utf8",
            ).toString("hex")}`,
          } satisfies AppendRecordVersionHashesSchema;
          break;
        }
        case "detachRecordVersionHash": {
          param = {
            from: testAdmin.wallet.address,
            hashValue: "0x1234567890",
            recordId:
              "0x011742226f9fad758490f98ba3d3a7c841db6ce3b6a889748b419e50eb63513d",
            versionId: 0,
          } satisfies DetachRecordVersionHashSchema;
          break;
        }
        case "insertHashAlgorithm": {
          param = {
            from: testAdmin.wallet.address,
            ianaName: "sha-256",
            multiHash: "sha2-256",
            oid: "2.16.840.1.101.3.4.2.1",
            outputLength: 256,
            status: 1,
          } satisfies InsertHashAlgorithmSchema;
          break;
        }
        case "insertRecordOwner": {
          param = {
            from: testAdmin.wallet.address,
            notAfter: 1_021_201_545,
            notBefore: 1042,
            ownerId: "owner",
            recordId:
              "0x011742226f9fad758490f98ba3d3a7c841db6ce3b6a889748b419e50eb63513d",
          } satisfies InsertRecordOwnerSchema;
          break;
        }
        case "insertRecordVersionInfo": {
          param = {
            from: testAdmin.wallet.address,
            recordId:
              "0x011742226f9fad758490f98ba3d3a7c841db6ce3b6a889748b419e50eb63513d",
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
            from: testAdmin.wallet.address,
            ownerId: "owner",
            recordId:
              "0x011742226f9fad758490f98ba3d3a7c841db6ce3b6a889748b419e50eb63513d",
          } satisfies RevokeRecordOwnerSchema;
          break;
        }
        case "timestampHashes": {
          param = {
            from: testAdmin.wallet.address,
            hashAlgorithmIds: [0],
            hashValues: [firstHashValue],
            timestampData: [
              `0x${Buffer.from(JSON.stringify({ test: 42 }), "utf8").toString(
                "hex",
              )}`,
            ],
          } satisfies TimestampHashesSchema;
          break;
        }
        case "timestampRecordHashes": {
          param = {
            from: testAdmin.wallet.address,
            hashAlgorithmIds: [0],
            hashValues: [firstHashValue],
            timestampData: [
              `0x${Buffer.from(JSON.stringify({ test: 42 }), "utf8").toString(
                "hex",
              )}`,
            ],
            versionInfo: `0x${Buffer.from(
              JSON.stringify({ test: 54 }),
              "utf8",
            ).toString("hex")}`,
          } satisfies TimestampRecordHashesSchema;
          break;
        }
        case "timestampRecordVersionHashes": {
          param = {
            from: testAdmin.wallet.address,
            hashAlgorithmIds: [0],
            hashValues: [firstHashValue],
            recordId:
              "0x011742226f9fad758490f98ba3d3a7c841db6ce3b6a889748b419e50eb63513d",
            timestampData: [
              `0x${Buffer.from(JSON.stringify({ test: 42 }), "utf8").toString(
                "hex",
              )}`,
            ],
            versionInfo: `0x${Buffer.from(
              JSON.stringify({ test: 54 }),
              "utf8",
            ).toString("hex")}`,
          } satisfies TimestampRecordVersionHashesSchema;
          break;
        }
        case "timestampVersionHashes": {
          param = {
            from: testAdmin.wallet.address,
            hashAlgorithmIds: [0],
            hashValues: [firstHashValue],
            timestampData: [
              `0x${Buffer.from(JSON.stringify({ test: 42 }), "utf8").toString(
                "hex",
              )}`,
            ],
            versionHash: firstHashValue,
            versionInfo: `0x${Buffer.from(
              JSON.stringify({ test: 54 }),
              "utf8",
            ).toString("hex")}`,
          } satisfies TimestampVersionHashesSchema;
          break;
        }
        case "updateHashAlgorithm": {
          param = {
            from: testAdmin.wallet.address,
            hashAlgorithmId: 1,
            ianaName: "sha-256",
            multiHash: "sha2-256",
            oid: "2.16.840.1.101.3.4.2.1",
            outputLength: 256,
            status: 1,
          } satisfies UpdateHashAlgorithmSchema;
          break;
        }
        default: {
          throw new Error(`Test Error: Invalid method ${method}`);
        }
      }

      const responseBuild = await request(server)
        .post("/jsonrpc")
        .auth(testAdmin.token, { type: "bearer" })
        .send({
          jsonrpc: "2.0",
          method,
          params: [param],
          // no id defined
        });

      expect(responseBuild.body).toStrictEqual({
        // eslint-disable-next-line unicorn/no-null
        id: null,
        jsonrpc: "2.0",
        result: expect.objectContaining({}),
      });
      expect(responseBuild.status).toBe(200);
    });

    it(`should throw an Invalid Request error for bad use of ${method}`, async () => {
      expect.assertions(6);

      let param1: JsonRpcParams;
      let param2: JsonRpcParams;
      let param3: JsonRpcParams;

      let expectedErrorMessage1: string;
      let expectedErrorMessage2: string;
      let expectedErrorMessage3: string;

      switch (method) {
        case "appendRecordVersionHashes": {
          param1 = {
            from: testAdmin.wallet.address,
            hashValues: [firstHashValue],
            recordId:
              "0x1234567890123456789012345678901234567890123456789012345678901234",
            timestampData: [
              `0x${Buffer.from(JSON.stringify({ test: 42 }), "utf8").toString(
                "hex",
              )}`,
            ],
            versionId: "o",
            versionInfo: `0x${Buffer.from(
              JSON.stringify({ test: 842 }),
              "utf8",
            ).toString("hex")}`,
          } as unknown as AppendRecordVersionHashesSchema;

          expectedErrorMessage1 = "Invalid 'params.0.versionId': Invalid input";

          param2 = {
            from: testAdmin.wallet.address,
            hashAlgorithmIds: [0],
            recordId:
              "0x1234567890123456789012345678901234567890123456789012345678901234",
            timestampData: [
              `0x${Buffer.from(JSON.stringify({ test: 42 }), "utf8").toString(
                "hex",
              )}`,
            ],
            versionId: 12,
            versionInfo: `0x${Buffer.from(
              JSON.stringify({ test: 492 }),
              "utf8",
            ).toString("hex")}`,
          } as unknown as AppendRecordVersionHashesSchema;

          expectedErrorMessage2 = "Invalid 'params.0.hashValues': Required";

          param3 = {
            from: testAdmin.wallet.address,
            hashAlgorithmIds: [0],
            hashValues: [firstHashValue],
            recordId:
              "0x1234567890123456789012345678901234567890123456789012345678901234",
            timestampData: [`this is not hex`],
            versionId: 0,
            versionInfo: `0x${Buffer.from(
              JSON.stringify({ test: 42 }),
              "utf8",
            ).toString("hex")}`,
          } as unknown as AppendRecordVersionHashesSchema;

          expectedErrorMessage3 =
            "Invalid 'params.0.timestampData.0': Must start with 0x";
          break;
        }
        case "detachRecordVersionHash": {
          param1 = {
            from: testAdmin.wallet.address,
            hashValue: "0x1234567890",
            recordId:
              "0x1234567890123456789012345678901234567890123456789012345678901234",
            versionId: "-----",
          } as unknown as DetachRecordVersionHashSchema;

          expectedErrorMessage1 = "Invalid 'params.0.versionId': Invalid input";

          param2 = {
            from: testAdmin.wallet.address,
            recordId:
              "0x1234567890123456789012345678901234567890123456789012345678901234",
            versionId: 0,
          } as unknown as DetachRecordVersionHashSchema;

          expectedErrorMessage2 = "Invalid 'params.0.hashValue': Required";

          param3 = {
            from: testAdmin.wallet.address,
            hashValue: "0x1234567890",
            versionId: 12,
          } as unknown as DetachRecordVersionHashSchema;

          expectedErrorMessage3 = "Invalid 'params.0.recordId': Required";
          break;
        }
        case "insertHashAlgorithm": {
          param1 = {
            from: testAdmin.wallet.address,
            ianaName: "sha-256",
            multiHash: "sha2-256",
            oid: "2.16.840.1.101.3.4.2.1",
            outputLength: -12,
            status: 1,
          } satisfies InsertHashAlgorithmSchema;

          expectedErrorMessage1 =
            "Invalid 'params.0.outputLength': Number must be greater than or equal to 0";

          param2 = {
            from: testAdmin.wallet.address,
            ianaName: "sha-256",
            multiHash: "sha2-256",
            oid: "2.16.840.1.101.3.4.2.1",
            outputLength: 256,
            status: 3,
          } satisfies InsertHashAlgorithmSchema;

          expectedErrorMessage2 =
            "Invalid 'params.0.status': Status must be equal to 1 (active) or 2 (revoked)";

          param3 = {
            from: testAdmin.wallet.address,
            ianaName: "sha-256",
            multiHash: "sha-sha-sha-256",
            oid: "1",
            outputLength: 256,
            status: 1,
          } satisfies InsertHashAlgorithmSchema;

          expectedErrorMessage3 =
            "Invalid 'params.0.multiHash': Must be multihash";
          break;
        }
        case "insertRecordOwner": {
          param1 = {
            from: testAdmin.wallet.address,
            notAfter: 12,
            notBefore: 1,
            ownerId: 0,
            recordId:
              "0x1234567890123456789012345678901234567890123456789012345678901234",
          } as unknown as InsertRecordOwnerSchema;

          expectedErrorMessage1 =
            "params.0.ownerId': Expected string, received number";

          param2 = {
            from: testAdmin.wallet.address,
            notAfter: 12,
            notBefore: "test",
            ownerId: "owner",
            recordId:
              "0x1234567890123456789012345678901234567890123456789012345678901234",
          } as unknown as InsertRecordOwnerSchema;

          expectedErrorMessage2 = "Invalid 'params.0.notBefore': Invalid input";

          param3 = {
            from: testAdmin.wallet.address,
            notAfter: 12,
            notBefore: 1,
            ownerId: "owner",
          } as unknown as InsertRecordOwnerSchema;

          expectedErrorMessage3 = "Invalid 'params.0.recordId': Required";
          break;
        }
        case "insertRecordVersionInfo": {
          param1 = {
            from: testAdmin.wallet.address,
            recordId:
              "0x123456789012345678901234567890123456789012345678901234567890123X",
            versionId: 0,
            versionInfo: `0x${Buffer.from(
              JSON.stringify({ test: 42 }),
              "utf8",
            ).toString("hex")}`,
          } satisfies InsertRecordVersionInfoSchema;

          expectedErrorMessage1 =
            "Invalid 'params.0.recordId': Must be hexadecimal";

          param2 = {
            from: testAdmin.wallet.address,
            recordId:
              "0x1234567890123456789012345678901234567890123456789012345678901234",
            versionId: -1,
            versionInfo: `0x${Buffer.from(
              JSON.stringify({ test: 42 }),
              "utf8",
            ).toString("hex")}`,
          } satisfies InsertRecordVersionInfoSchema;

          expectedErrorMessage2 =
            "Invalid 'params.0.versionId': Number must be greater than or equal to 0";

          param3 = {
            from: testAdmin.wallet.address,
            recordId:
              "0x1234567890123456789012345678901234567890123456789012345678901234",
            versionId: 0,
            versionInfo: `0x${Buffer.from(
              JSON.stringify({ test: 42 }),
              "utf8",
            ).toString("hex")}f`,
          } satisfies InsertRecordVersionInfoSchema;

          expectedErrorMessage3 =
            "Invalid 'params.0.versionInfo': Length must be even";
          break;
        }
        case "revokeRecordOwner": {
          param1 = {
            from: testAdmin.wallet.address,
            ownerId: 0,
            recordId:
              "0x1234567890123456789012345678901234567890123456789012345678901234",
          } as unknown as RevokeRecordOwnerSchema;

          expectedErrorMessage1 =
            "params.0.ownerId': Expected string, received number";

          param2 = {
            from: testAdmin.wallet.address,
            recordId:
              "0x1234567890123456789012345678901234567890123456789012345678901234",
          } as unknown as RevokeRecordOwnerSchema;

          expectedErrorMessage2 = "Invalid 'params.0.ownerId': Required";

          param3 = {
            from: testAdmin.wallet.address,
            ownerId: "owner",
          } as unknown as RevokeRecordOwnerSchema;

          expectedErrorMessage3 = "Invalid 'params.0.recordId': Required";
          break;
        }
        case "timestampHashes": {
          param1 = {
            from: testAdmin.wallet.address,
            hashValues: [firstHashValue],
            timestampData: [
              `0x${Buffer.from(JSON.stringify({ test: 42 }), "utf8").toString(
                "hex",
              )}`,
            ],
          } as TimestampHashesSchema;

          expectedErrorMessage1 =
            "Invalid 'params.0.hashAlgorithmIds': Required";

          param2 = {
            from: testAdmin.wallet.address,
            hashAlgorithmIds: [0],
            timestampData: [
              `0x${Buffer.from(JSON.stringify({ test: 42 }), "utf8").toString(
                "hex",
              )}`,
            ],
          } as TimestampHashesSchema;

          expectedErrorMessage2 = "Invalid 'params.0.hashValues': Required";

          param3 = {
            from: testAdmin.wallet.address,
            hashAlgorithmIds: [0],
            hashValues: [firstHashValue],
            timestampData: [`this is not hex`],
          } satisfies TimestampHashesSchema;

          expectedErrorMessage3 =
            "Invalid 'params.0.timestampData.0': Must start with 0x";
          break;
        }
        case "timestampRecordHashes": {
          param1 = {
            from: testAdmin.wallet.address,
            hashValues: [firstHashValue],
            timestampData: [
              `0x${Buffer.from(JSON.stringify({ test: 42 }), "utf8").toString(
                "hex",
              )}`,
            ],
            versionInfo: `0x${Buffer.from(
              JSON.stringify({ test: 52 }),
              "utf8",
            ).toString("hex")}`,
          } as TimestampRecordHashesSchema;

          expectedErrorMessage1 =
            "Invalid 'params.0.hashAlgorithmIds': Required";

          param2 = {
            from: testAdmin.wallet.address,
            hashAlgorithmIds: [0],
            timestampData: [
              `0x${Buffer.from(JSON.stringify({ test: 42 }), "utf8").toString(
                "hex",
              )}`,
            ],
            versionInfo: `0x${Buffer.from(
              JSON.stringify({ test: 425 }),
              "utf8",
            ).toString("hex")}`,
          } as unknown as TimestampRecordHashesSchema;

          expectedErrorMessage2 = "Invalid 'params.0.hashValues': Required";

          param3 = {
            from: testAdmin.wallet.address,
            hashAlgorithmIds: [0],
            hashValues: [firstHashValue],
            timestampData: [`this is not hex`],
            versionInfo: `0x${Buffer.from(
              JSON.stringify({ test: 82 }),
              "utf8",
            ).toString("hex")}`,
          } as unknown as InsertRecordOwnerSchema;

          expectedErrorMessage3 =
            "Invalid 'params.0.timestampData.0': Must start with 0x";
          break;
        }
        case "timestampRecordVersionHashes": {
          param1 = {
            from: testAdmin.wallet.address,
            hashValues: [firstHashValue],
            recordId:
              "0x1234567890123456789012345678901234567890123456789012345678901234",
            timestampData: [
              `0x${Buffer.from(JSON.stringify({ test: 42 }), "utf8").toString(
                "hex",
              )}`,
            ],
            versionInfo: `0x${Buffer.from(
              JSON.stringify({ test: 482 }),
              "utf8",
            ).toString("hex")}`,
          } as unknown as TimestampRecordVersionHashesSchema;

          expectedErrorMessage1 =
            "Invalid 'params.0.hashAlgorithmIds': Required";

          param2 = {
            from: testAdmin.wallet.address,
            hashAlgorithmIds: [0],
            recordId:
              "0x1234567890123456789012345678901234567890123456789012345678901234",
            timestampData: [
              `0x${Buffer.from(JSON.stringify({ test: 42 }), "utf8").toString(
                "hex",
              )}`,
            ],
            versionInfo: `0x${Buffer.from(
              JSON.stringify({ infotest: 42 }),
              "utf8",
            ).toString("hex")}`,
          } as unknown as TimestampRecordVersionHashesSchema;

          expectedErrorMessage2 = "Invalid 'params.0.hashValues': Required";

          param3 = {
            from: testAdmin.wallet.address,
            hashAlgorithmIds: [0],
            hashValues: [firstHashValue],
            recordId:
              "0x1234567890123456789012345678901234567890123456789012345678901234",
            timestampData: [`this is not hex`],
            versionInfo: `0x${Buffer.from(
              JSON.stringify({ test: 842 }),
              "utf8",
            ).toString("hex")}`,
          } as unknown as TimestampRecordVersionHashesSchema;

          expectedErrorMessage3 =
            "Invalid 'params.0.timestampData.0': Must start with 0x";
          break;
        }
        case "timestampVersionHashes": {
          param1 = {
            from: testAdmin.wallet.address,
            hashValues: [firstHashValue],
            timestampData: [
              `0x${Buffer.from(JSON.stringify({ test: 42 }), "utf8").toString(
                "hex",
              )}`,
            ],
            versionHash: firstHashValue,
            versionInfo: `0x${Buffer.from(
              JSON.stringify({ test: 54 }),
              "utf8",
            ).toString("hex")}`,
          } as TimestampVersionHashesSchema;

          expectedErrorMessage1 =
            "Invalid 'params.0.hashAlgorithmIds': Required";

          param2 = {
            from: testAdmin.wallet.address,
            hashAlgorithmIds: [0],
            timestampData: [
              `0x${Buffer.from(JSON.stringify({ test: 42 }), "utf8").toString(
                "hex",
              )}`,
            ],
            versionHash: firstHashValue,
            versionInfo: `0x${Buffer.from(
              JSON.stringify({ test: 54 }),
              "utf8",
            ).toString("hex")}`,
          } as TimestampVersionHashesSchema;

          expectedErrorMessage2 = "Invalid 'params.0.hashValues': Required";

          param3 = {
            from: testAdmin.wallet.address,
            hashAlgorithmIds: [0],
            hashValues: [firstHashValue],
            timestampData: [`this is not hex`],
            versionHash: firstHashValue,
            versionInfo: `0x${Buffer.from(
              JSON.stringify({ test: 54 }),
              "utf8",
            ).toString("hex")}`,
          } satisfies TimestampVersionHashesSchema;

          expectedErrorMessage3 =
            "Invalid 'params.0.timestampData.0': Must start with 0x";
          break;
        }
        case "updateHashAlgorithm": {
          param1 = {
            from: testAdmin.wallet.address,
            hashAlgorithmId: -1,
            ianaName: "sha-256",
            multiHash: "sha2-256",
            oid: "2.16.840.1.101.3.4.2.1",
            outputLength: 256,
            status: 1,
          } satisfies UpdateHashAlgorithmSchema;

          expectedErrorMessage1 =
            "Invalid 'params.0.hashAlgorithmId': Number must be greater than or equal to 0";

          param2 = {
            from: testAdmin.wallet.address,
            hashAlgorithmId: 1,
            ianaName: "sha-256",
            multiHash: "sha2-256",
            oid: "2.16.840.1.101.3.4.2.1",
            outputLength: -1,
            status: 1,
          } satisfies UpdateHashAlgorithmSchema;

          expectedErrorMessage2 =
            "Invalid 'params.0.outputLength': Number must be greater than or equal to 0";

          param3 = {
            from: testAdmin.wallet.address,
            hashAlgorithmId: 1,
            ianaName: "sha-256",
            multiHash: "sha-sha-sha-256",
            oid: "2.16.840.1.101.3.4.2.1",
            outputLength: 256,
            status: 0,
          } satisfies UpdateHashAlgorithmSchema;

          expectedErrorMessage3 =
            "Invalid 'params.0.multiHash': Must be multihash";
          break;
        }
        default: {
          throw new Error(`Test Error: Invalid method ${method}`);
        }
      }

      const response1 = await request(server)
        .post("/jsonrpc")
        .auth(testAdmin.token, { type: "bearer" })
        .send({
          id: 231,
          jsonrpc: "2.0",
          method,
          params: [param1],
        });

      expect(response1.body).toStrictEqual({
        error: {
          code: -32_600,
          message: expect.stringContaining(expectedErrorMessage1),
        },
        id: 231,
        jsonrpc: "2.0",
      });
      expect(response1.status).toBe(400);

      const response2 = await request(server)
        .post("/jsonrpc")
        .auth(testAdmin.token, { type: "bearer" })
        .send({
          id: 231,
          jsonrpc: "2.0",
          method,
          params: [param2],
        });

      expect(response2.body).toStrictEqual({
        error: {
          code: -32_600,
          message: expect.stringContaining(expectedErrorMessage2),
        },
        id: 231,
        jsonrpc: "2.0",
      });
      expect(response2.status).toBe(400);

      const response3 = await request(server)
        .post("/jsonrpc")
        .auth(testAdmin.token, { type: "bearer" })
        .send({
          id: 231,
          jsonrpc: "2.0",
          method,
          params: [param3],
        });

      expect(response3.body).toStrictEqual({
        error: {
          code: -32_600,
          message: expect.stringContaining(expectedErrorMessage3),
        },
        id: 231,
        jsonrpc: "2.0",
      });
      expect(response3.status).toBe(400);
    });

    it("should throw an error when the unsignedTransaction has been tampered", async () => {
      expect.assertions(6);

      let param1: JsonRpcParams;
      let param2: JsonRpcParams;

      switch (method) {
        case "appendRecordVersionHashes": {
          recordId = ethers.sha256(
            ethers.AbiCoder.defaultAbiCoder().encode(
              ["address", "uint256", "bytes"],
              [testAdmin.wallet.address, blockNumber, firstHashValue],
            ),
          );

          param1 = {
            from: testUser.wallet.address,
            hashAlgorithmIds: [0],
            hashValues: [firstHashValue],
            recordId,
            timestampData: [
              `0x${Buffer.from(JSON.stringify({ test: 42 }), "utf8").toString(
                "hex",
              )}`,
            ],
            versionId: 1,
            versionInfo: `0x${Buffer.from(
              JSON.stringify({ infos: 42 }),
              "utf8",
            ).toString("hex")}`,
          } satisfies AppendRecordVersionHashesSchema;

          param2 = {
            from: testAdmin.wallet.address,
            hashAlgorithmIds: [0],
            hashValues: [firstHashValue],
            recordId,
            timestampData: [
              `0x${Buffer.from(JSON.stringify({ test: 24 }), "utf8").toString(
                "hex",
              )}`,
            ],
            versionId: 1,
            versionInfo: `0x${Buffer.from(
              JSON.stringify({ info: 42 }),
              "utf8",
            ).toString("hex")}`,
          } satisfies AppendRecordVersionHashesSchema;

          break;
        }
        case "detachRecordVersionHash": {
          recordId = ethers.sha256(
            ethers.AbiCoder.defaultAbiCoder().encode(
              ["address", "uint256", "bytes"],
              [testAdmin.wallet.address, blockNumber, firstHashValue],
            ),
          );

          param1 = {
            from: testUser.wallet.address,
            hashValue: "0x125345568a",
            recordId,
            versionId: 0,
          } satisfies DetachRecordVersionHashSchema;

          param2 = {
            from: testAdmin.wallet.address,
            hashValue: "0x1234567890",
            recordId,
            versionId: 0,
          } satisfies DetachRecordVersionHashSchema;

          break;
        }
        case "insertHashAlgorithm": {
          param1 = {
            from: testUser.wallet.address,
            ianaName: "sha-256",
            multiHash: "sha2-256",
            oid: "2.16.840.1.101.3.4.2.1",
            outputLength: 256,
            status: 1,
          } satisfies InsertHashAlgorithmSchema;

          param2 = {
            from: testAdmin.wallet.address,
            ianaName: "sha-256",
            multiHash: "sha2-256",
            oid: "2.16.840.1.101.3.4.2.1",
            outputLength: 256,
            status: 2,
          } satisfies InsertHashAlgorithmSchema;

          break;
        }
        case "insertRecordOwner": {
          recordId = ethers.sha256(
            ethers.AbiCoder.defaultAbiCoder().encode(
              ["address", "uint256", "bytes"],
              [testAdmin.wallet.address, blockNumber, firstHashValue],
            ),
          );

          param1 = {
            from: testUser.wallet.address,
            notAfter: 1_021_201_545,
            notBefore: 1042,
            ownerId: "owner",
            recordId,
          } satisfies InsertRecordOwnerSchema;

          param2 = {
            from: testAdmin.wallet.address,
            notAfter: 1_021_201_545,
            notBefore: 1042,
            ownerId: "ownerchanged",
            recordId,
          } satisfies InsertRecordOwnerSchema;

          break;
        }
        case "insertRecordVersionInfo": {
          recordId = ethers.sha256(
            ethers.AbiCoder.defaultAbiCoder().encode(
              ["address", "uint256", "bytes"],
              [testAdmin.wallet.address, blockNumber, firstHashValue],
            ),
          );

          const versionInfo = `0x${Buffer.from(
            JSON.stringify({ test: 42 }),
            "utf8",
          ).toString("hex")}`;

          param1 = {
            from: testUser.wallet.address,
            recordId,
            versionId: 0,
            versionInfo,
          } satisfies InsertRecordVersionInfoSchema;

          param2 = {
            from: testAdmin.wallet.address,
            recordId,
            versionId: 1,
            versionInfo,
          } satisfies InsertRecordVersionInfoSchema;

          break;
        }
        case "revokeRecordOwner": {
          recordId = ethers.sha256(
            ethers.AbiCoder.defaultAbiCoder().encode(
              ["address", "uint256", "bytes"],
              [testAdmin.wallet.address, blockNumber, firstHashValue],
            ),
          );

          param1 = {
            from: testUser.wallet.address,
            ownerId: "owner",
            recordId,
          } satisfies RevokeRecordOwnerSchema;

          param2 = {
            from: testAdmin.wallet.address,
            ownerId: "ownerchanged",
            recordId,
          } satisfies RevokeRecordOwnerSchema;

          break;
        }
        case "timestampHashes": {
          param1 = {
            from: testUser.wallet.address,
            hashAlgorithmIds: [0],
            hashValues: [firstHashValue],
            timestampData: [
              `0x${Buffer.from(JSON.stringify({ test: 42 }), "utf8").toString(
                "hex",
              )}`,
            ],
          } satisfies TimestampHashesSchema;

          param2 = {
            from: testAdmin.wallet.address,
            hashAlgorithmIds: [0],
            hashValues: [firstHashValue],
            timestampData: [
              `0x${Buffer.from(JSON.stringify({ test: 43 }), "utf8").toString(
                "hex",
              )}`,
            ],
          } satisfies TimestampHashesSchema;

          break;
        }
        case "timestampRecordHashes": {
          param1 = {
            from: testUser.wallet.address,
            hashAlgorithmIds: [0],
            hashValues: [firstHashValue],
            timestampData: [
              `0x${Buffer.from(JSON.stringify({ test: 42 }), "utf8").toString(
                "hex",
              )}`,
            ],
            versionInfo: `0x${Buffer.from(
              JSON.stringify({ test: 742 }),
              "utf8",
            ).toString("hex")}`,
          } satisfies TimestampRecordHashesSchema;

          param2 = {
            from: testAdmin.wallet.address,
            hashAlgorithmIds: [0],
            hashValues: [firstHashValue],
            timestampData: [
              `0x${Buffer.from(JSON.stringify({ test: 43 }), "utf8").toString(
                "hex",
              )}`,
            ],
            versionInfo: `0x${Buffer.from(
              JSON.stringify({ test: 742 }),
              "utf8",
            ).toString("hex")}`,
          } satisfies TimestampRecordHashesSchema;

          break;
        }
        case "timestampRecordVersionHashes": {
          recordId = ethers.sha256(
            ethers.AbiCoder.defaultAbiCoder().encode(
              ["address", "uint256", "bytes"],
              [testAdmin.wallet.address, blockNumber, firstHashValue],
            ),
          );

          param1 = {
            from: testUser.wallet.address,
            hashAlgorithmIds: [0],
            hashValues: [firstHashValue],
            recordId,
            timestampData: [
              `0x${Buffer.from(JSON.stringify({ test: 42 }), "utf8").toString(
                "hex",
              )}`,
            ],
            versionInfo: `0x${Buffer.from(
              JSON.stringify({ info: 42 }),
              "utf8",
            ).toString("hex")}`,
          } satisfies TimestampRecordVersionHashesSchema;

          param2 = {
            from: testAdmin.wallet.address,
            hashAlgorithmIds: [0],
            hashValues: [firstHashValue],
            recordId,
            timestampData: [
              `0x${Buffer.from(JSON.stringify({ test: 24 }), "utf8").toString(
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
          param1 = {
            from: testUser.wallet.address,
            hashAlgorithmIds: [0],
            hashValues: [firstHashValue],
            timestampData: [
              `0x${Buffer.from(JSON.stringify({ test: 42 }), "utf8").toString(
                "hex",
              )}`,
            ],
            versionHash: firstHashValue,
            versionInfo: `0x${Buffer.from(
              JSON.stringify({ test: 54 }),
              "utf8",
            ).toString("hex")}`,
          } satisfies TimestampVersionHashesSchema;

          param2 = {
            from: testAdmin.wallet.address,
            hashAlgorithmIds: [0],
            hashValues: [firstHashValue],
            timestampData: [
              `0x${Buffer.from(JSON.stringify({ test: 43 }), "utf8").toString(
                "hex",
              )}`,
            ],
            versionHash: firstHashValue,
            versionInfo: `0x${Buffer.from(
              JSON.stringify({ test: 54 }),
              "utf8",
            ).toString("hex")}`,
          } satisfies TimestampVersionHashesSchema;

          break;
        }
        case "updateHashAlgorithm": {
          param1 = {
            from: testUser.wallet.address,
            hashAlgorithmId: 1,
            ianaName: "sha-256",
            multiHash: "sha2-256",
            oid: "2.16.840.1.101.3.4.2.1",
            outputLength: 256,
            status: 1,
          } satisfies UpdateHashAlgorithmSchema;

          param2 = {
            from: testAdmin.wallet.address,
            hashAlgorithmId: 1,
            ianaName: "sha-256",
            multiHash: "sha2-256",
            oid: "2.16.840.1.101.3.4.2.1",
            outputLength: 256,
            status: 2,
          } satisfies UpdateHashAlgorithmSchema;

          break;
        }
        default: {
          throw new Error(`Test Error: Invalid method ${method}`);
        }
      }

      const responseBuild1: SupertestJsonRpcResponse = await request(server)
        .post("/jsonrpc")
        .auth(testUser.token, { type: "bearer" })
        .send({
          id: 231,
          jsonrpc: "2.0",
          method,
          params: [param1],
        });
      expect(responseBuild1.status).toBe(200);
      const transaction1 = responseBuild1.body
        .result as UnsignedTransactionSchema;

      const responseBuild2: SupertestJsonRpcResponse = await request(server)
        .post("/jsonrpc")
        .auth(testAdmin.token, { type: "bearer" })
        .send({
          id: 232,
          jsonrpc: "2.0",
          method,
          params: [param2],
        });
      expect(responseBuild2.status).toBe(200);
      const transaction2 = responseBuild2.body
        .result as UnsignedTransactionSchema;

      const uTx = formatEthersUnsignedTransaction(transaction1);

      const sgnTx1 = await testUser.wallet.signTransaction(
        uTx as ethers.TransactionLike,
      );
      const signature = ethers.Transaction.from(sgnTx1).signature;
      if (!signature) {
        throw new Error("Signature not found");
      }
      const { r, s, v } = signature;

      // Tampering signatures
      const responseSend1 = await request(server)
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
              signedRawTransaction: sgnTx1,
              unsignedTransaction: transaction2,
              v: `0x${v.toString(16)}`,
            },
          ],
        });
      expect(responseSend1.body).toStrictEqual({
        error: {
          code: -32_600,
          message: expect.stringContaining(
            "does not match with the signedRawTransaction",
          ),
        },
        id: "45",
        jsonrpc: "2.0",
      });
      expect(responseSend1.status).toBe(400);

      // Tampering "from"
      transaction1.from = transaction2.from;
      const responseSend2 = await request(server)
        .post("/jsonrpc")
        .auth(testAdmin.token, { type: "bearer" })
        .send({
          id: "46",
          jsonrpc: "2.0",
          method: "sendSignedTransaction",
          params: [
            {
              protocol: "eth",
              r,
              s,
              signedRawTransaction: sgnTx1,
              unsignedTransaction: transaction1,
              v: `0x${v.toString(16)}`,
            },
          ],
        });
      expect(responseSend2.body).toStrictEqual({
        error: {
          code: -32_600,
          message: expect.stringContaining(
            "does not match with unsignedTransaction.from",
          ),
        },
        id: "46",
        jsonrpc: "2.0",
      });
      expect(responseSend1.status).toBe(400);
    });
  });

  // Tests to be repeated for every method
  describe.each([
    "timestampHashes",
    "timestampRecordHashes",
    "timestampRecordVersionHashes",
    "timestampVersionHashes",
    "appendRecordVersionHashes",
  ])(
    "/jsonrpc with method %s even if timestamp data is empty",
    (method: string) => {
      it("should return a valid unsigned transaction that we can sign and send to sendSignedTransaction even if timestamp data is empty", async () => {
        expect.assertions(4);

        let param: JsonRpcParams;

        switch (method) {
          case "appendRecordVersionHashes": {
            recordId = ethers.sha256(
              ethers.AbiCoder.defaultAbiCoder().encode(
                ["address", "uint256", "bytes"],
                [testAdmin.wallet.address, blockNumber, secondHashValue],
              ),
            );
            param = {
              from: testAdmin.wallet.address,
              hashAlgorithmIds: [0],
              hashValues: [secondHashValue],
              recordId,
              versionId: 1,
              versionInfo: `0x${Buffer.from(
                JSON.stringify({ test: 54 }),
                "utf8",
              ).toString("hex")}`,
            } satisfies AppendRecordVersionHashesSchema;
            break;
          }
          case "timestampHashes": {
            param = {
              from: testAdmin.wallet.address,
              hashAlgorithmIds: [0],
              hashValues: [secondHashValue],
            } satisfies TimestampHashesSchema;
            break;
          }
          case "timestampRecordHashes": {
            param = {
              from: testAdmin.wallet.address,
              hashAlgorithmIds: [0],
              hashValues: [secondHashValue],
              versionInfo: `0x${Buffer.from(
                JSON.stringify({ test: 54 }),
                "utf8",
              ).toString("hex")}`,
            } satisfies TimestampRecordHashesSchema;
            break;
          }
          case "timestampRecordVersionHashes": {
            recordId = ethers.sha256(
              ethers.AbiCoder.defaultAbiCoder().encode(
                ["address", "uint256", "bytes"],
                [testAdmin.wallet.address, blockNumber, secondHashValue],
              ),
            );
            param = {
              from: testAdmin.wallet.address,
              hashAlgorithmIds: [0],
              hashValues: [secondHashValue],
              recordId,
              versionInfo: `0x${Buffer.from(
                JSON.stringify({ test: 54 }),
                "utf8",
              ).toString("hex")}`,
            } satisfies TimestampRecordVersionHashesSchema;
            break;
          }
          case "timestampVersionHashes": {
            param = {
              from: testAdmin.wallet.address,
              hashAlgorithmIds: [0],
              hashValues: [secondHashValue],
              versionHash: secondHashValue,
              versionInfo: `0x${Buffer.from(
                JSON.stringify({ test: 54 }),
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
          .auth(testAdmin.token, { type: "bearer" })
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
            from: param.from,
            gasLimit: expect.any(String),
            gasPrice: expect.any(String),
            nonce: expect.any(String),
            to: expect.any(String),
            value: "0x0",
          },
        });
        expect(responseBuild.status).toBe(200);

        const unsignedTransaction = responseBuild.body.result;
        const uTx = formatEthersUnsignedTransaction(
          unsignedTransaction as UnsignedTransactionSchema,
        );

        const sgnTx = await testAdmin.wallet.signTransaction(
          uTx as ethers.TransactionLike,
        );
        const signature = ethers.Transaction.from(sgnTx).signature;
        if (!signature) {
          throw new Error("Signature not found");
        }
        const { r, s, v } = signature;

        const responseSend = await request(server)
          .post("/jsonrpc")
          .auth(testAdmin.token, { type: "bearer" })
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
        // blocknumber needed to compute the recordid
        if (method === "timestampRecordHashes") {
          blockNumber = await provider.getBlockNumber();
        }
        expect(responseSend.body).toStrictEqual({
          id: "45",
          jsonrpc: "2.0",
          result: expect.any(String),
        });
        expect(responseSend.status).toBe(200);
      });
    },
  );

  // Fix EBSIINT-11202
  // Before the fix, the API would accept the empty IANA name and the smart contract would revert with the message: 'ianaName unknown'
  // After the fix, the API should not accept the empty IANA name
  it("Fix EBSIINT-11202 - the API should not allow an empty IANA name", async () => {
    expect.assertions(2);

    const param = {
      from: testAdmin.wallet.address,
      ianaName: "",
      multiHash: "sha3-256",
      oid: "2.16.840.1.101.3.4.2.1",
      outputLength: 256,
      status: 1,
    } satisfies InsertHashAlgorithmSchema;

    const responseBuild: SupertestJsonRpcResponse = await request(server)
      .post("/jsonrpc")
      .auth(testAdmin.token, { type: "bearer" })
      .send({
        id: 231,
        jsonrpc: "2.0",
        method: "insertHashAlgorithm",
        params: [param],
      });

    expect(responseBuild.body).toStrictEqual({
      error: {
        code: -32_600,
        message: "Invalid 'params.0.ianaName': ianaName can't be empty",
      },
      id: 231,
      jsonrpc: "2.0",
    });
    expect(responseBuild.status).toBe(400);
  });
});
