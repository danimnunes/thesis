import type { Tir } from "@ebsiint-sc/trusted-issuers-registry-v5";
import type { EbsiIssuer } from "@europeum-ebsi/verifiable-credential";
import type { Schemas } from "@europeum-ebsi/verifiable-credential/vcdm11.js";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { RawServerDefault } from "fastify";
import type { GenerateKeyPairResult } from "jose";
import type { MockInstance } from "vitest";

import {
  generatePrivateKey,
  getPublicKeyJwk,
  getSigner,
} from "@ebsiint-api/shared";
import { Tir__factory } from "@ebsiint-sc/trusted-issuers-registry-v5";
import * as vcLib from "@europeum-ebsi/verifiable-credential/vcdm11.js";
import { createVerifiableCredentialJwt } from "@europeum-ebsi/verifiable-credential/vcdm11.js";
import { ConfigService } from "@nestjs/config";
import { useContainer } from "class-validator";
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
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type { IssuerObject } from "../../../tests/utils/tir.ts";
import type { ApiConfig } from "../../config/configuration.ts";
import type { JsonRpcResponseObject } from "./jsonrpc.interface.ts";
import type { AddIssuerProxySchema } from "./validators/RequestAddIssuerProxySchema.ts";
import type { RemoveIssuerProxySchema } from "./validators/RequestRemoveIssuerProxySchema.ts";
import type { UnsignedTransaction } from "./validators/RequestSendSignedTransactionSchema.ts";
import type { SetAttributeDataSchema } from "./validators/RequestSetAttributeDataSchema.ts";
import type { SetAttributeMetadataSchema } from "./validators/RequestSetAttributeMetadataSchema.ts";
import type { UpdateIssuerProxySchema } from "./validators/RequestUpdateIssuerProxySchema.ts";

import { getNestFastifyApplication } from "../../../tests/utils/app.ts";
import { createDidDocument } from "../../../tests/utils/data.ts";
import { createIssuer, setupTestEnv } from "../../../tests/utils/tir.ts";
import { IssuerType } from "../issuers/issuers.constants.ts";
import { LedgerService } from "../ledger/ledger.service.ts";
import { JsonRpcModule } from "./jsonrpc.module.ts";
import { JsonRpcService } from "./jsonrpc.service.ts";
import { formatEthersUnsignedTransaction } from "./jsonrpc.utils.ts";

type JsonRpcParams =
  | AddIssuerProxySchema
  | RemoveIssuerProxySchema
  | SetAttributeDataSchema
  | SetAttributeMetadataSchema
  | UpdateIssuerProxySchema;

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

vi.mock("@europeum-ebsi/verifiable-credential/vcdm11.js", async () => {
  const mod = await vi.importActual<
    typeof import("@europeum-ebsi/verifiable-credential/vcdm11.js")
  >("@europeum-ebsi/verifiable-credential/vcdm11.js");

  return {
    ...mod,
  };
});

