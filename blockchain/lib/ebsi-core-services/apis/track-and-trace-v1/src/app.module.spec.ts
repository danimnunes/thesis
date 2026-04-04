import hre from "hardhat";

import { encode, setupInterceptors } from "@ebsiint-api/shared";
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
import { PinoLogger } from "nestjs-pino";
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

import type { ApiConfig } from "./config/configuration.ts";
import type {
  Access,
  Document,
  Document__deprecated,
  DocumentAccesses,
  Event,
} from "./modules/documents/documents.interface.ts";
import type { JsonRpcResponseObject } from "./modules/jsonrpc/jsonrpc.interface.ts";
import type {
  AuthoriseDidSchema,
  CreateDocumentSchema,
  GrantAccessSchema,
  RemoveDocumentSchema,
  RevokeAccessSchema,
  UnsignedTransaction,
  WriteEventSchema,
} from "./modules/jsonrpc/validators/index.ts";

import { getNestFastifyApplication } from "../tests/utils/app.ts";
import { setupTestEnv } from "../tests/utils/trackAndTrace.ts";
import { AppModule } from "./app.module.ts";
import {
  BOOTSTRAP_DEPENDENCIES,
  RUNTIME_DEPENDENCIES,
} from "./config/configuration.ts";
import { formatEthersUnsignedTransaction } from "./modules/jsonrpc/jsonrpc.utils.ts";
import { LedgerService } from "./modules/ledger/ledger.service.ts";
import { AccountType, Permission } from "./shared/constants.ts";
import { didToHex } from "./shared/utils.ts";

interface Actor {
  did: string;
  wallet: ethers.BaseWallet;
}

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

