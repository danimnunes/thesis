import type { TrackAndTrace } from "@ebsiint-sc/track-and-trace";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { RawServerDefault } from "fastify";
import type { GenerateKeyPairResult } from "jose";

import { encode } from "@ebsiint-api/shared";
import { TrackAndTrace__factory } from "@ebsiint-sc/track-and-trace";
import { util } from "@europeum-ebsi/key-did-resolver";
import { EbsiWallet } from "@europeum-ebsi/wallet-lib";
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
import { randomBytes } from "node:crypto";
import request from "supertest";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type { ApiConfig } from "../../config/configuration.ts";
import type { JsonRpcResponseObject } from "./jsonrpc.interface.ts";
import type {
  AuthoriseDidSchema,
  CreateDocumentSchema,
  GrantAccessSchema,
  RemoveDocumentSchema,
  RevokeAccessSchema,
  UnsignedTransaction,
  WriteEventSchema,
} from "./validators/index.ts";

import { getNestFastifyApplication } from "../../../tests/utils/app.ts";
import { setupTestEnv } from "../../../tests/utils/trackAndTrace.ts";
import { AccountType, Permission } from "../../shared/constants.ts";
import { didToHex } from "../../shared/utils.ts";
import { LedgerService } from "../ledger/ledger.service.ts";
import { JsonRpcModule } from "./jsonrpc.module.ts";
import { formatEthersUnsignedTransaction } from "./jsonrpc.utils.ts";

type JsonRpcParams =
  | AuthoriseDidSchema
  | CreateDocumentSchema
  | GrantAccessSchema
  | RemoveDocumentSchema
  | RevokeAccessSchema
  | WriteEventSchema;

interface SupertestJsonRpcResponse {
  body: JsonRpcResponseObject;
  status: number;
}

interface UserDetails {
  accessToken: {
    tntAuthorise: string;
    tntCreate: string;
    tntWrite: string;
  };
  did: string;
  wallet: ethers.BaseWallet;
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
  let server: RawServerDefault;
  let trackAndTraceContract: TrackAndTrace;
  let configService: ConfigService<ApiConfig, true>;
  let testEnv: Awaited<ReturnType<typeof setupTestEnv>>;

  const user1 = {
    accessToken: {
      tntAuthorise: "",
      tntCreate: "",
      tntWrite: "",
    },
    did: "did:ebsi:zf62uhvaQuUZty6sMxz9qVV",
    wallet: ethers.Wallet.createRandom(),
  } satisfies UserDetails;
  const user2 = {
    accessToken: {
      tntAuthorise: "",
      tntCreate: "",
      tntWrite: "",
    },
    did: "did:ebsi:z25eGB9RuaYR1nQGpH6mvm4Q",
    wallet: ethers.Wallet.createRandom(),
  } satisfies UserDetails;
  const user3Wallet = ethers.Wallet.createRandom();
  const user3PublicKeyJwk = encode.publicKey.fromHexToJWK(
    user3Wallet.publicKey,
  );
  const user3 = {
    accessToken: {
      tntAuthorise: "",
      tntCreate: "",
      tntWrite: "",
    },
    did: util.createDid(user3PublicKeyJwk),
    wallet: user3Wallet,
  } satisfies UserDetails;

  let authApiKeyPair: GenerateKeyPairResult;
  let authApiKid: string;
  const documentHash1 = `0x${randomBytes(32).toString("hex")}`;
  const documentHash2 = `0x${randomBytes(32).toString("hex")}`;

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

    trackAndTraceContract = testEnv.trackAndTraceContract;

    const trackAndTraceContractAddress =
      await trackAndTraceContract.getAddress();

    vi.stubEnv("CONTRACT_ADDR", trackAndTraceContractAddress);

    // Mock TrackAndTrace contract
    vi.spyOn(TrackAndTrace__factory, "connect").mockImplementation(
      // Create new instance without runner (provider)
      () => trackAndTraceContract.connect(),
    );

    // Mock LedgerService
    vi.spyOn(LedgerService.prototype, "getProvider").mockImplementation(
      // @ts-expect-error Error due to a mismatch between ESM and CommonJS modules
      () => testEnv.provider,
    );

    // Start server
    app = await getNestFastifyApplication({
      imports: [JsonRpcModule],
    });

    configService = app.get<ConfigService<ApiConfig, true>>(ConfigService);

    await app.init();
    const fastifyInstance = app.getHttpAdapter().getInstance();
    await fastifyInstance.ready();
    server = app.getHttpServer();

    // Generate key pair for Authorisation API v4 and create access token
    authApiKeyPair = await generateKeyPair("ES256");
    const publicKeyJwk = await exportJWK(authApiKeyPair.publicKey);
    authApiKid = await calculateJwkThumbprint(publicKeyJwk);

