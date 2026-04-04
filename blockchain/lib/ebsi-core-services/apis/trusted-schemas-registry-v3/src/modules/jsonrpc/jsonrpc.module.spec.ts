import type { SchemaSCRegistry } from "@ebsiint-sc/trusted-schemas-registry-v3";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { RawServerDefault } from "fastify";
import type { GenerateKeyPairResult } from "jose";
import type { MockInstance } from "vitest";

import { computeId, computeId__deprecated } from "@ebsiint-api/shared";
import { SchemaSCRegistry__factory } from "@ebsiint-sc/trusted-schemas-registry-v3";
import { ConfigService } from "@nestjs/config";
import axios from "axios";
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
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type { ApiConfig } from "../../config/configuration.ts";
import type { JsonRpcResponseObject } from "./jsonrpc.interface.ts";
import type { InsertSchemaSchema } from "./validators/RequestInsertSchemaSchema.ts";
import type { UnsignedTransaction } from "./validators/RequestSendSignedTransactionSchema.ts";
import type { UpdateMetadataSchema } from "./validators/RequestUpdateMetadataSchema.ts";
import type { UpdateSchemaSchema } from "./validators/RequestUpdateSchemaSchema.ts";

import { getNestFastifyApplication } from "../../../tests/utils/app.ts";
import {
  createDid,
  createSchema,
  createVerifiableAuthorisationSchema,
} from "../../../tests/utils/data.ts";
import { setupTestEnv } from "../../../tests/utils/schemaRegistry.ts";
import { LedgerService } from "../ledger/ledger.service.ts";
import { JsonRpcModule } from "./jsonrpc.module.ts";
import { JsonRpcService } from "./jsonrpc.service.ts";
import { formatEthersUnsignedTransaction } from "./jsonrpc.utils.ts";

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
] as const)("JSON-RPC Module (%s schema IDs)", (schemaIdType) => {
  let app: NestFastifyApplication;
  let server: RawServerDefault;
  let schemasRegistryContract: SchemaSCRegistry;
  let jsonRpcService: JsonRpcService;
  let testEnv: Awaited<ReturnType<typeof setupTestEnv>>;
  let userAccessToken: string;
  let userAccessTokenPayload: Record<string, unknown>;
  let defaultSignerSiopAccessToken: string;
  let defaultSignerSiopAccessTokenPayload: Record<string, unknown>;
  let configService: ConfigService<ApiConfig, true>;
  let isDidControlledByAddressMock: MockInstance;

  const adminDid = createDid();

  let schemaId: string;
  const rawSchema = createSchema();
  const serializedSchema = JSON.stringify(rawSchema);
  const serializedSchemaBuffer = Buffer.from(serializedSchema);

  const rawUpdatedSchema = {
    ...rawSchema,
    description: "Updated schema of an EBSI Verifiable Attestation",
  };
  const serializedUpdatedSchema = JSON.stringify(rawUpdatedSchema);
  const serializedUpdatedSchemaBuffer = Buffer.from(serializedUpdatedSchema);

  let schema2Id: string;
  const referencedSchemaUrl =
    "https://test.ebsi/trusted-schemas-registry/v3/schemas/z3kRpVjUFj4Bq8qHRENUHiZrVF5VgMBUe7biEafp1wf2J";
  const rawSchema2 = createVerifiableAuthorisationSchema(referencedSchemaUrl);
  const serializedSchema2 = JSON.stringify(rawSchema2);
  const serializedSchema2Buffer = Buffer.from(serializedSchema2);

  const rawMetadata = {
    meta: "value",
  };
  const serializedMetadata = JSON.stringify(rawMetadata);
  const serializedMetadataBuffer = Buffer.from(serializedMetadata);

  const rawMetadata2 = {
    meta: "value2",
  };
  const serializedMetadata2 = JSON.stringify(rawMetadata2);
  const serializedMetadataBuffer2 = Buffer.from(serializedMetadata2);

  const rawUpdatedMetadata = {
    meta: "value3",
  };
  const serializedUpdatedMetadata = JSON.stringify(rawUpdatedMetadata);
  const serializedUpdatedMetadataBuffer = Buffer.from(
    serializedUpdatedMetadata,
  );

  const mockServer = setupServer();

  let authApiKeyPair: GenerateKeyPairResult;
  let authApiKid: string;

  beforeAll(async () => {
    // Intercept network requests
    mockServer.listen({
      onUnhandledRequest: ({ url }, print) => {
        // Bypass local requests
        if (new URL(url).hostname === "127.0.0.1") return;

        print.error();
      },
    });

    // Compute IDs. We need to mock the request GET $referencedSchemaUrl because rawSchema2 depends on it
    mockServer.use(
      http.get(referencedSchemaUrl, () => HttpResponse.json(rawSchema)),
    );

    const schemaIdBuffer =
      schemaIdType === "fixed"
        ? await computeId(rawSchema)
        : await computeId__deprecated(
            rawSchema,
            schemaIdType ===
              "deprecated (invalid $ref, document stringified twice)",
          );
    schemaId = `0x${schemaIdBuffer.toString("hex")}`;
    const schema2IdBuffer =
      schemaIdType === "fixed"
        ? await computeId(rawSchema2)
        : await computeId__deprecated(
            rawSchema2,
            schemaIdType ===
              "deprecated (invalid $ref, document stringified twice)",
          );
    schema2Id = `0x${schema2IdBuffer.toString("hex")}`;

    mockServer.resetHandlers();

    // Spin up test blockchain
    testEnv = await setupTestEnv(schemaIdType);
    schemasRegistryContract = testEnv.schemasRegistryContract;

    const schemasRegistryContractAddress =
      await schemasRegistryContract.getAddress();

    vi.stubEnv("CONTRACT_ADDR", schemasRegistryContractAddress);

    // Start server
    app = await getNestFastifyApplication({ imports: [JsonRpcModule] });

    configService = app.get<ConfigService<ApiConfig, true>>(ConfigService);

    await app.init();
    const fastifyInstance = app.getHttpAdapter().getInstance();
    await fastifyInstance.ready();

    server = app.getHttpServer();

    jsonRpcService = app.get<JsonRpcService>(JsonRpcService);

    // Generate key pair for Authorisation API v3 and create access token
    authApiKeyPair = await generateKeyPair("ES256");
    const publicKeyJwk = await exportJWK(authApiKeyPair.publicKey);
    authApiKid = await calculateJwkThumbprint(publicKeyJwk);

    userAccessTokenPayload = {
      scp: "openid tsr_write",
      sub: adminDid,
    };
    userAccessToken = await new SignJWT(userAccessTokenPayload)
      .setProtectedHeader({
        alg: "ES256",
        kid: authApiKid,
        typ: "JWT",
      })
      .sign(authApiKeyPair.privateKey);

    defaultSignerSiopAccessTokenPayload = {
      scp: "openid tsr_write",
      sub: testEnv.user.did,
    };

    defaultSignerSiopAccessToken = await new SignJWT(
      defaultSignerSiopAccessTokenPayload,
    )
      .setProtectedHeader({
        alg: "ES256",
        kid: authApiKid,
        typ: "JWT",
      })
      .sign(authApiKeyPair.privateKey);

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
          keys: [{ ...publicKeyJwk, kid: authApiKid }],
        });
      }),
    );
  });

  beforeEach(() => {
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

    // For the tests, we assume that the DID is controlled by the signer
    isDidControlledByAddressMock = vi.spyOn(
      jsonRpcService,
      "isDidControlledByAddress",
    );
    isDidControlledByAddressMock.mockImplementation(() => true);

    // Mock $ref response
    mockServer.use(
      http.get(referencedSchemaUrl, () => HttpResponse.json(rawSchema)),
    );
  });

  afterEach(() => {
    mockServer.resetHandlers();
  });

  afterAll(async () => {
    mockServer.close();

    await app.close();
  });

  it("should throw an error if the DID does not exist", async () => {
    expect.assertions(4);

    const signer = ethers.Wallet.createRandom();

    const param: JsonRpcParams = {
      from: signer.address,
      metadata: `0x${serializedMetadataBuffer.toString("hex")}`,
      schema: `0x${serializedSchemaBuffer.toString("hex")}`,
      schemaId,
    } satisfies InsertSchemaSchema;

    // The DID does not exist
    vi.spyOn(axios, "post").mockImplementation((url: string) => {
      if (url.includes(`/identifiers/${testEnv.user.did}/actions`)) {
        return Promise.resolve({
          data: {
            error: { code: -32_600, message: "did doesn't exist" },
            // eslint-disable-next-line unicorn/no-null
            id: null,
            jsonrpc: "2.0",
          },
          status: 400,
        });
      }
      throw new Error(`Forgot to mock an axios call? POST ${url}`);
    });
    isDidControlledByAddressMock.mockRestore();

    const responseBuild: SupertestJsonRpcResponse = await request(server)
      .post("/jsonrpc")
      .auth(defaultSignerSiopAccessToken, { type: "bearer" })
      .send({
        id: 231,
        jsonrpc: "2.0",
        method: "insertSchema",
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
      .auth(defaultSignerSiopAccessToken, { type: "bearer" })
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
        message: `The DID ${testEnv.user.did} does not exist`,
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
    const kid = await calculateJwkThumbprint(await exportJWK(signer.publicKey));
    const accessTokenWithInvalidKid = await new SignJWT(userAccessTokenPayload)
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

    const accessTokenWithInvalidSignature = await new SignJWT(
      userAccessTokenPayload,
    )
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
    expect.assertions(2);

    const response = await request(server)
      .post("/jsonrpc")
      .auth(userAccessToken, { type: "bearer" })
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
  });

  it("should throw an error when sendSignedTransaction is used with a wrong chainId", async () => {
    expect.assertions(2);
    const wallet = ethers.Wallet.createRandom();

    const transaction = {
      chainId: "0x1b3b",
      data: schemasRegistryContract.interface.encodeFunctionData(
        "insertSchema",
        [schemaId, serializedSchemaBuffer, serializedMetadataBuffer],
      ),
      from: wallet.address,
      gasLimit: "0x1000000",
      gasPrice: "0x00",
      nonce: "0x00",
      to: await schemasRegistryContract.getAddress(),
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
      .auth(userAccessToken, { type: "bearer" })
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
      .auth(userAccessToken, { type: "bearer" })
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

    const param: JsonRpcParams = {
      from: signer.address,
      metadata: `0x${serializedMetadataBuffer.toString("hex")}`,
      schema: `0x${serializedSchemaBuffer.toString("hex")}`,
      schemaId,
    } satisfies InsertSchemaSchema;

    const responseBuild: SupertestJsonRpcResponse = await request(server)
      .post("/jsonrpc")
      .auth(defaultSignerSiopAccessToken, { type: "bearer" })
      .send({
        id: 231,
        jsonrpc: "2.0",
        method: "insertSchema",
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
      .auth(defaultSignerSiopAccessToken, { type: "bearer" })
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

    const param: JsonRpcParams = {
      from: signer.address,
      metadata: `0x${serializedMetadataBuffer.toString("hex")}`,
      schema: `0x${serializedSchemaBuffer.toString("hex")}`,
      schemaId,
    } satisfies InsertSchemaSchema;

    // The DID is not controlled by the signer
    vi.spyOn(jsonRpcService, "isDidControlledByAddress").mockImplementation(
      () => Promise.resolve(false),
    );

    const responseBuild: SupertestJsonRpcResponse = await request(server)
      .post("/jsonrpc")
      .auth(defaultSignerSiopAccessToken, { type: "bearer" })
      .send({
        id: 231,
        jsonrpc: "2.0",
        method: "insertSchema",
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
      .auth(defaultSignerSiopAccessToken, { type: "bearer" })
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
        message: `The DID ${testEnv.user.did} is not controlled by the address ${signer.address}`,
      },
      id: "45",
      jsonrpc: "2.0",
    });
    expect(responseSend.status).toBe(400);
  });

  it("should throw an error if the schema references an URL that can't be fetched", async () => {
    expect.assertions(2);

    // Mock $ref response - 404
    mockServer.resetHandlers();
    mockServer.use(
      http.get(referencedSchemaUrl, ({ request }) => {
        // Make sure the request has the x-request-id header
        if (!request.headers.has("x-request-id")) {
          return HttpResponse.json(
            "Invalid request (missing x-request-id header)",
            { status: 400 },
          );
        }

        return HttpResponse.text("Not Found", { status: 404 });
      }),
    );

    const signer = ethers.Wallet.createRandom();

    const param: JsonRpcParams = {
      from: signer.address,
      metadata: `0x${serializedMetadataBuffer.toString("hex")}`,
      schema: `0x${serializedSchema2Buffer.toString("hex")}`,
      schemaId: schema2Id,
    } satisfies InsertSchemaSchema;

    const response: SupertestJsonRpcResponse = await request(server)
      .post("/jsonrpc")
      .auth(defaultSignerSiopAccessToken, { type: "bearer" })
      .send({
        id: 231,
        jsonrpc: "2.0",
        method: "insertSchema",
        params: [param],
      });

    expect(response.body).toStrictEqual({
      error: {
        code: -32_600,
        message: expect.stringContaining(
          `Error downloading ${referencedSchemaUrl}`,
        ),
      },
      id: 231,
      jsonrpc: "2.0",
    });
    expect(response.status).toBe(400);
  });

  // Tests to be repeated for every method
  describe.each(["insertSchema", "updateSchema", "updateMetadata"])(
    "/jsonrpc with method %s",
    (testMethod: string) => {
      const method = testMethod.replace("(test update attribute)", "");

      it("should return a valid unsigned transaction that we can sign and send to sendSignedTransaction", async () => {
        expect.assertions(4);

        let param: JsonRpcParams;

        const signer = ethers.Wallet.createRandom();

        switch (method) {
          case "insertSchema": {
            param = {
              from: signer.address,
              metadata: `0x${serializedMetadataBuffer.toString("hex")}`,
              schema: `0x${serializedSchemaBuffer.toString("hex")}`,
              schemaId,
            } satisfies InsertSchemaSchema;
            break;
          }
          case "updateMetadata": {
            param = {
              from: signer.address,
              metadata: `0x${serializedMetadataBuffer2.toString("hex")}`,
              schemaId,
              schemaRevisionId: ethers.sha256(serializedSchemaBuffer),
            } satisfies UpdateMetadataSchema;
            break;
          }
          case "updateSchema": {
            param = {
              from: signer.address,
              metadata: `0x${serializedUpdatedMetadataBuffer.toString("hex")}`,
              schema: `0x${serializedUpdatedSchemaBuffer.toString("hex")}`,
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
          .auth(defaultSignerSiopAccessToken, { type: "bearer" })
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
          .auth(defaultSignerSiopAccessToken, { type: "bearer" })
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

        let param: JsonRpcParams;

        switch (method) {
          case "insertSchema": {
            param = {
              from: signer.address,
              metadata: `0x${serializedMetadataBuffer.toString("hex")}`,
              schema: `0x${serializedSchemaBuffer.toString("hex")}`,
              schemaId,
            } satisfies InsertSchemaSchema;
            break;
          }
          case "updateMetadata": {
            param = {
              from: signer.address,
              metadata: `0x${serializedMetadataBuffer2.toString("hex")}`,
              schemaId,
              schemaRevisionId: ethers.sha256(serializedSchemaBuffer),
            } satisfies UpdateMetadataSchema;
            break;
          }
          case "updateSchema": {
            param = {
              from: signer.address,
              metadata: `0x${serializedMetadataBuffer.toString("hex")}`,
              schema: `0x${serializedUpdatedSchemaBuffer.toString("hex")}`,
              schemaId,
            } satisfies UpdateSchemaSchema;
            break;
          }
          default: {
            throw new Error(`Test Error: Invalid method ${method}`);
          }
        }

        const responseBuild = await request(server)
          .post("/jsonrpc")
          .auth(defaultSignerSiopAccessToken, { type: "bearer" })
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

        const signer = ethers.Wallet.createRandom();

        const testSetup: {
          expectedErrorMessages: string[];
          params: JsonRpcParams;
        }[] = [];

        switch (method) {
          case "insertSchema": {
            testSetup.push(
              // `schema` param is not valid JSON encoded in hex
              {
                expectedErrorMessages: [
                  "Invalid 'params.0.schema': Must be a JSON object encoded in hexadecimal",
                ],
                params: {
                  from: signer.address,
                  metadata: `0x${serializedMetadataBuffer.toString("hex")}`,
                  schema: "0x1234",
                  schemaId,
                } satisfies InsertSchemaSchema,
              },
              // `metadata` param is not valid JSON encoded in hex
              {
                expectedErrorMessages: [
                  "Invalid 'params.0.metadata': Must be a JSON object encoded in hexadecimal",
                ],
                params: {
                  from: signer.address,
                  metadata: "0x1234",
                  schema: `0x${serializedSchemaBuffer.toString("hex")}`,
                  schemaId,
                } satisfies InsertSchemaSchema,
              },
              // `metadata` param doesn't start with 0x
              {
                expectedErrorMessages: [
                  "Invalid 'params.0.metadata': Must start with 0x",
                ],
                params: {
                  from: signer.address,
                  metadata: serializedMetadataBuffer.toString("hex"),
                  schema: `0x${serializedSchemaBuffer.toString("hex")}`,
                  schemaId,
                } satisfies InsertSchemaSchema,
              },
              {
                expectedErrorMessages: [
                  "Invalid 'params.0.schemaId': Must start with 0x",
                  "Invalid 'params.0.schema': Length must be even",
                  "Invalid 'params.0.metadata': Must be a JSON object encoded in hexadecimal",
                ],
                params: {
                  from: signer.address,
                  metadata: "0x1234",
                  schema: "0x123",
                  schemaId: "42",
                } satisfies InsertSchemaSchema,
              },
            );

            // `schemaId` param doesn't match the computed schema ID
            const randomSchemaId = `0x${randomBytes(32).toString("hex")}`;
            const actualSchemaIdBuffer = await computeId(rawSchema);
            const actualSchemaId = `0x${actualSchemaIdBuffer.toString("hex")}`;
            testSetup.push({
              expectedErrorMessages: [
                `Invalid 'params.0.schemaId': "${randomSchemaId}" is different from the actual schema ID "${actualSchemaId}"`,
              ],
              params: {
                from: signer.address,
                metadata: `0x${serializedMetadataBuffer.toString("hex")}`,
                schema: `0x${serializedSchemaBuffer.toString("hex")}`,
                schemaId: randomSchemaId,
              } satisfies InsertSchemaSchema,
            });

            break;
          }
          case "updateMetadata": {
            testSetup.push(
              {
                expectedErrorMessages: [
                  "Invalid 'params.0.schemaId': Must start with 0x",
                  "Invalid 'params.0.schemaRevisionId': Must start with 0x",
                ],
                params: {
                  from: signer.address,
                  metadata: `0x${serializedMetadataBuffer2.toString("hex")}`,
                  schemaId: "42",
                  schemaRevisionId: "1234",
                } satisfies UpdateMetadataSchema,
              },
              {
                expectedErrorMessages: [
                  "Invalid 'params.0.schemaRevisionId': Must be hexadecimal",
                  "Invalid 'params.0.metadata': Must be a JSON object encoded in hexadecimal",
                ],
                params: {
                  from: signer.address,
                  metadata: "0x1234",
                  schemaId,
                  schemaRevisionId: "0x",
                } satisfies UpdateMetadataSchema,
              },
              {
                expectedErrorMessages: [
                  "Invalid 'params.0.schemaRevisionId': Must be hexadecimal",
                  "Invalid 'params.0.metadata': Must start with 0x",
                ],
                params: {
                  from: signer.address,
                  metadata: serializedMetadataBuffer.toString("hex"),
                  schemaId,
                  schemaRevisionId: "0x",
                } satisfies UpdateMetadataSchema,
              },
            );

            break;
          }
          case "updateSchema": {
            const actualSchemaIdBuffer = await computeId(rawSchema2);
            const actualSchemaId = `0x${actualSchemaIdBuffer.toString("hex")}`;

            testSetup.push(
              // `schema` param is not valid JSON encoded in hex
              {
                expectedErrorMessages: [
                  "Invalid 'params.0.schema': Must be a JSON object encoded in hexadecimal",
                ],
                params: {
                  from: signer.address,
                  metadata: `0x${serializedMetadataBuffer.toString("hex")}`,
                  schema: "0x1234",
                  schemaId,
                } satisfies UpdateSchemaSchema,
              },
              // `metadata` param is not valid JSON encoded in hex
              {
                expectedErrorMessages: [
                  "Invalid 'params.0.metadata': Must be a JSON object encoded in hexadecimal",
                ],
                params: {
                  from: signer.address,
                  metadata: "0x1234",
                  schema: `0x${serializedUpdatedSchemaBuffer.toString("hex")}`,
                  schemaId,
                } satisfies UpdateSchemaSchema,
              },
              // `schemaId` is not an hex string
              {
                expectedErrorMessages: [
                  "Invalid 'params.0.schemaId': Must start with 0x",
                ],
                params: {
                  from: signer.address,
                  metadata: `0x${serializedMetadataBuffer.toString("hex")}`,
                  schema: `0x${serializedUpdatedSchemaBuffer.toString("hex")}`,
                  schemaId: "11.11.2011",
                } satisfies UpdateSchemaSchema,
              },
              {
                expectedErrorMessages: [
                  "Invalid 'params.0.schemaId': Must start with 0x",
                  "Invalid 'params.0.schema': Length must be even",
                  "Invalid 'params.0.metadata': Must be a JSON object encoded in hexadecimal",
                ],
                params: {
                  from: signer.address,
                  metadata: "0x1234",
                  schema: "0x123",
                  schemaId: "42",
                } satisfies UpdateSchemaSchema,
              },
              // the user tries to insert breaking changes (update schema1 with schema2)
              {
                expectedErrorMessages: [
                  `Invalid 'params.0.schemaId': "${schemaId}" is different from the actual schema ID "${actualSchemaId}"`,
                ],
                params: {
                  from: signer.address,
                  metadata: `0x${serializedMetadataBuffer2.toString("hex")}`,
                  schema: `0x${serializedSchema2Buffer.toString("hex")}`,
                  schemaId,
                } satisfies UpdateSchemaSchema,
              },
            );

            break;
          }
          default: {
            throw new Error(`Test Error: Invalid method ${method}`);
          }
        }

        expect.assertions(testSetup.length * 3);

        for (const setup of testSetup) {
          const response = await request(server)
            .post("/jsonrpc")
            .auth(defaultSignerSiopAccessToken, {
              type: "bearer",
            })
            .send({
              id: 231,
              jsonrpc: "2.0",
              method,
              params: [setup.params],
            });

          expect(response.body).toStrictEqual({
            error: {
              code: -32_600,
              message: expect.any(String),
            },
            id: 231,
            jsonrpc: "2.0",
          });
          expect(
            (
              response.body as { error: { message: string } }
            ).error.message.split("\n"),
          ).toStrictEqual(expect.arrayContaining(setup.expectedErrorMessages));
          expect(response.status).toBe(400);
        }
      });

      it("should throw an error when the unsignedTransaction has been tampered", async () => {
        expect.assertions(6);

        const signer = ethers.Wallet.createRandom();

        let param1: JsonRpcParams;
        let param2: JsonRpcParams;

        const metadata2 = {
          meta: "another value",
        };

        switch (method) {
          case "insertSchema": {
            param1 = {
              from: signer.address,
              metadata: `0x${serializedMetadataBuffer.toString("hex")}`,
              schema: `0x${serializedSchemaBuffer.toString("hex")}`,
              schemaId,
            } satisfies InsertSchemaSchema;

            param2 = {
              from: signer.address,
              metadata: `0x${Buffer.from(JSON.stringify(metadata2)).toString(
                "hex",
              )}`,
              schema: `0x${serializedSchemaBuffer.toString("hex")}`,
              schemaId,
            } satisfies InsertSchemaSchema;

            break;
          }
          case "updateMetadata": {
            param1 = {
              from: signer.address,
              metadata: `0x${serializedMetadataBuffer2.toString("hex")}`,
              schemaId,
              schemaRevisionId: ethers.sha256(serializedSchemaBuffer),
            } satisfies UpdateMetadataSchema;

            param2 = {
              from: signer.address,
              metadata: `0x${serializedMetadataBuffer.toString("hex")}`,
              schemaId,
              schemaRevisionId: ethers.sha256(serializedSchemaBuffer),
            } satisfies UpdateMetadataSchema;
            break;
          }
          case "updateSchema": {
            param1 = {
              from: signer.address,
              metadata: `0x${serializedMetadataBuffer.toString("hex")}`,
              schema: `0x${serializedUpdatedSchemaBuffer.toString("hex")}`,
              schemaId,
            } satisfies UpdateSchemaSchema;

            param2 = {
              from: signer.address,
              metadata: `0x${Buffer.from(JSON.stringify(metadata2)).toString(
                "hex",
              )}`,
              schema: `0x${serializedUpdatedSchemaBuffer.toString("hex")}`,
              schemaId,
            } satisfies UpdateSchemaSchema;

            break;
          }
          default: {
            throw new Error(`Test Error: Invalid method ${method}`);
          }
        }

        const responseBuild1: SupertestJsonRpcResponse = await request(server)
          .post("/jsonrpc")
          .auth(defaultSignerSiopAccessToken, { type: "bearer" })
          .send({
            id: 231,
            jsonrpc: "2.0",
            method,
            params: [param1],
          });

        expect(responseBuild1.status).toBe(200);

        const transaction1 = responseBuild1.body.result as UnsignedTransaction;

        const responseBuild2: SupertestJsonRpcResponse = await request(server)
          .post("/jsonrpc")
          .auth(defaultSignerSiopAccessToken, { type: "bearer" })
          .send({
            id: 232,
            jsonrpc: "2.0",
            method,
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
          .auth(defaultSignerSiopAccessToken, { type: "bearer" })
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
          .auth(defaultSignerSiopAccessToken, { type: "bearer" })
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
    },
  );
});