describe("App Module", () => {
  const mockServer = setupServer();
  const bootstrapDependencies = Object.keys(
    BOOTSTRAP_DEPENDENCIES,
  ) as (keyof typeof BOOTSTRAP_DEPENDENCIES)[];
  const runtimeDependencies = Object.keys(
    RUNTIME_DEPENDENCIES,
  ) as (keyof typeof RUNTIME_DEPENDENCIES)[];

  beforeAll(() => {
    process.env.AXIOS_RETRY_DELAY = "1"; // 1ms

    // Intercept network requests
    mockServer.listen({
      onUnhandledRequest: ({ url }, print) => {
        // Bypass local requests
        if (new URL(url).hostname === "127.0.0.1") return;

        print.error();
      },
    });
  });

  afterEach(() => {
    mockServer.resetHandlers();
  });

  afterAll(() => {
    mockServer.close();
  });

  describe("onApplicationBootstrap hook", () => {
    afterEach(() => {
      mockServer.resetHandlers();
    });

    it("should prevent the app from starting if a bootstrap dependency triggers a network error", async () => {
      expect.assertions(1);

      const app = await getNestFastifyApplication({
        imports: [AppModule],
      });

      const configService =
        app.get<ConfigService<ApiConfig, true>>(ConfigService);

      const domain = configService.get("domain", { infer: true });
      const localOrigin =
        configService.get("localOrigin", { infer: true }) ?? domain;

      // All the bootstrap dependencies return a 200 except Authorisation API
      mockServer.use(
        ...bootstrapDependencies.map((dependency) => {
          return http.get(
            `${localOrigin}/${dependency}/${BOOTSTRAP_DEPENDENCIES[dependency]}`,
            () =>
              dependency === "authorisation"
                ? HttpResponse.error()
                : HttpResponse.json({}),
          );
        }),
      );

      await expect(() => app.init()).rejects.toThrow(
        `Unable to get ${localOrigin}/authorisation/${BOOTSTRAP_DEPENDENCIES.authorisation}, shutting down...`,
      );

      await app.close();
    });

    it("should prevent the app from starting if one of the bootstrap dependencies still responds with a 404 after all the attempts", async () => {
      expect.assertions(2);

      const mockedLogger = {
        debug: vi.fn(),
        error: vi.fn(),
        log: vi.fn(),
        warn: vi.fn(),
      };

      const app = await getNestFastifyApplication(
        { imports: [AppModule] },
        { logger: mockedLogger },
      );

      const configService =
        app.get<ConfigService<ApiConfig, true>>(ConfigService);

      const domain = configService.get("domain", { infer: true });
      const localOrigin =
        configService.get("localOrigin", { infer: true }) ?? domain;

      mockServer.use(
        ...bootstrapDependencies.map((dependency) => {
          return http.get(
            `${localOrigin}/${dependency}/${BOOTSTRAP_DEPENDENCIES[dependency]}`,
            () =>
              dependency === "authorisation"
                ? HttpResponse.text("Not Found", { status: 404 })
                : HttpResponse.json({}),
          );
        }),
      );

      await expect(() => app.init()).rejects.toThrow(
        `Unable to get ${localOrigin}/authorisation/${BOOTSTRAP_DEPENDENCIES.authorisation}, shutting down...`,
      );

      // Retry 30 times -> log 30 errors
      expect(mockedLogger.error).toHaveBeenCalledTimes(30);

      await app.close();
    });

    it("should start if all the bootstrap dependencies are up and running", async () => {
      expect.assertions(2);

      const mockedLogger = {
        debug: vi.fn(),
        error: vi.fn(),
        log: vi.fn(),
        warn: vi.fn(),
      };

      const app = await getNestFastifyApplication(
        { imports: [AppModule] },
        { logger: mockedLogger },
      );

      const configService =
        app.get<ConfigService<ApiConfig, true>>(ConfigService);

      const domain = configService.get("domain", { infer: true });
      const localOrigin =
        configService.get("localOrigin", { infer: true }) ?? domain;

      let reqCounter = 0;

      mockServer.use(
        ...bootstrapDependencies.map((dependency) => {
          return http.get(
            `${localOrigin}/${dependency}/${BOOTSTRAP_DEPENDENCIES[dependency]}`,
            () => {
              if (dependency === "authorisation") {
                reqCounter += 1;

                // Authorisation API first responds 15 times with a 404 (because it's starting)
                if (reqCounter <= 15) {
                  return HttpResponse.text("Not Found", { status: 404 });
                }

                // Then, it responds with a 200
                return HttpResponse.json({});
              }

              // All other dependencies respond with a 200
              return HttpResponse.json({});
            },
          );
        }),
      );

      await expect(app.init()).resolves.not.toThrow();

      // Retry 15 times -> log 15 errors
      expect(mockedLogger.error).toHaveBeenCalledTimes(15);

      await app.close();
    });
  });

  describe("Generic tests", () => {
    const mockedLogger = {
      debug: vi.fn(),
      error: vi.fn(),
      log: vi.fn(),
      warn: vi.fn(),
    };

    async function startApp() {
      // Start server
      const app = await getNestFastifyApplication(
        { imports: [AppModule] },
        { logger: mockedLogger },
      );

      const configService =
        app.get<ConfigService<ApiConfig, true>>(ConfigService);

      const domain = configService.get("domain", { infer: true });
      const localOrigin =
        configService.get("localOrigin", { infer: true }) ?? domain;

      // Mock dependencies
      const authorisationApiUrl =
        `${configService.get("authorisationApiUrl", { infer: true })}`.replace(
          domain,
          localOrigin,
        );

      mockServer.use(
        http.get(authorisationApiUrl, () => HttpResponse.json({})),
      );

      await app.init();
      const fastifyInstance = app.getHttpAdapter().getInstance();
      await fastifyInstance.ready();
      return app;
    }

    afterEach(() => {
      vi.clearAllMocks();
      vi.unstubAllEnvs();
      mockServer.resetHandlers();
    });

    describe("GET /", () => {
      it("should return 'ok' without logging the request nor the response", async () => {
        expect.assertions(6);

        const app = await startApp();
        const server = app.getHttpServer();

        const response = await request(server).get("");

        expect(response.text).toBe("ok");
        expect(response.status).toBe(200);

        // Check headers
        expect(response.headers["content-security-policy"]).toContain(
          "frame-ancestors 'none'",
        );
        expect(response.headers["x-frame-options"]).toStrictEqual("DENY");

        // The last logs show that the request was received and completed
        const calls = mockedLogger.log.mock.calls.length;
        expect(mockedLogger.log).toHaveBeenNthCalledWith(
          calls - 1,
          {
            request: {
              method: "GET",
              url: "/",
            },
          },
          "Request received",
          "LoggerMiddleware",
        );
        expect(mockedLogger.log).toHaveBeenNthCalledWith(
          calls,
          {
            response: { statusCode: 200 },
            responseTime: expect.any(Number),
          },
          "Request completed",
          "LoggerMiddleware",
        );

        await app.close();
      });

      it("should not display the framework in the error message", async () => {
        expect.assertions(3);

        const app = await startApp();
        const server = app.getHttpServer();

        const pinoLoggerSpy = vi
          .spyOn(PinoLogger.root, "info")
          .mockImplementation(() => {
            // Do nothing
          });

        const response = await request(server).get("/%91").send();

        expect(response.body).toStrictEqual({
          detail: "/%91 is not a valid url component",
          status: 400,
          title: "Bad Request",
          type: "about:blank",
        });
        expect(response.status).toBe(400);

        expect(pinoLoggerSpy).toHaveBeenCalledWith(
          {
            context: "frameworkErrors",
            error: expect.any(Error),
            request: {
              headers: {
                "accept-encoding": "gzip, deflate",
                connection: "close",
                host: expect.any(String),
              },
              method: "GET",
              url: "/%91",
            },
          },
          "Invalid request received",
        );

        await app.close();
      });

      it("should return an error 405 if called with a method different from GET", async () => {
        expect.assertions(16);

        const app = await startApp();
        const server = app.getHttpServer();

        // POST
        let response = await request(server).post("");

        expect(response.body).toStrictEqual({
          detail: "Cannot POST /. Allowed HTTP methods: GET, HEAD",
          status: 405,
          title: "Method Not Allowed",
          type: "about:blank",
        });
        expect(response.headers["allow"]).toStrictEqual("GET, HEAD");
        expect(response.headers["content-type"]).toStrictEqual(
          "application/problem+json; charset=utf-8",
        );
        expect(response.status).toBe(405);

        // HEAD
        response = await request(server).head("");

        expect(response.body).toStrictEqual({}); // HEAD response body is empty
        expect(response.headers["content-type"]).toStrictEqual(
          "text/plain; charset=utf-8",
        );
        expect(response.status).toBe(200);

        // PUT
        response = await request(server).put("");

        expect(response.body).toStrictEqual({
          detail: "Cannot PUT /. Allowed HTTP methods: GET, HEAD",
          status: 405,
          title: "Method Not Allowed",
          type: "about:blank",
        });
        expect(response.headers["allow"]).toStrictEqual("GET, HEAD");
        expect(response.headers["content-type"]).toStrictEqual(
          "application/problem+json; charset=utf-8",
        );
        expect(response.status).toBe(405);

        // PATCH
        response = await request(server).patch("");

        expect(response.body).toStrictEqual({
          detail: "Cannot PATCH /. Allowed HTTP methods: GET, HEAD",
          status: 405,
          title: "Method Not Allowed",
          type: "about:blank",
        });
        expect(response.headers["allow"]).toStrictEqual("GET, HEAD");
        expect(response.headers["content-type"]).toStrictEqual(
          "application/problem+json; charset=utf-8",
        );
        expect(response.status).toBe(405);

        // Check logs
        expect(mockedLogger.error.mock.calls).toStrictEqual([
          [
            "Cannot POST /. Allowed HTTP methods: GET, HEAD",
            expect.stringContaining(
              "MethodNotAllowedError: Method Not Allowed",
            ),
            "AllExceptionsFilter",
          ],
          [
            "Cannot PUT /. Allowed HTTP methods: GET, HEAD",
            expect.stringContaining(
              "MethodNotAllowedError: Method Not Allowed",
            ),
            "AllExceptionsFilter",
          ],
          [
            "Cannot PATCH /. Allowed HTTP methods: GET, HEAD",
            expect.stringContaining(
              "MethodNotAllowedError: Method Not Allowed",
            ),
            "AllExceptionsFilter",
          ],
        ]);

        await app.close();
      });

      it("should return an error 406 if called with an unsupported 'Accept' header", async () => {
        expect.assertions(4);

        const app = await startApp();
        const server = app.getHttpServer();

        const response = await request(server)
          .get("/")
          .set("Accept", "application/xml");

        expect(response.body).toStrictEqual({
          detail: "Only 'text/plain' content types supported",
          status: 406,
          title: "Not Acceptable",
          type: "about:blank",
        });
        expect(response.headers["content-type"]).toStrictEqual(
          "application/problem+json; charset=utf-8",
        );
        expect(response.status).toBe(406);

        // Check logs
        expect(mockedLogger.error.mock.calls).toStrictEqual([
          [
            "Cannot GET / with 'Accept' header 'application/xml'",
            expect.stringContaining("NotAcceptableError: Not Acceptable"),
            "AcceptsGuard",
          ],
        ]);

        await app.close();
      });
    });

    describe("GET /abi", () => {
      it("should not log the request and return the ABI", async () => {
        expect.assertions(6);

        const app = await startApp();
        const server = app.getHttpServer();

        const response = await request(server).get("/abi");

        expect(response.body).toStrictEqual(TrackAndTrace__factory.abi);
        expect(response.status).toBe(200);

        // Check headers
        expect(response.headers["content-security-policy"]).toContain(
          "frame-ancestors 'none'",
        );
        expect(response.headers["x-frame-options"]).toStrictEqual("DENY");

        // The last logs show that the request was received and completed
        const calls = mockedLogger.log.mock.calls.length;
        expect(mockedLogger.log).toHaveBeenNthCalledWith(
          calls - 1,
          {
            request: {
              method: "GET",
              url: "/abi",
            },
          },
          "Request received",
          "LoggerMiddleware",
        );
        expect(mockedLogger.log).toHaveBeenNthCalledWith(
          calls,
          {
            response: { statusCode: 200 },
            responseTime: expect.any(Number),
          },
          "Request completed",
          "LoggerMiddleware",
        );

        await app.close();
      });
    });

    describe("GET /unknown-route", () => {
      it("should return an error and log it", async () => {
        expect.assertions(3);

        const app = await startApp();
        const server = app.getHttpServer();

        const response = await request(server).get("/unknown-route").send();

        expect(response.body).toStrictEqual({
          detail: "Cannot GET /unknown-route",
          status: 404,
          title: "Not Found",
          type: "about:blank",
        });
        expect(response.status).toBe(404);

        // The last logs show the error
        const calls = mockedLogger.error.mock.calls.length;
        expect(mockedLogger.error).toHaveBeenNthCalledWith(
          calls,
          "Cannot GET /unknown-route",
          expect.stringContaining(
            "NotFoundException: Cannot GET /unknown-route",
          ),
          "AllExceptionsFilter",
        );

        await app.close();
      });
    });

    describe("GET /health", () => {
      it('should NOT log the request and response if the header "EBSI-Healthcheck" is present', async () => {
        expect.assertions(1);

        const app = await startApp();
        const configService =
          app.get<ConfigService<ApiConfig, true>>(ConfigService);

        const localOrigin =
          configService.get("localOrigin", { infer: true }) ??
          configService.get("domain", { infer: true });

        // All the runtime dependencies return a 200
        mockServer.use(
          ...runtimeDependencies.map((dependency) =>
            http.get(
              `${localOrigin}/${dependency}/${RUNTIME_DEPENDENCIES[dependency]}`,
              () => HttpResponse.json({}),
            ),
          ),
          http.get(
            configService.get("besuReadinessEndpoint", { infer: true }),
            () => HttpResponse.json({}),
          ),
        );

        await request(app.getHttpServer())
          .get("/health")
          .set("EBSI-Healthcheck", "1");

        const calls = mockedLogger.log.mock.calls.length;
        expect(mockedLogger.log).toHaveBeenNthCalledWith(
          calls,
          "Nest application successfully started",
          "NestApplication",
        );

        await app.close();
      });

      it('should log the request and response with level "debug"', async () => {
        expect.assertions(2);

        const app = await startApp();
        const configService =
          app.get<ConfigService<ApiConfig, true>>(ConfigService);

        const localOrigin =
          configService.get("localOrigin", { infer: true }) ??
          configService.get("domain", { infer: true });

        // All the runtime dependencies return a 200
        mockServer.use(
          ...runtimeDependencies.map((dependency) =>
            http.get(
              `${localOrigin}/${dependency}/${RUNTIME_DEPENDENCIES[dependency]}`,
              () => HttpResponse.json({}),
            ),
          ),
          http.get(
            configService.get("besuReadinessEndpoint", { infer: true }),
            () => HttpResponse.json({}),
          ),
        );

        await request(app.getHttpServer()).get("/health");

        const calls = mockedLogger.debug.mock.calls.length;

        // It should have logged the request
        expect(mockedLogger.debug).toHaveBeenNthCalledWith(
          calls - 1,
          {
            request: {
              body: "<empty>",
            },
          },
          "Incoming request",
          "LoggingInterceptor",
        );

        // Expect all the dependencies to be up
        const expectedStatuses = {
          ...runtimeDependencies
            .map((dependency) => ({
              [`${dependency}@${RUNTIME_DEPENDENCIES[dependency]}`]: {
                status: "up",
              },
            }))
            .reduce((acc, currentVal) => ({ ...acc, ...currentVal }), {}),
          Besu: { status: "up" },
        };

        // It should have logged the response (with body)
        expect(mockedLogger.debug).toHaveBeenNthCalledWith(
          calls,
          {
            response: {
              body: {
                details: expectedStatuses,
                error: {},
                info: expectedStatuses,
                status: "ok",
              },
            },
          },
          "Outgoing response",
          "LoggingInterceptor",
        );

        await app.close();
      });
    });

    describe("POST /jsonrpc", () => {
      it("should return error with wrong content-type", async () => {
        expect.assertions(2);

        const app = await startApp();
        const server = app.getHttpServer();

        const response = await request(server)
          .post("/jsonrpc")
          .set("Content-Type", "application/bad-content-type")
          .send();

        expect(response.status).toBe(415);
        expect(response.body).toStrictEqual({
          detail: "Unsupported Media Type",
          status: 415,
          title: "Unsupported Media Type",
          type: "about:blank",
        });
        await app.close();
      });
    });
  });

  it("should support a complete user journey", async () => {
    vi.stubEnv("LOCAL_ORIGIN", "https://local.ebsi");

    // Spin up test blockchain (hardhat)
    const testEnv = await setupTestEnv();

    const { trackAndTraceContract } = testEnv;

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
    const app = await getNestFastifyApplication({ imports: [AppModule] });

    const configService =
      app.get<ConfigService<ApiConfig, true>>(ConfigService);

    const domain = configService.get("domain", { infer: true });
    const localOrigin =
      configService.get("localOrigin", { infer: true }) ?? domain;

    // Mock bootstrap dependencies
    mockServer.use(
      ...bootstrapDependencies.map((dependency) => {
        return http.get(
          `${localOrigin}/${dependency}/${BOOTSTRAP_DEPENDENCIES[dependency]}`,
          () => HttpResponse.json({}),
        );
      }),
    );

    // Setup axios interceptors
    setupInterceptors(domain, localOrigin);

    await app.init();
    const fastifyInstance = app.getHttpAdapter().getInstance();
    await fastifyInstance.ready();
    const server = app.getHttpServer();

    // Generate key pair for Authorisation API v4
    const authorisationApiUrl =
      `${configService.get("authorisationApiUrl", { infer: true })}`.replace(
        domain,
        localOrigin,
      );
    const authApiKeyPair = await generateKeyPair("ES256");
    const publicKeyJwk = await exportJWK(authApiKeyPair.publicKey);
    const authApiKid = await calculateJwkThumbprint(publicKeyJwk);

    // Mock Auth API
    mockServer.use(
      // Mock Auth API /.well-known/openid-configuration endpoint
      http.get(`${authorisationApiUrl}/.well-known/openid-configuration`, () =>
        HttpResponse.json({ jwks_uri: `${authorisationApiUrl}/jwks` }),
      ),
      // Mock Auth API /jwks endpoint
      http.get(`${authorisationApiUrl}/jwks`, () =>
        HttpResponse.json({
          keys: [{ ...publicKeyJwk, kid: authApiKid }],
        }),
      ),
    );

    const createAccessToken = (sub: string, scp: string) => {
      return new SignJWT({ scp, sub })
        .setProtectedHeader({
          alg: "ES256",
          kid: authApiKid,
          typ: "JWT",
        })
        .sign(authApiKeyPair.privateKey);
    };

    // Prepare the different actors
    const authoriser = {
      did: EbsiWallet.createDid(),
      wallet: ethers.Wallet.createRandom(),
    } satisfies Actor;

    const documentCreator = {
      did: EbsiWallet.createDid(),
      wallet: ethers.Wallet.createRandom(),
    } satisfies Actor;

    const didEbsiEventsCreator = {
      did: EbsiWallet.createDid(),
      wallet: ethers.Wallet.createRandom(),
    } satisfies Actor;

    const didRegistryApiUrl = configService
      .get("didRegistryApiUrl", {
        infer: true,
      })
      .replace(domain, localOrigin);

    // documentCreator and didEbsiEventsCreator exist in the DID registry
    mockServer.use(
      http.get(
        escapeDid(`${didRegistryApiUrl}/identifiers/${documentCreator.did}`),
        () => HttpResponse.json({}),
      ),
      http.get(
        escapeDid(
          `${didRegistryApiUrl}/identifiers/${didEbsiEventsCreator.did}`,
        ),
        () => HttpResponse.json({}),
      ),
    );

    const didKeyEventsCreatorWallet = ethers.Wallet.createRandom();
    const didKeyEventsCreatorPublicKeyJwk = encode.publicKey.fromHexToJWK(
      didKeyEventsCreatorWallet.publicKey,
    );
    const didKeyEventsCreator = {
      did: util.createDid(didKeyEventsCreatorPublicKeyJwk),
      wallet: didKeyEventsCreatorWallet,
    } satisfies Actor;

    // Helper functions to avoid code repetition
    async function buildTransaction({
      accessToken,
      method,
      params,
    }: {
      accessToken: string;
      method: string;
      params: unknown[];
    }) {
      const responseBuild: SupertestJsonRpcResponse = await request(server)
        .post("/jsonrpc")
        .auth(accessToken, { type: "bearer" })
        .send({ id: 231, jsonrpc: "2.0", method, params });

      return responseBuild;
    }

    async function signAndSendTransaction({
      accessToken,
      signer,
      unsignedTransaction,
    }: {
      accessToken: string;
      signer: ethers.BaseWallet;
      unsignedTransaction: unknown;
    }) {
      const uTx = formatEthersUnsignedTransaction(
        unsignedTransaction as UnsignedTransaction,
      );

      const sgnTx = await signer.signTransaction(uTx);
      const signature = ethers.Transaction.from(sgnTx).signature;
      if (!signature) {
        throw new Error("Signature not found");
      }
      const { r, s, v } = signature;

      const responseSend: SupertestJsonRpcResponse = await request(server)
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

      return responseSend;
    }

    // "authoriser" allows "documentCreator" to create documents

    // Pre-requisites: "authoriser" has obtained a VC from an allowlisted entity and can get an access token with "tnt_authorise" scope
    const authoriserAccessToken = await createAccessToken(
      authoriser.did,
      "openid tnt_authorise",
    );

    let responseBuild = await buildTransaction({
      accessToken: authoriserAccessToken,
      method: "authoriseDid",
      params: [
        {
          authorisedDid: documentCreator.did,
          from: authoriser.wallet.address,
          senderDid: authoriser.did,
          whiteList: true,
        } satisfies AuthoriseDidSchema,
      ],
    });

    expect(responseBuild.status).toBe(200);

    let responseSend = await signAndSendTransaction({
      accessToken: authoriserAccessToken,
      signer: authoriser.wallet,
      unsignedTransaction: responseBuild.body.result,
    });

    expect(responseSend.status).toBe(200);

    // Check if "documentCreator" is registered as a creator
    let response = await request(server).head(
      `/accesses?creator=${documentCreator.did}`,
    );

    expect(response.status).toBe(204);

    // "documentCreator" creates a new document
    const documentCreatorCreateAccessToken = await createAccessToken(
      documentCreator.did,
      "openid tnt_create",
    );

    const document1 = {
      creator: documentCreator.did,
      hash: `0x${randomBytes(32).toString("hex")}`,
      metadata: "test metadata",
      timestamp: {
        datetime: "",
        proof: "",
      },
    };

    responseBuild = await buildTransaction({
      accessToken: documentCreatorCreateAccessToken,
      method: "createDocument",
      params: [
        {
          didEbsiCreator: document1.creator,
          documentHash: document1.hash,
          documentMetadata: document1.metadata,
          from: documentCreator.wallet.address,
        } satisfies CreateDocumentSchema,
      ],
    });

    expect(responseBuild.status).toBe(200);

    responseSend = await signAndSendTransaction({
      accessToken: documentCreatorCreateAccessToken,
      signer: documentCreator.wallet,
      unsignedTransaction: responseBuild.body.result,
    });

    expect(responseSend.status).toBe(200);

    // Get block containing the transaction
    let receipt = await hre.ethers.provider.getTransactionReceipt(
      responseSend.body.result as string,
    );

    if (!receipt) {
      throw new Error("Receipt not found");
    }

    let block = await hre.ethers.provider.getBlock(receipt.blockHash);

    if (!block) {
      throw new Error("Block not found");
    }

    // Extract datetime and proof from block
    document1.timestamp.datetime = `0x${block.timestamp.toString(16)}`;
    document1.timestamp.proof = `0x${block.number.toString(16).padStart(64, "0")}`;

    // Check document
    response = await request(server).get(`/documents/${document1.hash}`);

    expect(response.body).toStrictEqual({
      creator: document1.creator,
      metadata: document1.metadata,
      timestamp: {
        datetime: document1.timestamp.datetime,
        proof: document1.timestamp.proof,
        source: "block",
      },
    } satisfies Document);

    response = await request(server).get(
      `/documents/${document1.hash}?version=deprecated`,
    );

    expect(response.body).toStrictEqual({
      creator: document1.creator,
      events: [],
      metadata: document1.metadata,
      timestamp: {
        datetime: document1.timestamp.datetime,
        proof: document1.timestamp.proof,
        source: "block",
      },
    } satisfies Document__deprecated);

    // "documentCreator" adds a new event to the document
    const documentCreatorWriteAccessToken = await createAccessToken(
      documentCreator.did,
      "openid tnt_write",
    );

    const document1Event1 = {
      externalHash: `0x${randomBytes(32).toString("hex")}`,
      hash: "",
      metadata: "test event metadata",
      origin: "",
      sender: documentCreator.did,
      timestamp: {
        datetime: "",
        proof: "",
      },
    };

    responseBuild = await buildTransaction({
      accessToken: documentCreatorWriteAccessToken,
      method: "writeEvent",
      params: [
        {
          eventParams: {
            documentHash: document1.hash,
            externalHash: document1Event1.externalHash,
            metadata: document1Event1.metadata,
            origin: document1Event1.origin,
            sender: await didToHex(document1Event1.sender),
          },
          from: documentCreator.wallet.address,
        } satisfies WriteEventSchema,
      ],
    });

    expect(responseBuild.status).toBe(200);

    responseSend = await signAndSendTransaction({
      accessToken: documentCreatorWriteAccessToken,
      signer: documentCreator.wallet,
      unsignedTransaction: responseBuild.body.result,
    });

    expect(responseSend.status).toBe(200);

    // Get block containing the transaction
    receipt = await hre.ethers.provider.getTransactionReceipt(
      responseSend.body.result as string,
    );

    if (!receipt) {
      throw new Error("Receipt not found");
    }

    block = await hre.ethers.provider.getBlock(receipt.blockHash);

    if (!block) {
      throw new Error("Block not found");
    }

    // Extract datetime and proof from block
    document1Event1.timestamp.datetime = `0x${block.timestamp.toString(16)}`;
    document1Event1.timestamp.proof = `0x${block.number.toString(16).padStart(64, "0")}`;

    // Event hash is `keccak256(bytes(eventParams.externalHash))`
    document1Event1.hash = ethers.keccak256(
      Buffer.from(document1Event1.externalHash, "utf8"), // Note: externalHash is treated as an UTF-8 string
    );

    // Check document
    response = await request(server).get(`/documents/${document1.hash}`);

    expect(response.body).toStrictEqual({
      creator: document1.creator,
      metadata: document1.metadata,
      timestamp: {
        datetime: document1.timestamp.datetime,
        proof: document1.timestamp.proof,
        source: "block",
      },
    } satisfies Document);

    response = await request(server).get(
      `/documents/${document1.hash}?version=deprecated`,
    );

    expect(response.body).toStrictEqual({
      creator: document1.creator,
      events: [document1Event1.hash],
      metadata: document1.metadata,
      timestamp: {
        datetime: document1.timestamp.datetime,
        proof: document1.timestamp.proof,
        source: "block",
      },
    } satisfies Document__deprecated);

    // Check event
    response = await request(server).get(
      `/documents/${document1.hash}/events/${document1Event1.hash}`,
    );

    expect(response.body).toStrictEqual({
      externalHash: document1Event1.externalHash,
      hash: document1Event1.hash,
      metadata: document1Event1.metadata,
      origin: document1Event1.origin,
      sender: document1Event1.sender,
      timestamp: {
        datetime: document1Event1.timestamp.datetime,
        proof: document1Event1.timestamp.proof,
        source: "block",
      },
    } satisfies Event);

    // "documentCreator" grants "write" permission to "didEbsiEventsCreator" for the document
    responseBuild = await buildTransaction({
      accessToken: documentCreatorWriteAccessToken,
      method: "grantAccess",
      params: [
        {
          documentHash: document1.hash,
          from: documentCreator.wallet.address,
          grantedByAccount: await didToHex(documentCreator.did),
          grantedByAccType: AccountType.DID_EBSI,
          permission: Permission.WRITE,
          subjectAccount: await didToHex(didEbsiEventsCreator.did),
          subjectAccType: AccountType.DID_EBSI,
        } satisfies GrantAccessSchema,
      ],
    });

    expect(responseBuild.status).toBe(200);

    responseSend = await signAndSendTransaction({
      accessToken: documentCreatorWriteAccessToken,
      signer: documentCreator.wallet,
      unsignedTransaction: responseBuild.body.result,
    });

    expect(responseSend.status).toBe(200);

    // Check access
    response = await request(server).get(
      `/documents/${document1.hash}/accesses`,
    );

    expect(response.body).toStrictEqual({
      items: [
        {
          documentId: document1.hash,
          grantedBy: documentCreator.did,
          permission: "creator",
          subject: documentCreator.did,
        },
        {
          documentId: document1.hash,
          grantedBy: documentCreator.did,
          permission: "write",
          subject: didEbsiEventsCreator.did,
        },
      ] satisfies DocumentAccesses,
      links: {
        first: expect.stringContaining(
          `/documents/${document1.hash}/accesses?page[after]=1&page[size]=10`,
        ),
        last: expect.stringContaining(
          `/documents/${document1.hash}/accesses?page[after]=1&page[size]=10`,
        ),
        next: expect.stringContaining(
          `/documents/${document1.hash}/accesses?page[after]=1&page[size]=10`,
        ),
        prev: expect.stringContaining(
          `/documents/${document1.hash}/accesses?page[after]=1&page[size]=10`,
        ),
      },
      pageSize: 10,
      self: expect.stringContaining(
        `/documents/${document1.hash}/accesses?page[after]=1&page[size]=10`,
      ),
      total: 2,
    });

    // "didEbsiEventsCreator" adds a new event (external timestamp) to the document
    const didEbsiEventsCreatorWriteAccessToken = await createAccessToken(
      didEbsiEventsCreator.did,
      "openid tnt_write",
    );

    const document1Event2 = {
      externalHash: `0x${randomBytes(32).toString("hex")}`,
      hash: "",
      metadata: "test event metadata",
      origin: "",
      sender: didEbsiEventsCreator.did,
      timestamp: {
        datetime: Math.floor(Date.now() / 1000),
        proof: `0x${randomBytes(32).toString("hex")}`,
      },
    };

    responseBuild = await buildTransaction({
      accessToken: didEbsiEventsCreatorWriteAccessToken,
      method: "writeEvent",
      params: [
        {
          eventParams: {
            documentHash: document1.hash,
            externalHash: document1Event2.externalHash,
            metadata: document1Event2.metadata,
            origin: document1Event2.origin,
            sender: await didToHex(document1Event2.sender),
          },
          from: didEbsiEventsCreator.wallet.address,
          timestamp: document1Event2.timestamp.datetime,
          timestampProof: document1Event2.timestamp.proof,
        } satisfies WriteEventSchema,
      ],
    });

    expect(responseBuild.status).toBe(200);

    responseSend = await signAndSendTransaction({
      accessToken: didEbsiEventsCreatorWriteAccessToken,
      signer: didEbsiEventsCreator.wallet,
      unsignedTransaction: responseBuild.body.result,
    });

    expect(responseSend.status).toBe(200);

    // Event hash is `keccak256(bytes(eventParams.externalHash))`
    document1Event2.hash = ethers.keccak256(
      Buffer.from(document1Event2.externalHash, "utf8"), // Note: externalHash is treated as an UTF-8 string
    );

    // Check document
    response = await request(server).get(`/documents/${document1.hash}`);

    expect(response.body).toStrictEqual({
      creator: document1.creator,
      metadata: document1.metadata,
      timestamp: {
        datetime: document1.timestamp.datetime,
        proof: document1.timestamp.proof,
        source: "block",
      },
    } satisfies Document);

    response = await request(server).get(
      `/documents/${document1.hash}?version=deprecated`,
    );

    expect(response.body).toStrictEqual({
      creator: document1.creator,
      events: [document1Event1.hash, document1Event2.hash],
      metadata: document1.metadata,
      timestamp: {
        datetime: document1.timestamp.datetime,
        proof: document1.timestamp.proof,
        source: "block",
      },
    } satisfies Document__deprecated);

    // Check event
    response = await request(server).get(
      `/documents/${document1.hash}/events/${document1Event2.hash}`,
    );

    expect(response.body).toStrictEqual({
      externalHash: document1Event2.externalHash,
      hash: document1Event2.hash,
      metadata: document1Event2.metadata,
      origin: document1Event2.origin,
      sender: document1Event2.sender,
      timestamp: {
        datetime: `0x${document1Event2.timestamp.datetime.toString(16)}`,
        proof: document1Event2.timestamp.proof,
        source: "external",
      },
    } satisfies Event);

    // "documentCreator" grants "delegate" permission to "didEbsiEventsCreator" for the document
    responseBuild = await buildTransaction({
      accessToken: documentCreatorWriteAccessToken,
      method: "grantAccess",
      params: [
        {
          documentHash: document1.hash,
          from: documentCreator.wallet.address,
          grantedByAccount: await didToHex(documentCreator.did),
          grantedByAccType: AccountType.DID_EBSI,
          permission: Permission.DELEGATE,
          subjectAccount: await didToHex(didEbsiEventsCreator.did),
          subjectAccType: AccountType.DID_EBSI,
        } satisfies GrantAccessSchema,
      ],
    });

    expect(responseBuild.status).toBe(200);

    responseSend = await signAndSendTransaction({
      accessToken: documentCreatorWriteAccessToken,
      signer: documentCreator.wallet,
      unsignedTransaction: responseBuild.body.result,
    });

    expect(responseSend.status).toBe(200);

    // Check access
    response = await request(server).get(
      `/documents/${document1.hash}/accesses`,
    );

    expect(response.body).toStrictEqual({
      items: [
        {
          documentId: document1.hash,
          grantedBy: documentCreator.did,
          permission: "creator",
          subject: documentCreator.did,
        },
        {
          documentId: document1.hash,
          grantedBy: documentCreator.did,
          permission: "delegate",
          subject: didEbsiEventsCreator.did,
        },
        {
          documentId: document1.hash,
          grantedBy: documentCreator.did,
          permission: "write",
          subject: didEbsiEventsCreator.did,
        },
      ] satisfies DocumentAccesses,
      links: {
        first: expect.stringContaining(
          `/documents/${document1.hash}/accesses?page[after]=1&page[size]=10`,
        ),
        last: expect.stringContaining(
          `/documents/${document1.hash}/accesses?page[after]=1&page[size]=10`,
        ),
        next: expect.stringContaining(
          `/documents/${document1.hash}/accesses?page[after]=1&page[size]=10`,
        ),
        prev: expect.stringContaining(
          `/documents/${document1.hash}/accesses?page[after]=1&page[size]=10`,
        ),
      },
      pageSize: 10,
      self: expect.stringContaining(
        `/documents/${document1.hash}/accesses?page[after]=1&page[size]=10`,
      ),
      total: 3,
    });

    // "didEbsiEventsCreator" grants "write" permission to "didKeyEventsCreator" for the document
    responseBuild = await buildTransaction({
      accessToken: didEbsiEventsCreatorWriteAccessToken,
      method: "grantAccess",
      params: [
        {
          documentHash: document1.hash,
          from: didEbsiEventsCreator.wallet.address,
          grantedByAccount: await didToHex(didEbsiEventsCreator.did),
          grantedByAccType: AccountType.DID_EBSI,
          permission: Permission.WRITE,
          subjectAccount: await didToHex(didKeyEventsCreator.did),
          subjectAccType: AccountType.DID_KEY,
        } satisfies GrantAccessSchema,
      ],
    });

    expect(responseBuild.status).toBe(200);

    responseSend = await signAndSendTransaction({
      accessToken: didEbsiEventsCreatorWriteAccessToken,
      signer: didEbsiEventsCreator.wallet,
      unsignedTransaction: responseBuild.body.result,
    });

    expect(responseSend.status).toBe(200);

    // Check access
    response = await request(server).get(
      `/documents/${document1.hash}/accesses`,
    );

    expect(response.body).toStrictEqual({
      items: [
        {
          documentId: document1.hash,
          grantedBy: documentCreator.did,
          permission: "creator",
          subject: documentCreator.did,
        },
        {
          documentId: document1.hash,
          grantedBy: documentCreator.did,
          permission: "delegate",
          subject: didEbsiEventsCreator.did,
        },
        {
          documentId: document1.hash,
          grantedBy: documentCreator.did,
          permission: "write",
          subject: didEbsiEventsCreator.did,
        },
        {
          documentId: document1.hash,
          grantedBy: didEbsiEventsCreator.did,
          permission: "write",
          subject: didKeyEventsCreator.did,
        },
      ] satisfies DocumentAccesses,
      links: {
        first: expect.stringContaining(
          `/documents/${document1.hash}/accesses?page[after]=1&page[size]=10`,
        ),
        last: expect.stringContaining(
          `/documents/${document1.hash}/accesses?page[after]=1&page[size]=10`,
        ),
        next: expect.stringContaining(
          `/documents/${document1.hash}/accesses?page[after]=1&page[size]=10`,
        ),
        prev: expect.stringContaining(
          `/documents/${document1.hash}/accesses?page[after]=1&page[size]=10`,
        ),
      },
      pageSize: 10,
      self: expect.stringContaining(
        `/documents/${document1.hash}/accesses?page[after]=1&page[size]=10`,
      ),
      total: 4,
    });

    // "didKeyEventsCreator" adds a new event (external timestamp) to the document
    const didKeyEventsCreatorWriteAccessToken = await createAccessToken(
      didKeyEventsCreator.did,
      "openid tnt_write",
    );

    const document1Event3 = {
      externalHash: `0x${randomBytes(32).toString("hex")}`,
      hash: "",
      metadata: "test event metadata",
      origin: "",
      sender: didKeyEventsCreator.did,
      timestamp: {
        datetime: Math.floor(Date.now() / 1000),
        proof: `0x${randomBytes(32).toString("hex")}`,
      },
    };

    responseBuild = await buildTransaction({
      accessToken: didKeyEventsCreatorWriteAccessToken,
      method: "writeEvent",
      params: [
        {
          eventParams: {
            documentHash: document1.hash,
            externalHash: document1Event3.externalHash,
            metadata: document1Event3.metadata,
            origin: document1Event3.origin,
            sender: await didToHex(document1Event3.sender),
          },
          from: didKeyEventsCreator.wallet.address,
          timestamp: document1Event3.timestamp.datetime,
          timestampProof: document1Event3.timestamp.proof,
        } satisfies WriteEventSchema,
      ],
    });

    expect(responseBuild.status).toBe(200);

    responseSend = await signAndSendTransaction({
      accessToken: didKeyEventsCreatorWriteAccessToken,
      signer: didKeyEventsCreator.wallet,
      unsignedTransaction: responseBuild.body.result,
    });

    expect(responseSend.status).toBe(200);

    // Event hash is `keccak256(bytes(eventParams.externalHash))`
    document1Event3.hash = ethers.keccak256(
      Buffer.from(document1Event3.externalHash, "utf8"), // Note: externalHash is treated as an UTF-8 string
    );

    // Check document
    response = await request(server).get(`/documents/${document1.hash}`);

    expect(response.body).toStrictEqual({
      creator: document1.creator,
      metadata: document1.metadata,
      timestamp: {
        datetime: document1.timestamp.datetime,
        proof: document1.timestamp.proof,
        source: "block",
      },
    } satisfies Document);

    response = await request(server).get(
      `/documents/${document1.hash}?version=deprecated`,
    );

    expect(response.body).toStrictEqual({
      creator: document1.creator,
      events: [
        document1Event1.hash,
        document1Event2.hash,
        document1Event3.hash,
      ],
      metadata: document1.metadata,
      timestamp: {
        datetime: document1.timestamp.datetime,
        proof: document1.timestamp.proof,
        source: "block",
      },
    } satisfies Document__deprecated);

    // Check event
    response = await request(server).get(
      `/documents/${document1.hash}/events/${document1Event3.hash}`,
    );

    expect(response.body).toStrictEqual({
      externalHash: document1Event3.externalHash,
      hash: document1Event3.hash,
      metadata: document1Event3.metadata,
      origin: document1Event3.origin,
      sender: document1Event3.sender,
      timestamp: {
        datetime: `0x${document1Event3.timestamp.datetime.toString(16)}`,
        proof: document1Event3.timestamp.proof,
        source: "external",
      },
    } satisfies Event);

    // "didEbsiEventsCreator" revokes "write" permission to "didKeyEventsCreator" for the document
    responseBuild = await buildTransaction({
      accessToken: didEbsiEventsCreatorWriteAccessToken,
      method: "revokeAccess",
      params: [
        {
          documentHash: document1.hash,
          from: didEbsiEventsCreator.wallet.address,
          permission: Permission.WRITE,
          revokedByAccount: await didToHex(didEbsiEventsCreator.did),
          subjectAccount: await didToHex(didKeyEventsCreator.did),
        } satisfies RevokeAccessSchema,
      ],
    });

    expect(responseBuild.status).toBe(200);

    responseSend = await signAndSendTransaction({
      accessToken: didEbsiEventsCreatorWriteAccessToken,
      signer: didEbsiEventsCreator.wallet,
      unsignedTransaction: responseBuild.body.result,
    });

    expect(responseSend.status).toBe(200);

    // Check access
    response = await request(server).get(
      `/documents/${document1.hash}/accesses`,
    );

    expect(response.body).toStrictEqual({
      items: [
        {
          documentId: document1.hash,
          grantedBy: documentCreator.did,
          permission: "creator",
          subject: documentCreator.did,
        },
        {
          documentId: document1.hash,
          grantedBy: documentCreator.did,
          permission: "delegate",
          subject: didEbsiEventsCreator.did,
        },
        {
          documentId: document1.hash,
          grantedBy: documentCreator.did,
          permission: "write",
          subject: didEbsiEventsCreator.did,
        },
      ] satisfies DocumentAccesses,
      links: {
        first: expect.stringContaining(
          `/documents/${document1.hash}/accesses?page[after]=1&page[size]=10`,
        ),
        last: expect.stringContaining(
          `/documents/${document1.hash}/accesses?page[after]=1&page[size]=10`,
        ),
        next: expect.stringContaining(
          `/documents/${document1.hash}/accesses?page[after]=1&page[size]=10`,
        ),
        prev: expect.stringContaining(
          `/documents/${document1.hash}/accesses?page[after]=1&page[size]=10`,
        ),
      },
      pageSize: 10,
      self: expect.stringContaining(
        `/documents/${document1.hash}/accesses?page[after]=1&page[size]=10`,
      ),
      total: 3,
    });

    // "documentCreator" revokes "delegate" permission to "didEbsiEventsCreator" for the document
    responseBuild = await buildTransaction({
      accessToken: documentCreatorWriteAccessToken,
      method: "revokeAccess",
      params: [
        {
          documentHash: document1.hash,
          from: documentCreator.wallet.address,
          permission: Permission.DELEGATE,
          revokedByAccount: await didToHex(documentCreator.did),
          subjectAccount: await didToHex(didEbsiEventsCreator.did),
        } satisfies RevokeAccessSchema,
      ],
    });

    expect(responseBuild.status).toBe(200);

    responseSend = await signAndSendTransaction({
      accessToken: documentCreatorWriteAccessToken,
      signer: documentCreator.wallet,
      unsignedTransaction: responseBuild.body.result,
    });

    expect(responseSend.status).toBe(200);

    // Check access
    response = await request(server).get(
      `/documents/${document1.hash}/accesses`,
    );

    expect(response.body).toStrictEqual({
      items: [
        {
          documentId: document1.hash,
          grantedBy: documentCreator.did,
          permission: "creator",
          subject: documentCreator.did,
        },
        {
          documentId: document1.hash,
          grantedBy: documentCreator.did,
          permission: "write",
          subject: didEbsiEventsCreator.did,
        },
      ] satisfies DocumentAccesses,
      links: {
        first: expect.stringContaining(
          `/documents/${document1.hash}/accesses?page[after]=1&page[size]=10`,
        ),
        last: expect.stringContaining(
          `/documents/${document1.hash}/accesses?page[after]=1&page[size]=10`,
        ),
        next: expect.stringContaining(
          `/documents/${document1.hash}/accesses?page[after]=1&page[size]=10`,
        ),
        prev: expect.stringContaining(
          `/documents/${document1.hash}/accesses?page[after]=1&page[size]=10`,
        ),
      },
      pageSize: 10,
      self: expect.stringContaining(
        `/documents/${document1.hash}/accesses?page[after]=1&page[size]=10`,
      ),
      total: 2,
    });

    // "documentCreator" removes document1
    responseBuild = await buildTransaction({
      accessToken: documentCreatorWriteAccessToken,
      method: "removeDocument",
      params: [
        {
          documentHash: document1.hash,
          from: documentCreator.wallet.address,
        } satisfies RemoveDocumentSchema,
      ],
    });

    expect(responseBuild.status).toBe(200);

    responseSend = await signAndSendTransaction({
      accessToken: documentCreatorWriteAccessToken,
      signer: documentCreator.wallet,
      unsignedTransaction: responseBuild.body.result,
    });

    expect(responseSend.status).toBe(200);

    // Check document
    response = await request(server).get(`/documents/${document1.hash}`);

    expect(response.body).toStrictEqual({
      detail: `Document ${document1.hash} not found`,
      status: 404,
      title: "Document Not Found",
      type: "about:blank",
    });

    /**
     * Check revocation in cascade:
     * - Grant delegate access to an account
     * - Use that account to grant write access to other accounts
     * - Revoke the delegate access
     * - Check if the children were revoked as well
     */

    // "documentCreator" creates a new document
    const document2 = {
      creator: documentCreator.did,
      hash: `0x${randomBytes(32).toString("hex")}`,
      metadata: "test metadata",
      timestamp: {
        datetime: "",
        proof: "",
      },
    };

    responseBuild = await buildTransaction({
      accessToken: documentCreatorCreateAccessToken,
      method: "createDocument",
      params: [
        {
          didEbsiCreator: document2.creator,
          documentHash: document2.hash,
          documentMetadata: document2.metadata,
          from: documentCreator.wallet.address,
        } satisfies CreateDocumentSchema,
      ],
    });

    expect(responseBuild.status).toBe(200);

    responseSend = await signAndSendTransaction({
      accessToken: documentCreatorCreateAccessToken,
      signer: documentCreator.wallet,
      unsignedTransaction: responseBuild.body.result,
    });

    expect(responseSend.status).toBe(200);

    // "documentCreator" grants "delegate" permission to "didEbsiEventsCreator" for the document
    responseBuild = await buildTransaction({
      accessToken: documentCreatorWriteAccessToken,
      method: "grantAccess",
      params: [
        {
          documentHash: document2.hash,
          from: documentCreator.wallet.address,
          grantedByAccount: await didToHex(documentCreator.did),
          grantedByAccType: AccountType.DID_EBSI,
          permission: Permission.DELEGATE,
          subjectAccount: await didToHex(didEbsiEventsCreator.did),
          subjectAccType: AccountType.DID_EBSI,
        } satisfies GrantAccessSchema,
      ],
    });

    expect(responseBuild.status).toBe(200);

    responseSend = await signAndSendTransaction({
      accessToken: documentCreatorWriteAccessToken,
      signer: documentCreator.wallet,
      unsignedTransaction: responseBuild.body.result,
    });

    expect(responseSend.status).toBe(200);

    // "didEbsiEventsCreator" grants "write" permission to multiple accounts
    for (let i = 0; i < 10; i += 1) {
      responseBuild = await buildTransaction({
        accessToken: didEbsiEventsCreatorWriteAccessToken,
        method: "grantAccess",
        params: [
          {
            documentHash: document2.hash,
            from: didEbsiEventsCreator.wallet.address,

            grantedByAccount: await didToHex(didEbsiEventsCreator.did),
            grantedByAccType: AccountType.DID_EBSI,
            permission: Permission.WRITE,

            subjectAccount: await didToHex(EbsiWallet.createDid()),
            subjectAccType: AccountType.DID_EBSI,
          } satisfies GrantAccessSchema,
        ],
      });

      expect(responseBuild.status).toBe(200);

      responseSend = await signAndSendTransaction({
        accessToken: didEbsiEventsCreatorWriteAccessToken,
        signer: didEbsiEventsCreator.wallet,
        unsignedTransaction: responseBuild.body.result,
      });

      expect(responseSend.status).toBe(200);
    }

    // Check access
    response = await request(server).get(
      `/documents/${document2.hash}/accesses?page[after]=1&page[size]=20`,
    );

    expect(response.body).toStrictEqual({
      items: [
        {
          documentId: document2.hash,
          grantedBy: documentCreator.did,
          permission: "creator",
          subject: documentCreator.did,
        },
        {
          documentId: document2.hash,
          grantedBy: documentCreator.did,
          permission: "delegate",
          subject: didEbsiEventsCreator.did,
        },
        ...Array.from<Access>({ length: 10 }).fill({
          documentId: document2.hash,
          grantedBy: didEbsiEventsCreator.did,
          permission: "write",
          subject: expect.any(String),
        }),
      ] satisfies DocumentAccesses,
      links: {
        first: expect.stringContaining(
          `/documents/${document2.hash}/accesses?page[after]=1&page[size]=20`,
        ),
        last: expect.stringContaining(
          `/documents/${document2.hash}/accesses?page[after]=1&page[size]=20`,
        ),
        next: expect.stringContaining(
          `/documents/${document2.hash}/accesses?page[after]=1&page[size]=20`,
        ),
        prev: expect.stringContaining(
          `/documents/${document2.hash}/accesses?page[after]=1&page[size]=20`,
        ),
      },
      pageSize: 20,
      self: expect.stringContaining(
        `/documents/${document2.hash}/accesses?page[after]=1&page[size]=20`,
      ),
      total: 12,
    });

    // "documentCreator" revokes "delegate" permission to "didEbsiEventsCreator" for the document
    responseBuild = await buildTransaction({
      accessToken: documentCreatorWriteAccessToken,
      method: "revokeAccess",
      params: [
        {
          documentHash: document2.hash,
          from: documentCreator.wallet.address,
          permission: Permission.DELEGATE,
          revokedByAccount: await didToHex(documentCreator.did),
          subjectAccount: await didToHex(didEbsiEventsCreator.did),
        } satisfies RevokeAccessSchema,
      ],
    });

    expect(responseBuild.status).toBe(200);

    responseSend = await signAndSendTransaction({
      accessToken: documentCreatorWriteAccessToken,
      signer: documentCreator.wallet,
      unsignedTransaction: responseBuild.body.result,
    });

    expect(responseSend.status).toBe(200);

    // Check access
    response = await request(server).get(
      `/documents/${document2.hash}/accesses?page[after]=1&page[size]=20`,
    );

    expect(response.body).toStrictEqual({
      items: [
        {
          documentId: document2.hash,
          grantedBy: documentCreator.did,
          permission: "creator",
          subject: documentCreator.did,
        },
        // the other accounts (didEbsiEventsCreator and its children) are revoked
      ] satisfies DocumentAccesses,
      links: {
        first: expect.stringContaining(
          `/documents/${document2.hash}/accesses?page[after]=1&page[size]=20`,
        ),
        last: expect.stringContaining(
          `/documents/${document2.hash}/accesses?page[after]=1&page[size]=20`,
        ),
        next: expect.stringContaining(
          `/documents/${document2.hash}/accesses?page[after]=1&page[size]=20`,
        ),
        prev: expect.stringContaining(
          `/documents/${document2.hash}/accesses?page[after]=1&page[size]=20`,
        ),
      },
      pageSize: 20,
      self: expect.stringContaining(
        `/documents/${document2.hash}/accesses?page[after]=1&page[size]=20`,
      ),
      total: 1,
    });

    // End of the test, close server
    await app.close();
  });
});