describe.each(["StatusList2021", "BitstringStatusList"] as const)(
  "JSON-RPC Module (using %s status list)",
  (statusList) => {
    let app: NestFastifyApplication;
    let server: RawServerDefault;
    let tirContract: Tir;
    let tirContractAddress: string;
    let jsonRpcService: JsonRpcService;
    let testEnv: Awaited<ReturnType<typeof setupTestEnv>>;
    let rootTao: IssuerObject;
    let tao1: IssuerObject;
    let tao1TirWriteAccessToken: string;
    let issuers: IssuerObject[];
    let issuer1TirInviteAccessToken: string;
    let isDidControlledByAddressMock: MockInstance;
    let authApiKeyPair: GenerateKeyPairResult;
    let authApiKid: string;
    let configService: ConfigService<ApiConfig, true>;
    let statusListCredentialJwt: string;
    let statusListCredentialPayload: Schemas["Attestation"];

    const mockServer = setupServer();

    function createParam(
      method: string,
      signer: ethers.BaseWallet,
      tamper = false,
    ) {
      let param: JsonRpcParams;
      const issuer1 = issuers[0]!;
      const issuer2 = issuers[1]!;

      switch (method) {
        case "addIssuerProxy": {
          param = {
            did: issuer1.did,
            from: signer.address,
            proxyData: tamper
              ? issuer2.proxies[0]!.utf8
              : issuer1.proxies[0]!.utf8,
          } satisfies AddIssuerProxySchema;
          break;
        }
        case "removeIssuerProxy": {
          param = {
            did: issuer1.did,
            from: signer.address,
            proxyId: tamper ? issuer2.proxies[0]!.id : issuer1.proxies[0]!.id,
          } satisfies RemoveIssuerProxySchema;
          break;
        }
        case "setAttributeData": {
          // update data attribute1
          param = {
            attributeData: `0x${crypto.randomBytes(12).toString("hex")}`,
            attributeId: issuer1.attribute.id,
            did: issuer1.did,
            from: signer.address,
          } satisfies SetAttributeDataSchema;
          break;
        }
        case "setAttributeMetadata": {
          // update metadata attribute1
          param = {
            attributeIdTao: issuer1.attributeIdTao,
            did: issuer1.did,
            from: signer.address,
            issuerType: issuer1.issuerType,
            revisionId: tamper ? issuer2.attribute.id : issuer1.attribute.id,
            taoDid: issuer1.tao,
          } satisfies SetAttributeMetadataSchema;
          break;
        }
        case "updateIssuerProxy": {
          param = {
            did: issuer1.did,
            from: signer.address,
            proxyData: issuer2.proxies[0]!.utf8,
            proxyId: tamper ? issuer2.proxies[0]!.id : issuer1.proxies[0]!.id,
          } satisfies UpdateIssuerProxySchema;
          break;
        }
        default: {
          throw new Error(`Test Error: Invalid method ${method}`);
        }
      }

      return param;
    }

    beforeAll(async () => {
      // Intercept network requests
      mockServer.listen({
        onUnhandledRequest: ({ url }, print) => {
          // Bypass local requests
          if (new URL(url).hostname === "127.0.0.1") return;

          print.error();
        },
      });

      // Spin up test blockchain
      testEnv = await setupTestEnv({
        issuersTotal: 5,
      });

      rootTao = testEnv.issuers[0]!;
      tao1 = testEnv.issuers[1]!;

      // generate data for 3 issuers
      issuers = [
        createIssuer(IssuerType.TI, tao1.did, tao1.attribute.id, rootTao.did),
        createIssuer(IssuerType.TI, tao1.did, tao1.attribute.id, rootTao.did),
        createIssuer(IssuerType.TI, tao1.did, tao1.attribute.id, rootTao.did),
      ];

      tirContract = testEnv.tirContract;
      tirContractAddress = await tirContract.getAddress();

      vi.stubEnv("BESU_TRUSTED_ISSUERS_REGISTRY_ADDRESS", tirContractAddress);

      // Mock TIR contract
      vi.spyOn(Tir__factory, "connect").mockImplementation(
        // Create new instance without runner (provider)
        () => tirContract.connect(),
      );

      // Mock LedgerService
      vi.spyOn(LedgerService.prototype, "getProvider").mockImplementation(
        // @ts-expect-error Error due to a mismatch between ESM and CommonJS modules
        () => testEnv.provider,
      );

      // Start server
      app = await getNestFastifyApplication({ imports: [JsonRpcModule] });

      configService = app.get<ConfigService<ApiConfig, true>>(ConfigService);

      useContainer(app.select(JsonRpcModule), { fallbackOnErrors: true });

      await app.init();
      const fastifyInstance = app.getHttpAdapter().getInstance();
      await fastifyInstance.ready();
      server = app.getHttpServer();

      jsonRpcService = app.get<JsonRpcService>(JsonRpcService);

      // Generate key pair for Authorisation API v3 and create access token
      authApiKeyPair = await generateKeyPair("ES256");
      const authApiPublicKeyJwk = await exportJWK(authApiKeyPair.publicKey);
      authApiKid = await calculateJwkThumbprint(authApiPublicKeyJwk);

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

            return HttpResponse.json({
              jwks_uri: `${authorisationApiUrl}/jwks`,
            });
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
            keys: [{ ...authApiPublicKeyJwk, kid: authApiKid }],
          });
        }),
      );

      // Generate access tokens
      issuer1TirInviteAccessToken = await new SignJWT({
        scp: "openid tir_invite",
        sub: issuers[0]!.did,
      })
        .setProtectedHeader({
          alg: "ES256",
          kid: authApiKid,
          typ: "JWT",
        })
        .sign(authApiKeyPair.privateKey);

      tao1TirWriteAccessToken = await new SignJWT({
        scp: "openid tir_write",
        sub: tao1.did,
      })
        .setProtectedHeader({
          alg: "ES256",
          kid: authApiKid,
          typ: "JWT",
        })
        .sign(authApiKeyPair.privateKey);

      // Generate proxy
      const privateKey = generatePrivateKey("ES256K");
      const {
        alg: publicKeyJwkAlg,
        kid: publicKeyJwkKid,
        ...publicKeyJwk
      } = await getPublicKeyJwk(privateKey, "ES256K");

      const issuer = {
        alg: "ES256K",
        did: issuers[0]!.did,
        kid: `${issuers[0]!.did}#keys-1`,
        signer: getSigner(privateKey, "ES256K"),
      } satisfies EbsiIssuer;

      const ebsiEnvConfig = configService.get("ebsiEnvConfig", { infer: true });

      statusListCredentialPayload =
        statusList === "BitstringStatusList"
          ? issuers[0]!.proxies[0]!.bitstringStatusListCredential
          : issuers[0]!.proxies[0]!.statusList2021Credential;
      statusListCredentialJwt = await createVerifiableCredentialJwt(
        statusListCredentialPayload,
        issuer,
        ebsiEnvConfig,
        {
          skipValidation: true,
        },
      );

      const didRegistryApiUrl = configService.get("didRegistryApiUrl", {
        infer: true,
      });
      const issuer1DidDocument = createDidDocument(
        issuer.did,
        issuer.kid,
        publicKeyJwk,
      );

      mockServer.use(
        // Mock DIDR API /identifiers/${issuer.did}
        http.get(
          escapeDid(`${didRegistryApiUrl}/identifiers/${issuer.did}`),
          ({ request }) => {
            // Make sure the request has the x-request-id header
            if (!request.headers.has("x-request-id")) {
              return HttpResponse.json(
                "Invalid request (missing x-request-id header)",
                { status: 400 },
              );
            }

            return HttpResponse.json(issuer1DidDocument);
          },
        ),
        // Make test status list JWT available
        http.get(
          escapeDid(
            `${issuers[0]!.proxies[0]!.obj.prefix}${issuers[0]!.proxies[0]!.obj.testSuffix}`,
          ),
          ({ request }) => {
            // Make sure the request DOES NOT contain the x-request-id header
            if (request.headers.has("x-request-id")) {
              return HttpResponse.json(
                "Invalid request (x-request-id header is present)",
                { status: 400 },
              );
            }

            return HttpResponse.json(statusListCredentialJwt);
          },
        ),
        // Create "not found" status list URL
        http.get("https://not-found.net/cred/1", ({ request }) => {
          // Make sure the request has the x-request-id header
          if (!request.headers.has("x-request-id")) {
            return HttpResponse.json(
              "Invalid request (missing x-request-id header)",
              { status: 400 },
            );
          }

          return new HttpResponse(undefined, { status: 404 });
        }),
      );
    });

    beforeEach(() => {
      // For the tests, we assume that the DID is controlled by the signer
      isDidControlledByAddressMock = vi.spyOn(
        jsonRpcService,
        "isDidControlledByAddress",
      );
      isDidControlledByAddressMock.mockImplementation(() => true);

      // Bypass VC validation, return payload directly
      vi.spyOn(vcLib, "verifyCredentialJwt").mockImplementation(
        (jwtToVerify: string) => {
          if (jwtToVerify === statusListCredentialJwt)
            return Promise.resolve(statusListCredentialPayload);

          throw new Error("Invalid JWT");
        },
      );
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    afterAll(async () => {
      mockServer.close();

      await app.close();
    });

    it("should throw an error if the DID does not exist", async () => {
      expect.assertions(4);

      const signer = ethers.Wallet.createRandom();
      const issuer = issuers[0]!;

      const param: SetAttributeMetadataSchema = {
        attributeIdTao: issuer.attributeIdTao,
        did: issuer.did,
        from: signer.address,
        issuerType: issuer.issuerType,
        revisionId: issuer.attribute.id,
        taoDid: issuer.tao,
      };

      // The DID does not exist
      mockServer.use(
        http.post(
          escapeDid(
            `${configService.get("didRegistryApiUrl", { infer: true })}/identifiers/${tao1.did}/actions`,
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
      isDidControlledByAddressMock.mockRestore();

      const responseBuild: SupertestJsonRpcResponse = await request(server)
        .post("/jsonrpc")
        .auth(tao1TirWriteAccessToken, { type: "bearer" })
        .send({
          id: 231,
          jsonrpc: "2.0",
          method: "setAttributeMetadata",
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
        .auth(tao1TirWriteAccessToken, { type: "bearer" })
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
          message: `The DID ${tao1.did} does not exist`,
        },
        id: "45",
        jsonrpc: "2.0",
      });
      expect(responseSend.status).toBe(400);
    });

    // Generic tests
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
        scp: "openid tir_invite",
        sub: issuers[0]!.did,
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
        scp: "openid didr_write",
        sub: issuers[0]!.did,
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
        .auth(tao1TirWriteAccessToken, { type: "bearer" })
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
        .auth(tao1TirWriteAccessToken, { type: "bearer" })
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

      const wallet = ethers.Wallet.createRandom();

      const transaction = {
        chainId: "0x1b3b",
        data: tirContract.interface.encodeFunctionData("getIssuerAttributes", [
          "random_issuer",
          "0x01",
          "0x01",
        ]),
        from: wallet.address,
        gasLimit: "0x1000000",
        gasPrice: "0x00",
        nonce: "0x00",
        to: tirContractAddress,
        value: "0x00",
      };

      const uTx = formatEthersUnsignedTransaction(
        transaction as UnsignedTransaction,
      );

      const sgnTx = await wallet.signTransaction(uTx);
      const signature = ethers.Transaction.from(sgnTx).signature;
      if (!signature) {
        throw new Error("Signature not found");
      }
      const { r, s, v } = signature;

      const responseSend = await request(server)
        .post("/jsonrpc")
        .auth(tao1TirWriteAccessToken, { type: "bearer" })
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

      const { chainId } = await testEnv.provider.getNetwork();
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
        .auth(tao1TirWriteAccessToken, { type: "bearer" })
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

      const signer = ethers.Wallet.createRandom();
      const issuer = issuers[0]!;

      const param: SetAttributeMetadataSchema = {
        attributeIdTao: issuer.attributeIdTao,
        did: issuer.did,
        from: signer.address,
        issuerType: issuer.issuerType,
        revisionId: issuer.attribute.id,
        taoDid: issuer.tao,
      };

      const responseBuild: SupertestJsonRpcResponse = await request(server)
        .post("/jsonrpc")
        .auth(tao1TirWriteAccessToken, { type: "bearer" })
        .send({
          id: 231,
          jsonrpc: "2.0",
          method: "setAttributeMetadata",
          params: [param],
        });

      expect(responseBuild.status).toBe(200);
      const transaction = responseBuild.body.result as UnsignedTransaction;

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
        .auth(tao1TirWriteAccessToken, { type: "bearer" })
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

    it("should throw an error if the signer doesn't control the DID", async () => {
      expect.assertions(4);

      const signer = ethers.Wallet.createRandom();
      const issuer = issuers[0]!;

      const param: SetAttributeMetadataSchema = {
        attributeIdTao: issuer.attributeIdTao,
        did: issuer.did,
        from: signer.address,
        issuerType: issuer.issuerType,
        revisionId: issuer.attribute.id,
        taoDid: issuer.tao,
      };

      // The DID is not controlled by the signer
      vi.spyOn(jsonRpcService, "isDidControlledByAddress").mockImplementation(
        () => Promise.resolve(false),
      );

      const responseBuild: SupertestJsonRpcResponse = await request(server)
        .post("/jsonrpc")
        .auth(tao1TirWriteAccessToken, { type: "bearer" })
        .send({
          id: 231,
          jsonrpc: "2.0",
          method: "setAttributeMetadata",
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
        .auth(tao1TirWriteAccessToken, { type: "bearer" })
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
          message: `The DID ${tao1.did} is not controlled by the address ${signer.address}`,
        },
        id: "45",
        jsonrpc: "2.0",
      });
      expect(responseSend.status).toBe(400);
    });

    // Tests to be repeated for every method
    describe.each([
      { method: "setAttributeMetadata" },
      { method: "setAttributeData" },
      { method: "setAttributeData", useTirInviteToken: true },
      { method: "addIssuerProxy" },
      { method: "updateIssuerProxy" },
      { method: "removeIssuerProxy" },
    ] as const)(
      "/jsonrpc with method %o",
      ({ method, useTirInviteToken = false }) => {
        it("should return a valid unsigned transaction that we can sign and send to sendSignedTransaction", async () => {
          expect.assertions(4);

          let accessToken = tao1TirWriteAccessToken;
          if (useTirInviteToken) {
            accessToken = issuer1TirInviteAccessToken;
          }

          const signer = ethers.Wallet.createRandom();
          const param: JsonRpcParams = createParam(method, signer);

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

        it("should accept a request without id", async () => {
          expect.assertions(2);

          const signer = ethers.Wallet.createRandom();

          const param = createParam(method, signer);

          const responseBuild = await request(server)
            .post("/jsonrpc")
            .auth(tao1TirWriteAccessToken, { type: "bearer" })
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
          const signer = ethers.Wallet.createRandom();

          const testSetup: {
            accessToken: string;
            expectedErrorMessage: string;
            params: JsonRpcParams;
          }[] = [];

          const issuer1 = issuers[0]!;

          switch (method) {
            case "addIssuerProxy": {
              testSetup.push(
                {
                  accessToken: tao1TirWriteAccessToken,
                  expectedErrorMessage: "Invalid 'params.0.did': Required",
                  params: {
                    from: signer.address,
                    // Missing "did"
                    // did: issuer1.did,
                    proxyData: issuer1.proxies[0]!.utf8,
                  } as AddIssuerProxySchema,
                },
                {
                  accessToken: tao1TirWriteAccessToken,
                  expectedErrorMessage:
                    "Invalid 'params.0.did': The DID must start with \"did:ebsi:\"",
                  params: {
                    // Invalid "did"
                    did: "did:key:z2dmzD81cgPx8Vki7JbuuMmFYrWPgYoytykUZ3eyqht1j9KbqWsaTDqWzTdxV8Up5ZsKEyY2287nhqc9wPxspHkyEn5xHi9Lnnt9kEkPJd2tFpmpx8z8dgHfbLmLhFRm5jpfvxGUwoykD87ec7znw9NhN9fMTBXmm4zb3amdW5SqZ7QW5A",
                    from: signer.address,
                    proxyData: issuer1.proxies[0]!.utf8,
                  } as AddIssuerProxySchema,
                },
                {
                  accessToken: tao1TirWriteAccessToken,
                  expectedErrorMessage:
                    "Invalid 'params.0.proxyData': Required",
                  params: {
                    did: issuer1.did,
                    from: signer.address,
                    // Missing "proxyData"
                    // proxyData: issuer1.proxies[0]!.utf8,
                  } as AddIssuerProxySchema,
                },
                {
                  accessToken: tao1TirWriteAccessToken,
                  expectedErrorMessage:
                    "Invalid 'params.0.proxyData': Missing prefix",
                  params: {
                    did: issuer1.did,
                    from: signer.address,
                    // Invalid "proxyData"
                    proxyData: JSON.stringify({
                      // "prefix" attribute is missing
                    }),
                  } as AddIssuerProxySchema,
                },
                {
                  accessToken: tao1TirWriteAccessToken,
                  expectedErrorMessage:
                    "Invalid 'params.0.proxyData': Missing headers",
                  params: {
                    did: issuer1.did,
                    from: signer.address,
                    // Invalid "proxyData"
                    proxyData: JSON.stringify({
                      prefix: "https://example.net",
                      // Missing "headers" attribute
                    }),
                  } as AddIssuerProxySchema,
                },
                {
                  accessToken: tao1TirWriteAccessToken,
                  expectedErrorMessage:
                    "Invalid 'params.0.proxyData': Missing testSuffix",
                  params: {
                    did: issuer1.did,
                    from: signer.address,
                    // Invalid "proxyData"
                    proxyData: JSON.stringify({
                      headers: {
                        Authorization: `Bearer ${crypto
                          .randomBytes(16)
                          .toString("hex")}`,
                      },
                      prefix: "https://example.net",
                      // Missing "testSuffix" attribute
                    }),
                  } as AddIssuerProxySchema,
                },
                {
                  accessToken: tao1TirWriteAccessToken,
                  expectedErrorMessage:
                    "Invalid 'params.0.proxyData': Error while loading https://not-found.net/cred/1",
                  params: {
                    did: issuer1.did,
                    from: signer.address,
                    // Invalid "proxyData"
                    proxyData: JSON.stringify({
                      headers: {
                        Authorization: `Bearer ${crypto
                          .randomBytes(16)
                          .toString("hex")}`,
                      },
                      prefix: "https://not-found.net",
                      testSuffix: "/cred/1",
                    }),
                  } as AddIssuerProxySchema,
                },
                {
                  accessToken: tao1TirWriteAccessToken,
                  expectedErrorMessage:
                    "Invalid 'params.0.from': Invalid Ethereum address",
                  params: {
                    did: issuer1.did,
                    from: "bad address",
                    proxyData: issuer1.proxies[0]!.utf8,
                  } as AddIssuerProxySchema,
                },
              );

              break;
            }
            case "removeIssuerProxy": {
              testSetup.push(
                {
                  accessToken: tao1TirWriteAccessToken,
                  expectedErrorMessage: "Invalid 'params.0.did': Required",
                  params: {
                    from: signer.address,
                    // Missing "did"
                    // did: issuer1.did,
                    proxyId: issuer1.proxies[0]!.id,
                  } as RemoveIssuerProxySchema,
                },
                {
                  accessToken: tao1TirWriteAccessToken,
                  expectedErrorMessage:
                    "Invalid 'params.0.did': The DID must start with \"did:ebsi:\"",
                  params: {
                    // Invalid "did"
                    did: "did:key:z2dmzD81cgPx8Vki7JbuuMmFYrWPgYoytykUZ3eyqht1j9KbqWsaTDqWzTdxV8Up5ZsKEyY2287nhqc9wPxspHkyEn5xHi9Lnnt9kEkPJd2tFpmpx8z8dgHfbLmLhFRm5jpfvxGUwoykD87ec7znw9NhN9fMTBXmm4zb3amdW5SqZ7QW5A",
                    from: signer.address,
                    proxyId: issuer1.proxies[0]!.id,
                  } as RemoveIssuerProxySchema,
                },
                {
                  accessToken: tao1TirWriteAccessToken,
                  expectedErrorMessage: "Invalid 'params.0.proxyId': Required",
                  params: {
                    did: issuer1.did,
                    from: signer.address,
                    // Missing "proxyId"
                    // proxyId: issuer1.proxies[0]!.id,
                  } as RemoveIssuerProxySchema,
                },
                {
                  accessToken: tao1TirWriteAccessToken,
                  expectedErrorMessage: [
                    "Invalid 'params.0.proxyId': Must be prefixed with 0x",
                    "Invalid 'params.0.proxyId': String must contain exactly 66 character(s)",
                    "Invalid 'params.0.proxyId': Must be hexadecimal",
                  ].join("\n"),
                  params: {
                    did: issuer1.did,
                    from: signer.address,
                    // Invalid "proxyId"
                    proxyId: "not 66 chars and not hex",
                  } as RemoveIssuerProxySchema,
                },
                {
                  accessToken: tao1TirWriteAccessToken,
                  expectedErrorMessage:
                    "Invalid 'params.0.from': Invalid Ethereum address",
                  params: {
                    did: issuer1.did,
                    from: "bad address",
                    proxyId: issuer1.proxies[0]!.id,
                  } as RemoveIssuerProxySchema,
                },
              );

              break;
            }
            case "setAttributeData": {
              testSetup.push(
                {
                  accessToken: tao1TirWriteAccessToken,
                  expectedErrorMessage: "Invalid 'params.0.did': Required",
                  params: {
                    attributeData: `0x${crypto.randomBytes(12).toString("hex")}`,
                    // Missing "did"
                    // did: issuer1.did,
                    attributeId: issuer1.attribute.id,
                    from: signer.address,
                  } as SetAttributeDataSchema,
                },
                {
                  accessToken: tao1TirWriteAccessToken,
                  expectedErrorMessage:
                    "Invalid 'params.0.did': The DID must start with \"did:ebsi:\"",
                  params: {
                    attributeData: `0x${crypto.randomBytes(12).toString("hex")}`,
                    attributeId: issuer1.attribute.id,
                    // Invalid "did"
                    did: "did:key:z2dmzD81cgPx8Vki7JbuuMmFYrWPgYoytykUZ3eyqht1j9KbqWsaTDqWzTdxV8Up5ZsKEyY2287nhqc9wPxspHkyEn5xHi9Lnnt9kEkPJd2tFpmpx8z8dgHfbLmLhFRm5jpfvxGUwoykD87ec7znw9NhN9fMTBXmm4zb3amdW5SqZ7QW5A",
                    from: signer.address,
                  } as SetAttributeDataSchema,
                },
                {
                  accessToken: tao1TirWriteAccessToken,
                  expectedErrorMessage:
                    "Invalid 'params.0.attributeId': Required",
                  params: {
                    // Missing "attributeId"
                    // attributeId: issuer1.attribute.id,
                    attributeData: `0x${crypto.randomBytes(12).toString("hex")}`,
                    did: issuer1.did,
                    from: signer.address,
                  } as SetAttributeDataSchema,
                },
                {
                  accessToken: tao1TirWriteAccessToken,
                  expectedErrorMessage:
                    "Invalid 'params.0.attributeId': Must be prefixed with 0x",
                  params: {
                    attributeData: `0x${crypto.randomBytes(12).toString("hex")}`,
                    // Invalid "attributeId"
                    attributeId:
                      "883a16a2b265a6ebf1e9e375c59a7171baa3122a425b745eda806401127c8b2f",
                    did: issuer1.did,
                    from: signer.address,
                  } as SetAttributeDataSchema,
                },
                {
                  accessToken: tao1TirWriteAccessToken,
                  expectedErrorMessage:
                    "Invalid 'params.0.attributeId': Must be hexadecimal",
                  params: {
                    attributeData: `0x${crypto.randomBytes(12).toString("hex")}`,
                    // Invalid "attributeId"
                    attributeId: "0xnot hexadecimal",
                    did: issuer1.did,
                    from: signer.address,
                  } as SetAttributeDataSchema,
                },
                {
                  accessToken: tao1TirWriteAccessToken,
                  expectedErrorMessage:
                    "Invalid 'params.0.attributeData': Must be prefixed with 0x",
                  params: {
                    // Invalid "attributeData", not prefixed with 0x
                    attributeData: crypto.randomBytes(12).toString("hex"),
                    attributeId: issuer1.attribute.id,
                    did: issuer1.did,
                    from: signer.address,
                  } as SetAttributeDataSchema,
                },
                {
                  accessToken: tao1TirWriteAccessToken,
                  expectedErrorMessage:
                    "Invalid 'params.0.attributeData': Must be hexadecimal",
                  params: {
                    // Invalid "attributeData"
                    attributeData: "not hexadecimal",
                    attributeId: issuer1.attribute.id,
                    did: issuer1.did,
                    from: signer.address,
                  } as SetAttributeDataSchema,
                },
                {
                  accessToken: tao1TirWriteAccessToken,
                  expectedErrorMessage:
                    "Invalid 'params.0.from': Invalid Ethereum address",
                  params: {
                    attributeData: `0x${crypto.randomBytes(12).toString("hex")}`,
                    attributeId: issuer1.attribute.id,
                    did: issuer1.did,
                    from: "bad address",
                  } as SetAttributeDataSchema,
                },
                {
                  accessToken: tao1TirWriteAccessToken,
                  expectedErrorMessage:
                    "Invalid 'params.0.attributeId': String must contain exactly 66 character(s)",
                  params: {
                    attributeData: `0x${crypto.randomBytes(12).toString("hex")}`,
                    attributeId: `0x${crypto.randomBytes(12).toString("hex")}`, // Too short
                    did: issuer1.did,
                    from: signer.address,
                  } as SetAttributeDataSchema,
                },
              );

              const randomAttributeId = `0x${crypto.randomBytes(32).toString("hex")}`;
              testSetup.push({
                accessToken: tao1TirWriteAccessToken,
                expectedErrorMessage: `Invalid 'params.0.attributeId': Attribute ${randomAttributeId} does not exist`,
                params: {
                  attributeData: `0x${crypto.randomBytes(12).toString("hex")}`,
                  attributeId: randomAttributeId,
                  did: issuer1.did,
                  from: signer.address,
                } as SetAttributeDataSchema,
              });

              break;
            }
            case "setAttributeMetadata": {
              testSetup.push(
                {
                  accessToken: tao1TirWriteAccessToken,
                  expectedErrorMessage: "Invalid 'params.0.did': Required",
                  params: {
                    attributeIdTao: issuer1.attributeIdTao,
                    from: signer.address,
                    issuerType: issuer1.issuerType,
                    // Missing "did"
                    // did: issuer1.did,
                    revisionId: issuer1.attribute.id,
                    taoDid: issuer1.tao,
                  } as SetAttributeMetadataSchema,
                },
                {
                  accessToken: tao1TirWriteAccessToken,
                  expectedErrorMessage:
                    "Invalid 'params.0.did': The DID must start with \"did:ebsi:\"",
                  params: {
                    attributeIdTao: issuer1.attributeIdTao,
                    // Invalid "did"
                    did: "did:key:z2dmzD81cgPx8Vki7JbuuMmFYrWPgYoytykUZ3eyqht1j9KbqWsaTDqWzTdxV8Up5ZsKEyY2287nhqc9wPxspHkyEn5xHi9Lnnt9kEkPJd2tFpmpx8z8dgHfbLmLhFRm5jpfvxGUwoykD87ec7znw9NhN9fMTBXmm4zb3amdW5SqZ7QW5A",
                    from: signer.address,
                    issuerType: issuer1.issuerType,
                    revisionId: issuer1.attribute.id,
                    taoDid: issuer1.tao,
                  } as SetAttributeMetadataSchema,
                },
                {
                  accessToken: tao1TirWriteAccessToken,
                  expectedErrorMessage:
                    "Invalid 'params.0.revisionId': Required",
                  params: {
                    attributeIdTao: issuer1.attributeIdTao,
                    did: issuer1.did,
                    from: signer.address,
                    // Missing "revisionId"
                    // revisionId: issuer1.attribute.id,
                    issuerType: issuer1.issuerType,
                    taoDid: issuer1.tao,
                  } as SetAttributeMetadataSchema,
                },
                {
                  accessToken: tao1TirWriteAccessToken,
                  expectedErrorMessage:
                    "Invalid 'params.0.revisionId': Must be hexadecimal",
                  params: {
                    attributeIdTao: issuer1.attributeIdTao,
                    did: issuer1.did,
                    from: signer.address,
                    issuerType: issuer1.issuerType,
                    // Invalid "revisionId"
                    revisionId: "not hexadecimal",
                    taoDid: issuer1.tao,
                  } as SetAttributeMetadataSchema,
                },
                {
                  accessToken: tao1TirWriteAccessToken,
                  expectedErrorMessage:
                    "Invalid 'params.0.revisionId': Must be prefixed with 0x",
                  params: {
                    attributeIdTao: issuer1.attributeIdTao,
                    did: issuer1.did,
                    from: signer.address,
                    issuerType: issuer1.issuerType,
                    // Invalid "revisionId"
                    revisionId:
                      "883a16a2b265a6ebf1e9e375c59a7171baa3122a425b745eda806401127c8b2f",
                    taoDid: issuer1.tao,
                  } as SetAttributeMetadataSchema,
                },
                {
                  accessToken: tao1TirWriteAccessToken,
                  expectedErrorMessage:
                    "Invalid 'params.0.issuerType': issuerType must be equal to 0 (Undefined), 1 (RootTAO), 2 (TAO), 3 (TI) or 4 (Revoked)",
                  params: {
                    attributeIdTao: issuer1.attributeIdTao,
                    did: issuer1.did,
                    from: signer.address,
                    // Invalid "issuerType"
                    issuerType: 42,
                    revisionId: issuer1.attribute.id,
                    taoDid: issuer1.tao,
                  } as SetAttributeMetadataSchema,
                },
                {
                  accessToken: tao1TirWriteAccessToken,
                  expectedErrorMessage:
                    "Invalid 'params.0.taoDid': The DID must start with \"did:ebsi:\"",
                  params: {
                    attributeIdTao: issuer1.attributeIdTao,
                    did: issuer1.did,
                    from: signer.address,
                    issuerType: issuer1.issuerType,
                    revisionId: issuer1.attribute.id,
                    // Invalid "taoDid"
                    taoDid:
                      "did:key:z2dmzD81cgPx8Vki7JbuuMmFYrWPgYoytykUZ3eyqht1j9KbqWsaTDqWzTdxV8Up5ZsKEyY2287nhqc9wPxspHkyEn5xHi9Lnnt9kEkPJd2tFpmpx8z8dgHfbLmLhFRm5jpfvxGUwoykD87ec7znw9NhN9fMTBXmm4zb3amdW5SqZ7QW5A",
                  } as SetAttributeMetadataSchema,
                },
                {
                  accessToken: tao1TirWriteAccessToken,
                  expectedErrorMessage: [
                    "Invalid 'params.0.attributeIdTao': Must be prefixed with 0x",
                    "Invalid 'params.0.attributeIdTao': String must contain exactly 66 character(s)",
                    "Invalid 'params.0.attributeIdTao': Must be hexadecimal",
                  ].join("\n"),
                  params: {
                    // Invalid "attributeIdTao"
                    attributeIdTao: "not hexadecimal",
                    did: issuer1.did,
                    from: signer.address,
                    issuerType: issuer1.issuerType,
                    revisionId: issuer1.attribute.id,
                    taoDid: issuer1.tao,
                  } as SetAttributeMetadataSchema,
                },
                {
                  accessToken: tao1TirWriteAccessToken,
                  expectedErrorMessage:
                    "Invalid 'params.0.attributeIdTao': Must be hexadecimal",
                  params: {
                    // Invalid "attributeIdTao"
                    attributeIdTao: "0xnot hexadecimal",
                    did: issuer1.did,
                    from: signer.address,
                    issuerType: issuer1.issuerType,
                    revisionId: issuer1.attribute.id,
                    taoDid: issuer1.tao,
                  } as SetAttributeMetadataSchema,
                },
                {
                  accessToken: tao1TirWriteAccessToken,
                  expectedErrorMessage: [
                    "Invalid 'params.0.attributeIdTao': Must be prefixed with 0x",
                    "Invalid 'params.0.attributeIdTao': String must contain exactly 66 character(s)",
                  ].join("\n"),
                  params: {
                    attributeIdTao:
                      "883a16a2b265a6ebf1e9e375c59a7171baa3122a425b745eda806401127c8b2f",
                    did: issuer1.did,
                    from: signer.address,
                    issuerType: issuer1.issuerType,
                    revisionId: issuer1.attribute.id,
                    taoDid: issuer1.tao,
                  } as SetAttributeMetadataSchema,
                },
                {
                  accessToken: tao1TirWriteAccessToken,
                  expectedErrorMessage:
                    "Invalid 'params.0.from': Invalid Ethereum address",
                  params: {
                    attributeIdTao: issuer1.attributeIdTao,
                    did: issuer1.did,
                    from: "bad address",
                    issuerType: issuer1.issuerType,
                    revisionId: issuer1.attribute.id,
                    taoDid: issuer1.tao,
                  } as SetAttributeMetadataSchema,
                },
              );

              break;
            }
            case "updateIssuerProxy": {
              testSetup.push(
                {
                  accessToken: tao1TirWriteAccessToken,
                  expectedErrorMessage: "Invalid 'params.0.did': Required",
                  params: {
                    from: signer.address,
                    proxyData: issuer1.proxies[0]!.utf8,
                    // Missing "did"
                    // did: issuer1.did,
                    proxyId: issuer1.proxies[0]!.id,
                  } as UpdateIssuerProxySchema,
                },
                {
                  accessToken: tao1TirWriteAccessToken,
                  expectedErrorMessage:
                    "Invalid 'params.0.did': The DID must start with \"did:ebsi:\"",
                  params: {
                    // Invalid "did"
                    did: "did:key:z2dmzD81cgPx8Vki7JbuuMmFYrWPgYoytykUZ3eyqht1j9KbqWsaTDqWzTdxV8Up5ZsKEyY2287nhqc9wPxspHkyEn5xHi9Lnnt9kEkPJd2tFpmpx8z8dgHfbLmLhFRm5jpfvxGUwoykD87ec7znw9NhN9fMTBXmm4zb3amdW5SqZ7QW5A",
                    from: signer.address,
                    proxyData: issuer1.proxies[0]!.utf8,
                    proxyId: issuer1.proxies[0]!.id,
                  } as UpdateIssuerProxySchema,
                },
                {
                  accessToken: tao1TirWriteAccessToken,
                  expectedErrorMessage: "Invalid 'params.0.proxyId': Required",
                  params: {
                    did: issuer1.did,
                    from: signer.address,
                    // Missing "proxyId"
                    // proxyId: issuer1.proxies[0]!.id,
                    proxyData: issuer1.proxies[0]!.utf8,
                  } as UpdateIssuerProxySchema,
                },
                {
                  accessToken: tao1TirWriteAccessToken,
                  expectedErrorMessage: [
                    "Invalid 'params.0.proxyId': Must be prefixed with 0x",
                    "Invalid 'params.0.proxyId': String must contain exactly 66 character(s)",
                    "Invalid 'params.0.proxyId': Must be hexadecimal",
                  ].join("\n"),
                  params: {
                    did: issuer1.did,
                    from: signer.address,
                    proxyData: issuer1.proxies[0]!.utf8,
                    // Invalid "proxyId"
                    proxyId: "not 66 chars and not hex",
                  } as UpdateIssuerProxySchema,
                },
                {
                  accessToken: tao1TirWriteAccessToken,
                  expectedErrorMessage:
                    "Invalid 'params.0.proxyData': Required",
                  params: {
                    did: issuer1.did,
                    from: signer.address,
                    proxyId: issuer1.proxies[0]!.id,
                    // Missing "proxyData"
                    // proxyData: issuer1.proxies[0]!.utf8,
                  } as UpdateIssuerProxySchema,
                },
                {
                  accessToken: tao1TirWriteAccessToken,
                  expectedErrorMessage:
                    "Invalid 'params.0.proxyData': Missing prefix",
                  params: {
                    did: issuer1.did,
                    from: signer.address,
                    // Invalid "proxyData"
                    proxyData: JSON.stringify({
                      // "prefix" attribute is missing
                    }),
                    proxyId: issuer1.proxies[0]!.id,
                  } as UpdateIssuerProxySchema,
                },
                {
                  accessToken: tao1TirWriteAccessToken,
                  expectedErrorMessage:
                    "Invalid 'params.0.proxyData': Missing headers",
                  params: {
                    did: issuer1.did,
                    from: signer.address,
                    // Invalid "proxyData"
                    proxyData: JSON.stringify({
                      prefix: "https://example.net",
                      // Missing "headers" attribute
                    }),
                    proxyId: issuer1.proxies[0]!.id,
                  } as UpdateIssuerProxySchema,
                },
                {
                  accessToken: tao1TirWriteAccessToken,
                  expectedErrorMessage:
                    "Invalid 'params.0.proxyData': Missing testSuffix",
                  params: {
                    did: issuer1.did,
                    from: signer.address,
                    // Invalid "proxyData"
                    proxyData: JSON.stringify({
                      headers: {
                        Authorization: `Bearer ${crypto
                          .randomBytes(16)
                          .toString("hex")}`,
                      },
                      prefix: "https://example.net",
                      // Missing "testSuffix" attribute
                    }),
                    proxyId: issuer1.proxies[0]!.id,
                  } as UpdateIssuerProxySchema,
                },
                {
                  accessToken: tao1TirWriteAccessToken,
                  expectedErrorMessage:
                    "Invalid 'params.0.proxyData': Error while loading https://not-found.net/cred/1",
                  params: {
                    did: issuer1.did,
                    from: signer.address,
                    // Invalid "proxyData"
                    proxyData: JSON.stringify({
                      headers: {
                        Authorization: `Bearer ${crypto
                          .randomBytes(16)
                          .toString("hex")}`,
                      },
                      prefix: "https://not-found.net",
                      testSuffix: "/cred/1",
                    }),
                    proxyId: issuer1.proxies[0]!.id,
                  } as UpdateIssuerProxySchema,
                },
                {
                  accessToken: tao1TirWriteAccessToken,
                  expectedErrorMessage:
                    "Invalid 'params.0.from': Invalid Ethereum address",
                  params: {
                    did: issuer1.did,
                    from: "bad address",
                    proxyData: issuer1.proxies[0]!.utf8,
                    proxyId: issuer1.proxies[0]!.id,
                  } as UpdateIssuerProxySchema,
                },
              );

              break;
            }
            default: {
              throw new Error("Test Error: Invalid method");
            }
          }

          expect.assertions(testSetup.length * 2);

          // Run requests sequentially

          for (const setup of testSetup) {
            const id = crypto.randomInt(0, 256);

            const response = await request(server)
              .post("/jsonrpc")
              .auth(setup.accessToken, { type: "bearer" })
              .send({
                id,
                jsonrpc: "2.0",
                method,
                params: [setup.params],
              });

            expect(response.body).toStrictEqual({
              error: {
                code: -32_600,
                message: expect.stringContaining(setup.expectedErrorMessage),
              },
              id,
              jsonrpc: "2.0",
            });
            expect(response.status).toBe(400);
          }
        });

        it("should throw an error when the unsignedTransaction has been tampered", async () => {
          expect.assertions(6);

          const wallet1 = ethers.Wallet.createRandom();
          const wallet2 = ethers.Wallet.createRandom();

          const param1 = createParam(method, wallet1);
          const param2 = createParam(method, wallet1, true);

          const responseBuild1: SupertestJsonRpcResponse = await request(server)
            .post("/jsonrpc")
            .auth(tao1TirWriteAccessToken, { type: "bearer" })
            .send({
              id: 231,
              jsonrpc: "2.0",
              method,
              params: [param1],
            });

          expect(responseBuild1.status).toBe(200);

          const transaction1 = responseBuild1.body
            .result as UnsignedTransaction;

          const responseBuild2: SupertestJsonRpcResponse = await request(server)
            .post("/jsonrpc")
            .auth(tao1TirWriteAccessToken, { type: "bearer" })
            .send({
              id: 232,
              jsonrpc: "2.0",
              method,
              params: [param2],
            });

          expect(responseBuild2.status).toBe(200);

          const transaction2 = responseBuild2.body
            .result as UnsignedTransaction;

          const uTx = formatEthersUnsignedTransaction(transaction1);

          const sgnTx1 = await wallet1.signTransaction(uTx);
          const signature = ethers.Transaction.from(sgnTx1).signature;
          if (!signature) {
            throw new Error("Signature not found");
          }
          const { r, s, v } = signature;

          // tampering signatures
          const responseSend1 = await request(server)
            .post("/jsonrpc")
            .auth(tao1TirWriteAccessToken, { type: "bearer" })
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

          // tampering "from"
          transaction1.from = wallet2.address;
          const responseSend2 = await request(server)
            .post("/jsonrpc")
            .auth(tao1TirWriteAccessToken, { type: "bearer" })
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
              message: `The signer of the transaction (${wallet1.address}) does not match with unsignedTransaction.from (${wallet2.address}) `,
            },
            id: "46",
            jsonrpc: "2.0",
          });
          expect(responseSend1.status).toBe(400);
        });
      },
    );
  },
);