    const createAccessToken = (sub: string, scp: string) => {
      return new SignJWT({ scp, sub })
        .setProtectedHeader({
          alg: "ES256",
          kid: authApiKid,
          typ: "JWT",
        })
        .sign(authApiKeyPair.privateKey);
    };

    user1.accessToken.tntAuthorise = await createAccessToken(
      user1.did,
      "openid tnt_authorise",
    );
    user1.accessToken.tntCreate = await createAccessToken(
      user1.did,
      "openid tnt_create",
    );
    user1.accessToken.tntWrite = await createAccessToken(
      user1.did,
      "openid tnt_write",
    );

    user2.accessToken.tntAuthorise = await createAccessToken(
      user2.did,
      "openid tnt_authorise",
    );
    user2.accessToken.tntCreate = await createAccessToken(
      user2.did,
      "openid tnt_create",
    );
    user2.accessToken.tntWrite = await createAccessToken(
      user2.did,
      "openid tnt_write",
    );

    user3.accessToken.tntAuthorise = await createAccessToken(
      user3.did,
      "openid tnt_authorise",
    );
    user3.accessToken.tntCreate = await createAccessToken(
      user3.did,
      "openid tnt_create",
    );
    user3.accessToken.tntWrite = await createAccessToken(
      user3.did,
      "openid tnt_write",
    );

    // Mock Auth API and DIDR API
    const authorisationApiUrl = configService.get("authorisationApiUrl", {
      infer: true,
    });
    const didRegistryApiUrl = configService.get("didRegistryApiUrl", {
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
      // Mock users 1 and 2 DID documents (the documents don't matter, they just need to exist)
      http.get(
        escapeDid(`${didRegistryApiUrl}/identifiers/${user1.did}`),
        ({ request }) => {
          // Make sure the request has the x-request-id header
          if (!request.headers.has("x-request-id")) {
            return HttpResponse.json(
              "Invalid request (missing x-request-id header)",
              { status: 400 },
            );
          }

          return HttpResponse.json({});
        },
      ),
      http.get(
        escapeDid(`${didRegistryApiUrl}/identifiers/${user2.did}`),
        ({ request }) => {
          // Make sure the request has the x-request-id header
          if (!request.headers.has("x-request-id")) {
            return HttpResponse.json(
              "Invalid request (missing x-request-id header)",
              { status: 400 },
            );
          }

          return HttpResponse.json({});
        },
      ),
    );

    // Grant "write" access to user1 and user3 on documentsWithBlockSource[0]
    const { creatorAccount } = testEnv;
    const document = testEnv.documentsWithBlockSource[0]!;

    const txWrite1 = await trackAndTraceContract.grantAccess(
      document.documentHash,
      Buffer.from(creatorAccount),
      await didToHex(user1.did),
      0,
      0,
      1,
    );

    await txWrite1.wait();

    const txWrite2 = await trackAndTraceContract.grantAccess(
      document.documentHash,
      Buffer.from(creatorAccount),
      await didToHex(user3.did),
      0,
      1,
      1,
    );

    await txWrite2.wait();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  afterAll(async () => {
    mockServer.close();

    await app.close();
  });

  describe("Generic tests", () => {
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
        scp: "openid tnt_authorise",
        sub: user1.did,
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
        scp: "openid tnt_authorise",
        sub: user1.did,
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

    it("should throw Bad Request for a bad JSON-RPC call", async () => {
      expect.assertions(4);

      let response = await request(server)
        .post("/jsonrpc")
        .auth(user1.accessToken.tntAuthorise, { type: "bearer" })
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
        .auth(user1.accessToken.tntAuthorise, { type: "bearer" })
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

    it("should throw an Invalid Request error for bad method", async () => {
      expect.assertions(2);

      const response = await request(server)
        .post("/jsonrpc")
        .auth(user1.accessToken.tntAuthorise, { type: "bearer" })
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
        authorisedDid: user1.did,
        from: user1.wallet.address,
        senderDid: user1.did,
        whiteList: true,
      } satisfies AuthoriseDidSchema;

      const accessToken = user1.accessToken.tntAuthorise;

      const responseBuild: SupertestJsonRpcResponse = await request(server)
        .post("/jsonrpc")
        .auth(accessToken, { type: "bearer" })
        .send({
          id: 231,
          jsonrpc: "2.0",
          method: "authoriseDid",
          params: [param],
        });

      expect(responseBuild.status).toBe(200);
      const transaction = responseBuild.body.result as UnsignedTransaction;

      const signer = user1.wallet;
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
        .auth(accessToken, { type: "bearer" })
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

    it("should throw an error when the unsignedTransaction has been tampered", async () => {
      expect.assertions(6);

      const param1 = {
        authorisedDid: user1.did,
        from: user1.wallet.address,
        senderDid: user1.did,
        whiteList: true,
      } satisfies AuthoriseDidSchema;

      const param2 = {
        authorisedDid: user1.did,
        from: user1.wallet.address,
        senderDid: user1.did,
        whiteList: false,
      } satisfies AuthoriseDidSchema;

      const accessToken = user1.accessToken.tntAuthorise;

      const responseBuild1: SupertestJsonRpcResponse = await request(server)
        .post("/jsonrpc")
        .auth(accessToken, { type: "bearer" })
        .send({
          id: 231,
          jsonrpc: "2.0",
          method: "authoriseDid",
          params: [param1],
        });

      expect(responseBuild1.status).toBe(200);
      const transaction1 = responseBuild1.body.result as UnsignedTransaction;

      const responseBuild2: SupertestJsonRpcResponse = await request(server)
        .post("/jsonrpc")
        .auth(accessToken, { type: "bearer" })
        .send({
          id: 232,
          jsonrpc: "2.0",
          method: "authoriseDid",
          params: [param2],
        });

      expect(responseBuild2.status).toBe(200);
      const transaction2 = responseBuild2.body.result as UnsignedTransaction;

      const randomSigner = ethers.Wallet.createRandom();
      const uTx = formatEthersUnsignedTransaction(transaction1);

      const sgnTx1 = await randomSigner.signTransaction(uTx);
      const signature = ethers.Transaction.from(sgnTx1).signature;
      if (!signature) {
        throw new Error("Signature not found");
      }
      const { r, s, v } = signature;

      // Tampering signatures
      const responseSend1 = await request(server)
        .post("/jsonrpc")
        .auth(accessToken, { type: "bearer" })
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
        .auth(accessToken, { type: "bearer" })
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

    it("should throw an error if the from attribute is not a valid Ethereum address", async () => {
      expect.assertions(2);

      const accessToken = user1.accessToken.tntAuthorise;
      const param = {
        authorisedDid: user1.did,
        from: "0x123",
        senderDid: user1.did,
        whiteList: true,
      } satisfies AuthoriseDidSchema;

      const responseBuild = await request(server)
        .post("/jsonrpc")
        .auth(accessToken, { type: "bearer" })
        .send({
          id: 123,
          jsonrpc: "2.0",
          method: "authoriseDid",
          params: [param],
        });

      expect(responseBuild.body).toStrictEqual({
        error: {
          code: -32_600,
          message: "Invalid 'params.0.from': Invalid Ethereum address",
        },
        id: 123,
        jsonrpc: "2.0",
      });
      expect(responseBuild.status).toBe(400);
    });
  });

  // Tests to be repeated for every method
  describe.each([
    { test: "authoriseDid", user: user1 },
    { test: "createDocument", user: user1 },
    {
      test: "createDocument(external timestamp)",
      user: user1,
    },
    { test: "grantAccess", user: user1 },
    { test: "grantAccess(granted by did:key)", user: user3 },
    { test: "revokeAccess(revoked by did:key)", user: user3 },
    { test: "revokeAccess", user: user1 },
    { test: "writeEvent", user: user1 },
    { test: "writeEvent", user: user3 },
    { test: "writeEvent(external timestamp)", user: user1 },
    { test: "removeDocument", user: user1 },
  ] as const)(
    "/jsonrpc with method $test (user: $user.did)",
    ({ test, user }) => {
      const method = test
        .replace("(external timestamp)", "")
        .replace("(granted by did:key)", "")
        .replace("(revoked by did:key)", "");

      it("should return a valid unsigned transaction that we can sign and send to sendSignedTransaction", async () => {
        expect.assertions(4);

        let param: JsonRpcParams;
        let accessToken: string;
        const signer = user.wallet;

        switch (test) {
          case "authoriseDid": {
            param = {
              authorisedDid: user.did,
              from: signer.address,
              senderDid: user.did,
              whiteList: true,
            } satisfies AuthoriseDidSchema;
            accessToken = user.accessToken.tntAuthorise;
            break;
          }
          case "createDocument": {
            param = {
              didEbsiCreator: user.did,
              documentHash: documentHash1,
              documentMetadata: "test metadata",
              from: signer.address,
            } satisfies CreateDocumentSchema;
            accessToken = user.accessToken.tntCreate;
            break;
          }
          case "createDocument(external timestamp)": {
            param = {
              didEbsiCreator: user.did,
              documentHash: documentHash2,
              documentMetadata: "test metadata",
              from: signer.address,
              timestamp: Math.floor(Date.now() / 1000),
              timestampProof: `0x${randomBytes(32).toString("hex")}`,
            } satisfies CreateDocumentSchema;
            accessToken = user.accessToken.tntCreate;
            break;
          }
          case "grantAccess": {
            // access granted by a did:ebsi
            param = {
              documentHash: documentHash2,
              from: signer.address,
              grantedByAccount: await didToHex(user.did),
              grantedByAccType: AccountType.DID_EBSI,
              permission: Permission.DELEGATE,
              subjectAccount: await didToHex(user3.did),
              subjectAccType: AccountType.DID_KEY,
            } satisfies GrantAccessSchema;
            accessToken = user1.accessToken.tntWrite;
            break;
          }
          case "grantAccess(granted by did:key)": {
            param = {
              documentHash: documentHash2,
              from: signer.address,
              grantedByAccount: await didToHex(user3.did),
              grantedByAccType: AccountType.DID_KEY,
              permission: Permission.WRITE,
              subjectAccount: await didToHex(user2.did),
              subjectAccType: AccountType.DID_EBSI,
            } satisfies GrantAccessSchema;
            accessToken = user3.accessToken.tntWrite;
            break;
          }
          case "removeDocument": {
            param = {
              documentHash: documentHash1,
              from: signer.address,
            } satisfies RemoveDocumentSchema;
            accessToken = user.accessToken.tntWrite;
            break;
          }
          case "revokeAccess": {
            // access revoked by a did:ebsi
            param = {
              documentHash: documentHash2,
              from: signer.address,
              permission: 0,
              revokedByAccount: await didToHex(user.did),
              subjectAccount: await didToHex(user3.did),
            } satisfies RevokeAccessSchema;
            accessToken = user.accessToken.tntWrite;
            break;
          }
          case "revokeAccess(revoked by did:key)": {
            // access revoked by a did:key
            param = {
              documentHash: documentHash2,
              from: signer.address,
              permission: 1,
              revokedByAccount: await didToHex(user3.did),
              subjectAccount: await didToHex(user2.did),
            } satisfies RevokeAccessSchema;
            accessToken = user3.accessToken.tntWrite;
            break;
          }
          case "writeEvent": {
            const document = testEnv.documentsWithBlockSource[0]!;
            param = {
              eventParams: {
                documentHash: document.documentHash,
                externalHash: `0x${randomBytes(32).toString("hex")}`,
                metadata: "test event metadata",
                origin: "",
                sender: await didToHex(user.did),
              },
              from: signer.address,
            } satisfies WriteEventSchema;
            accessToken = user.accessToken.tntWrite;
            break;
          }
          case "writeEvent(external timestamp)": {
            const document = testEnv.documentsWithBlockSource[0]!;
            param = {
              eventParams: {
                documentHash: document.documentHash,
                externalHash: `0x${randomBytes(32).toString("hex")}`,
                metadata: "test event metadata",
                origin: "",
                sender: await didToHex(user.did),
              },
              from: signer.address,
              timestamp: Math.floor(Date.now() / 1000),
              timestampProof: `0x${randomBytes(32).toString("hex")}`,
            } satisfies WriteEventSchema;
            accessToken = user.accessToken.tntWrite;
            break;
          }
          default: {
            // TS will return an error if we forget to cover a case
            const exhaustiveCheck: never = test;
            throw new Error(
              `Test Error: Invalid method ${exhaustiveCheck as string}`,
            );
          }
        }

        const responseBuild: SupertestJsonRpcResponse = await request(server)
          .post("/jsonrpc")
          .auth(accessToken, { type: "bearer" })
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
          unsignedTransaction as UnsignedTransaction,
        );

        const sgnTx = await signer.signTransaction(uTx);
        const signature = ethers.Transaction.from(sgnTx).signature;
        if (!signature) {
          throw new Error("Signature not found");
        }
        const { r, s, v } = signature;

        const responseSend = await request(server)
          .post("/jsonrpc")
          .auth(accessToken, { type: "bearer" })
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
      });

      it(`should throw an Invalid Request error for bad use of ${method}`, async () => {
        const signer = ethers.Wallet.createRandom();

        const testSetup: {
          accessToken: string;
          expectedErrorMessage: string;
          params: JsonRpcParams;
        }[] = [];

        switch (test) {
          case "authoriseDid": {
            testSetup.push(
              {
                accessToken: user2.accessToken.tntAuthorise,
                expectedErrorMessage: `Invalid 'params.0.authorisedDid': The DID is not a valid DID URL`,
                params: {
                  authorisedDid: "not did",
                  from: signer.address,
                  senderDid: user.did,
                  whiteList: true,
                } satisfies AuthoriseDidSchema,
              },
              {
                accessToken: user2.accessToken.tntAuthorise,
                expectedErrorMessage: `Invalid 'params.0.authorisedDid': The DID must start with "did:ebsi:"`,
                params: {
                  authorisedDid: "did:something:else",
                  from: signer.address,
                  senderDid: user.did,
                  whiteList: true,
                } satisfies AuthoriseDidSchema,
              },
              {
                accessToken: user.accessToken.tntAuthorise,
                expectedErrorMessage:
                  "Invalid 'params.0.authorisedDid': Unsupported version \"2\"",
                params: {
                  authorisedDid:
                    "did:ebsi:znxntxQrN369GsNyjFjYb8fuvU7g3sJGyYGwMTcUGdzuy",
                  from: signer.address,
                  senderDid: user.did,
                  whiteList: true,
                } satisfies AuthoriseDidSchema,
              },
            );

            const randomAuthorisedDid = EbsiWallet.createDid();
            const didRegistryApiUrl = configService.get("didRegistryApiUrl", {
              infer: true,
            });
            mockServer.use(
              http.get(
                escapeDid(
                  `${didRegistryApiUrl}/identifiers/${randomAuthorisedDid}`,
                ),
                ({ request }) => {
                  // Make sure the request has the x-request-id header
                  if (!request.headers.has("x-request-id")) {
                    return HttpResponse.json(
                      "Invalid request (missing x-request-id header)",
                      { status: 400 },
                    );
                  }

                  return HttpResponse.json(
                    {
                      detail: `Identifier ${randomAuthorisedDid} not found`,
                      status: 404,
                      title: "Identifier Not Found",
                      type: "about:blank",
                    },
                    { status: 404 },
                  );
                },
              ),
            );

            testSetup.push(
              {
                accessToken: user.accessToken.tntAuthorise,
                expectedErrorMessage: `Invalid 'params.0.authorisedDid': Identifier ${randomAuthorisedDid} not found | Registry used: https://api-test.ebsi.eu/did-registry/v5/identifiers`,
                params: {
                  authorisedDid: randomAuthorisedDid, // Random DID that doesn't exist
                  from: signer.address,
                  senderDid: user.did,
                  whiteList: true,
                } satisfies AuthoriseDidSchema,
              },
              {
                accessToken: user.accessToken.tntAuthorise,
                expectedErrorMessage:
                  "Access token sub doesn't match the DID from the payload",
                params: {
                  authorisedDid: user2.did,
                  from: signer.address,
                  senderDid: EbsiWallet.createDid(), // senderDid doesn't match the access token subject
                  whiteList: true,
                } satisfies AuthoriseDidSchema,
              },
            );

            break;
          }
          case "createDocument": {
            testSetup.push(
              {
                accessToken: user.accessToken.tntAuthorise,
                expectedErrorMessage:
                  "'createDocument' requires an access token with the scope 'tnt_create'",
                params: {
                  didEbsiCreator: user.did,
                  documentHash: `0x${randomBytes(32).toString("hex")}`,
                  documentMetadata: "test metadata",
                  from: signer.address,
                } satisfies CreateDocumentSchema,
              },
              {
                accessToken: user.accessToken.tntCreate,
                expectedErrorMessage:
                  "Invalid 'params.0.documentHash': Must start with 0x",
                params: {
                  didEbsiCreator: user.did,
                  documentHash: `bad-document-hash`,
                  documentMetadata: "test metadata",
                  from: signer.address,
                } satisfies CreateDocumentSchema,
              },
            );

            break;
          }
          case "createDocument(external timestamp)": {
            testSetup.push(
              {
                accessToken: user.accessToken.tntCreate,
                expectedErrorMessage:
                  "Invalid 'params.0.timestamp': Invalid input",
                params: {
                  didEbsiCreator: user.did,
                  documentHash: `0x${randomBytes(32).toString("hex")}`,
                  documentMetadata: "test metadata",
                  from: signer.address,
                  timestamp: "bad-timestamp",
                  timestampProof: `0x${randomBytes(32).toString("hex")}`,
                } satisfies CreateDocumentSchema,
              },
              {
                accessToken: user.accessToken.tntCreate,
                expectedErrorMessage:
                  "Invalid 'params.0.timestampProof': Must start with 0x",
                params: {
                  didEbsiCreator: user.did,
                  documentHash: `0x${randomBytes(32).toString("hex")}`,
                  documentMetadata: "test metadata",
                  from: signer.address,
                  timestamp: Math.floor(Date.now() / 1000),
                  timestampProof: "bad proof",
                } satisfies CreateDocumentSchema,
              },
            );

            break;
          }
          case "grantAccess": {
            testSetup.push(
              {
                accessToken: user1.accessToken.tntWrite,
                expectedErrorMessage:
                  "Invalid 'params.0.grantedByAccount': The public key must be secp256k1 uncompressed (64 bytes or 65 bytes with 0x04 prefix)",
                params: {
                  documentHash: documentHash2,
                  from: signer.address,
                  grantedByAccount: `0x${Buffer.from("bad did").toString("hex")}`,
                  grantedByAccType: AccountType.DID_EBSI,
                  permission: Permission.DELEGATE,
                  subjectAccount: `0x${Buffer.from(user2.did).toString("hex")}`,
                  subjectAccType: AccountType.DID_EBSI,
                } satisfies GrantAccessSchema,
              },
              {
                accessToken: user1.accessToken.tntWrite,
                expectedErrorMessage:
                  "Invalid 'params.0.subjectAccType': Number must be 0 (did:ebsi) or 1 (did:key)",
                params: {
                  documentHash: documentHash2,
                  from: signer.address,
                  grantedByAccount: `0x${Buffer.from(user1.did).toString("hex")}`,
                  grantedByAccType: AccountType.DID_EBSI,
                  permission: Permission.DELEGATE,
                  subjectAccount: `0x${Buffer.from(user2.did).toString("hex")}`,
                  subjectAccType: 10,
                } satisfies GrantAccessSchema,
              },
              {
                accessToken: user1.accessToken.tntWrite,
                expectedErrorMessage:
                  "Invalid 'params.0': subjectAccount and subjectAccType don't match",
                params: {
                  documentHash: documentHash2,
                  from: signer.address,
                  grantedByAccount: `0x${Buffer.from(user1.did).toString("hex")}`,
                  grantedByAccType: AccountType.DID_EBSI,
                  permission: Permission.DELEGATE,
                  subjectAccount: `0x${Buffer.from(user2.did).toString("hex")}`,
                  subjectAccType: AccountType.DID_KEY,
                } satisfies GrantAccessSchema,
              },
              {
                accessToken: user1.accessToken.tntWrite,
                expectedErrorMessage:
                  "Invalid 'params.0': grantedByAccount and grantedByAccType don't match",
                params: {
                  documentHash: documentHash2,
                  from: signer.address,
                  grantedByAccount: `0x${Buffer.from(user1.did).toString("hex")}`,
                  grantedByAccType: AccountType.DID_KEY,
                  permission: Permission.DELEGATE,
                  subjectAccount: `0x${Buffer.from(user2.did).toString("hex")}`,
                  subjectAccType: AccountType.DID_EBSI,
                } satisfies GrantAccessSchema,
              },
              {
                accessToken: user1.accessToken.tntWrite,
                expectedErrorMessage:
                  "Access token sub doesn't match the DID from the payload",
                params: {
                  documentHash: documentHash2,
                  from: signer.address,
                  // Random DID, doesn't match with access token sub
                  grantedByAccount: `0x${Buffer.from(EbsiWallet.createDid()).toString("hex")}`,
                  grantedByAccType: AccountType.DID_EBSI,
                  permission: Permission.DELEGATE,
                  subjectAccount: `0x${Buffer.from(user2.did).toString("hex")}`,
                  subjectAccType: AccountType.DID_EBSI,
                } satisfies GrantAccessSchema,
              },
            );

            break;
          }
          case "grantAccess(granted by did:key)": {
            testSetup.push(
              {
                accessToken: user1.accessToken.tntWrite,
                expectedErrorMessage:
                  "Invalid 'params.0.grantedByAccount': The public key must be secp256k1 uncompressed (64 bytes or 65 bytes with 0x04 prefix)",
                params: {
                  documentHash: documentHash2,
                  from: signer.address,
                  grantedByAccount: `0x${Buffer.from("bad did").toString("hex")}`,
                  grantedByAccType: AccountType.DID_EBSI,
                  permission: Permission.DELEGATE,
                  subjectAccount: `0x${Buffer.from(user2.did).toString("hex")}`,
                  subjectAccType: AccountType.DID_EBSI,
                } satisfies GrantAccessSchema,
              },
              {
                accessToken: user1.accessToken.tntWrite,
                expectedErrorMessage:
                  "Invalid 'params.0.subjectAccType': Number must be 0 (did:ebsi) or 1 (did:key)",
                params: {
                  documentHash: documentHash2,
                  from: signer.address,
                  grantedByAccount: `0x${Buffer.from(user1.did).toString("hex")}`,
                  grantedByAccType: AccountType.DID_EBSI,
                  permission: Permission.DELEGATE,
                  subjectAccount: `0x${Buffer.from(user2.did).toString("hex")}`,
                  subjectAccType: 10,
                } satisfies GrantAccessSchema,
              },
              {
                accessToken: user1.accessToken.tntWrite,
                expectedErrorMessage:
                  "Access token sub doesn't match the DID from the payload",
                params: {
                  documentHash: documentHash2,
                  from: signer.address,
                  // Random DID, doesn't match with access token sub
                  grantedByAccount: `0x${Buffer.from(EbsiWallet.createDid()).toString("hex")}`,
                  grantedByAccType: AccountType.DID_EBSI,
                  permission: Permission.DELEGATE,
                  subjectAccount: `0x${Buffer.from(user2.did).toString("hex")}`,
                  subjectAccType: AccountType.DID_EBSI,
                } satisfies GrantAccessSchema,
              },
            );

            break;
          }
          case "removeDocument": {
            testSetup.push(
              {
                accessToken: user.accessToken.tntAuthorise,
                expectedErrorMessage:
                  "'removeDocument' requires an access token with the scope 'tnt_write'",
                params: {
                  documentHash: `0x${randomBytes(32).toString("hex")}`,
                  from: signer.address,
                } satisfies RemoveDocumentSchema,
              },
              {
                accessToken: user.accessToken.tntWrite,
                expectedErrorMessage:
                  "Invalid 'params.0.documentHash': Must start with 0x",
                params: {
                  documentHash: `bad-document-hash`,
                  from: signer.address,
                } satisfies RemoveDocumentSchema,
              },
            );

            break;
          }
          case "revokeAccess":
          case "revokeAccess(revoked by did:key)": {
            testSetup.push(
              {
                accessToken: user1.accessToken.tntWrite,
                expectedErrorMessage:
                  "Invalid 'params.0.revokedByAccount': The public key must be secp256k1 uncompressed (64 bytes or 65 bytes with 0x04 prefix)",
                params: {
                  documentHash: documentHash2,
                  from: signer.address,
                  permission: 0,
                  revokedByAccount: `0x${Buffer.from("bad did").toString("hex")}`,
                  subjectAccount: `0x${Buffer.from(user2.did).toString("hex")}`,
                } satisfies RevokeAccessSchema,
              },
              {
                accessToken: user1.accessToken.tntWrite,
                expectedErrorMessage:
                  "Invalid 'params.0.permission': Number must be 0 (delegate) or 1 (write)",
                params: {
                  documentHash: documentHash2,
                  from: signer.address,
                  permission: 10,
                  revokedByAccount: `0x${Buffer.from(user1.did).toString("hex")}`,
                  subjectAccount: `0x${Buffer.from(user2.did).toString("hex")}`,
                } satisfies RevokeAccessSchema,
              },
            );

            break;
          }
          case "writeEvent": {
            testSetup.push(
              {
                accessToken: user.accessToken.tntCreate,
                expectedErrorMessage:
                  "'writeEvent' requires an access token with the scope 'tnt_write'",
                params: {
                  eventParams: {
                    documentHash: documentHash1,
                    externalHash: `0x${randomBytes(32).toString("hex")}`,
                    metadata: "test event metadata",
                    origin: "",
                    sender: await didToHex(user.did),
                  },
                  from: signer.address,
                } satisfies WriteEventSchema,
              },
              {
                accessToken: user.accessToken.tntWrite,
                expectedErrorMessage:
                  "Invalid 'params.0.eventParams.documentHash': Must start with 0x",
                params: {
                  eventParams: {
                    documentHash: `bad-document-hash`, // Invalid hash
                    externalHash: `0x${randomBytes(32).toString("hex")}`,
                    metadata: "test event metadata",
                    origin: "",
                    sender: await didToHex(user.did),
                  },
                  from: signer.address,
                } satisfies WriteEventSchema,
              },
              {
                accessToken: user.accessToken.tntWrite,
                expectedErrorMessage: "Invalid 'params.0.eventParams.sender",
                params: {
                  eventParams: {
                    documentHash: documentHash1,
                    externalHash: `0x${randomBytes(32).toString("hex")}`,
                    metadata: "test event metadata",
                    origin: "",
                    sender: user.did, // DID is not encoded in hexadecimal
                  },
                  from: signer.address,
                } satisfies WriteEventSchema,
              },
              {
                accessToken: user.accessToken.tntWrite,
                expectedErrorMessage:
                  "Invalid 'params.0.eventParams.sender': The public key must be secp256k1 uncompressed (64 bytes or 65 bytes with 0x04 prefix)",
                params: {
                  eventParams: {
                    documentHash: documentHash1,
                    externalHash: `0x${randomBytes(32).toString("hex")}`,
                    metadata: "test event metadata",
                    origin: "",
                    sender: `0x${randomBytes(32).toString("hex")}`, // Not a DID
                  },
                  from: signer.address,
                } satisfies WriteEventSchema,
              },
              {
                accessToken: user.accessToken.tntWrite,
                expectedErrorMessage:
                  "Access token sub doesn't match the DID from the payload",
                params: {
                  eventParams: {
                    documentHash: documentHash1,
                    externalHash: `0x${randomBytes(32).toString("hex")}`,
                    metadata: "test event metadata",
                    origin: "",
                    sender: await didToHex(EbsiWallet.createDid()),
                  },
                  from: signer.address,
                } satisfies WriteEventSchema,
              },
            );

            break;
          }
          case "writeEvent(external timestamp)": {
            testSetup.push(
              {
                accessToken: user.accessToken.tntCreate,
                expectedErrorMessage:
                  "'writeEvent' requires an access token with the scope 'tnt_write'",
                params: {
                  eventParams: {
                    documentHash: documentHash1,
                    externalHash: `0x${randomBytes(32).toString("hex")}`,
                    metadata: "test event metadata",
                    origin: "",
                    sender: await didToHex(user.did),
                  },
                  from: signer.address,
                  timestamp: Math.floor(Date.now() / 1000),
                  timestampProof: `0x${randomBytes(32).toString("hex")}`,
                } satisfies WriteEventSchema,
              },
              {
                accessToken: user.accessToken.tntWrite,
                expectedErrorMessage:
                  "Invalid 'params.0.eventParams.documentHash': Must start with 0x",
                params: {
                  eventParams: {
                    documentHash: `bad-document-hash`, // Invalid hash
                    externalHash: `0x${randomBytes(32).toString("hex")}`,
                    metadata: "test event metadata",
                    origin: "",
                    sender: await didToHex(user.did),
                  },
                  from: signer.address,
                  timestamp: Math.floor(Date.now() / 1000),
                  timestampProof: `0x${randomBytes(32).toString("hex")}`,
                } satisfies WriteEventSchema,
              },
              {
                accessToken: user.accessToken.tntWrite,
                expectedErrorMessage: "Invalid 'params.0.eventParams.sender",
                params: {
                  eventParams: {
                    documentHash: documentHash1,
                    externalHash: `0x${randomBytes(32).toString("hex")}`,
                    metadata: "test event metadata",
                    origin: "",
                    sender: user.did, // DID is not encoded in hexadecimal
                  },
                  from: signer.address,
                  timestamp: Math.floor(Date.now() / 1000),
                  timestampProof: `0x${randomBytes(32).toString("hex")}`,
                } satisfies WriteEventSchema,
              },
              {
                accessToken: user.accessToken.tntWrite,
                expectedErrorMessage:
                  "Invalid 'params.0.eventParams.sender': The public key must be secp256k1 uncompressed (64 bytes or 65 bytes with 0x04 prefix)",
                params: {
                  eventParams: {
                    documentHash: documentHash1,
                    externalHash: `0x${randomBytes(32).toString("hex")}`,
                    metadata: "test event metadata",
                    origin: "",
                    sender: `0x${randomBytes(32).toString("hex")}`, // Not a DID
                  },
                  from: signer.address,
                  timestamp: Math.floor(Date.now() / 1000),
                  timestampProof: `0x${randomBytes(32).toString("hex")}`,
                } satisfies WriteEventSchema,
              },
              {
                accessToken: user.accessToken.tntWrite,
                expectedErrorMessage:
                  "Invalid 'params.0.timestamp': Invalid input",
                params: {
                  eventParams: {
                    documentHash: documentHash1,
                    externalHash: `0x${randomBytes(32).toString("hex")}`,
                    metadata: "test event metadata",
                    origin: "",
                    sender: await didToHex(user.did),
                  },
                  from: signer.address,
                  timestamp: "bad-timestamp",
                  timestampProof: `0x${randomBytes(32).toString("hex")}`,
                } satisfies WriteEventSchema,
              },
              {
                accessToken: user.accessToken.tntWrite,
                expectedErrorMessage:
                  "Invalid 'params.0.timestampProof': Must start with 0x",
                params: {
                  eventParams: {
                    documentHash: documentHash1,
                    externalHash: `0x${randomBytes(32).toString("hex")}`,
                    metadata: "test event metadata",
                    origin: "",
                    sender: await didToHex(user.did),
                  },
                  from: signer.address,
                  timestamp: Math.floor(Date.now() / 1000),
                  timestampProof: "bad-proof",
                } satisfies WriteEventSchema,
              },
            );

            break;
          }
          default: {
            // TS will return an error if we forget to cover a case
            const exhaustiveCheck: never = test;
            throw new Error(
              `Test Error: Invalid method ${exhaustiveCheck as string}`,
            );
          }
        }

        expect.assertions(testSetup.length * 2);

        // Run requests sequentially

        for (const setup of testSetup) {
          const response = await request(server)
            .post("/jsonrpc")
            .auth(setup.accessToken, { type: "bearer" })
            .send({
              id: 231,
              jsonrpc: "2.0",
              method,
              params: [setup.params],
            });

          expect(response.body).toStrictEqual({
            error: {
              code: -32_600,
              message: expect.stringContaining(setup.expectedErrorMessage),
            },
            id: 231,
            jsonrpc: "2.0",
          });
          expect(response.status).toBe(400);
        }
      });
    },
  );
});
