import hre from "hardhat";
import * as taskNames from "hardhat/builtin-tasks/task-names.js";
import type { JsonRpcServer } from "hardhat/types/index.js";

import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { JsonRpcError, JsonRpcResult } from "ethers";
import type { RawServerDefault } from "fastify";
import type { GenerateKeyPairResult, JWTPayload } from "jose";

import "@nomicfoundation/hardhat-ethers";
import { encode } from "@ebsiint-api/shared";
import { ProxyFactory__factory } from "@ebsiint-sc/trusted-contracts-registry-v1";
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
import type { BesuJsonRpcError, BesuJsonRpcResult } from "./besu.interface.ts";

import { getNestFastifyApplication } from "../../../tests/utils/app.ts";
import { setupTestEnv } from "../../../tests/utils/tcr.ts";
import { AuthService } from "../auth/auth.service.ts";
import { BesuModule } from "./besu.module.ts";

/**
 * Escape DID in URLs mocked by MSW
 * @see https://github.com/mswjs/msw/discussions/739#discussioncomment-2524732
 */
function escapeDid(url: string) {
  return url.replace("did:ebsi:", String.raw`did\:ebsi\:`);
}

describe("Besu Module", () => {
  let app: NestFastifyApplication;
  let server: RawServerDefault;
  let hardhatServer: JsonRpcServer;
  const hrePort = 8547; // 8546 might already be used for ssh port forwarding
  let testEnv: Awaited<ReturnType<typeof setupTestEnv>>;
  let proxyFactoryContractAddress: string;
  const mockServer = setupServer();
  let authorisationApiUrl: string;
  let authService: AuthService;
  let authApiKeyPair: GenerateKeyPairResult;
  let authApiKid: string;
  let createAccessToken: (payload: JWTPayload) => Promise<string>;
  let didRegistryApiUrl: string;
  let trustedPoliciesRegistryApiUrl: string;

  describe.each([`http://127.0.0.1:${hrePort}`, `ws://127.0.0.1:${hrePort}`])(
    "connecting to %s",
    (hreUrl: string) => {
      beforeAll(async () => {
        // Intercept network requests
        mockServer.listen({
          onUnhandledRequest: ({ url }, print) => {
            // Bypass local requests
            if (new URL(url).hostname === "127.0.0.1") return;

            print.error();
          },
        });

        hardhatServer = (await hre.run(taskNames.TASK_NODE_CREATE_SERVER, {
          hostname: "127.0.0.1",
          port: hrePort,
          provider: hre.network.provider,
        })) as JsonRpcServer;

        await hardhatServer.listen();

        vi.stubEnv("BESU_RPC_NODE", hreUrl);

        // Spin up test blockchain (hardhat)
        testEnv = await setupTestEnv({
          contractsTotal: 3,
        });

        const { proxyFactoryContract } = testEnv;
        proxyFactoryContractAddress = await proxyFactoryContract.getAddress();
        vi.stubEnv("PROXY_FACTORY_CONTRACT_ADDR", proxyFactoryContractAddress);

        // Mock contract
        vi.spyOn(ProxyFactory__factory, "connect").mockImplementation(
          // Create new instance without runner (provider)
          () => proxyFactoryContract.connect(),
        );

        // Start server
        app = await getNestFastifyApplication({ imports: [BesuModule] });

        authService = app.get<AuthService>(AuthService);

        await app.init();
        const fastifyInstance = app.getHttpAdapter().getInstance();
        await fastifyInstance.ready();
        server = app.getHttpServer();

        const configService =
          app.get<ConfigService<ApiConfig, true>>(ConfigService);

        authorisationApiUrl = configService.get("authorisationApiUrl", {
          infer: true,
        });
        didRegistryApiUrl = configService.get("didRegistryApiUrl", {
          infer: true,
        });
        trustedPoliciesRegistryApiUrl = configService.get(
          "trustedPoliciesRegistryApiUrl",
          { infer: true },
        );
      });

      beforeEach(async () => {
        // @ts-expect-error cacheManager is private
        await authService.cacheManager.clear();

        // Generate key pair for Authorisation API v4 and create access token
        authApiKeyPair = await generateKeyPair("ES256");
        const publicKeyJwk = await exportJWK(authApiKeyPair.publicKey);
        authApiKid = await calculateJwkThumbprint(publicKeyJwk);

        createAccessToken = async (payload: JWTPayload) => {
          return new SignJWT(payload)
            .setProtectedHeader({
              alg: "ES256",
              kid: authApiKid,
              typ: "JWT",
            })
            .sign(authApiKeyPair.privateKey);
        };

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

      afterEach(() => {
        mockServer.resetHandlers();
        vi.resetAllMocks();
      });

      afterAll(async () => {
        await app.close();
        await hardhatServer.close();
      });

      // Generic tests
      it("should return an error 400 if there's no payload", async () => {
        expect.assertions(2);

        // Missing payload
        const response = await request(server).post("/blockchains/besu").send();

        expect(response.body).toStrictEqual({
          error: {
            code: -32_700,
            message: "Parse error",
          },
          // eslint-disable-next-line unicorn/no-null
          id: null,
          jsonrpc: "2.0",
        });
        expect(response.status).toBe(400);
      });

      it("should return an error 400 if the payload can't be parsed", async () => {
        expect.assertions(2);

        // Invalid JSON
        const response = await request(server).post("/blockchains/besu").send(`[
          {
            "jsonrpc": "2.0",
            "id": "2",
            "m
        ]`);

        expect(response.body).toStrictEqual({
          error: {
            code: -32_700,
            message: "Parse error",
          },
          // eslint-disable-next-line unicorn/no-null
          id: null,
          jsonrpc: "2.0",
        });
        expect(response.status).toBe(400);
      });

      it("should return an error if the payload doesn't pass the validation", async () => {
        expect.assertions(2);

        // Batch contains a value that is not an object
        const response = await request(server)
          .post("/blockchains/besu")
          .send(["invalid"]);

        expect(response.body).toStrictEqual([
          {
            error: {
              code: -32_600,
              message: "Invalid Request",
            },
            // eslint-disable-next-line unicorn/no-null
            id: null,
            jsonrpc: "2.0",
          },
        ]);
        expect(response.status).toBe(200);
      });

      it("should return the chain ID", async () => {
        expect.assertions(8);

        let response = await request(server).post("/blockchains/besu").send({
          id: "42",
          jsonrpc: "2.0",
          method: "eth_chainId",
          params: [],
        });

        expect(response.body).toStrictEqual({
          id: "42",
          jsonrpc: "2.0",
          result: "0x7a69",
        });
        expect(response.status).toBe(200);
        expect(response.header).toHaveProperty("content-type");
        expect(response.headers["content-type"]).toStrictEqual(
          expect.stringContaining("application/json"),
        );

        // Sending request as a string
        response = await request(server).post("/blockchains/besu").send(`{
          "id": "abc",
          "jsonrpc": "2.0",
          "method": "eth_chainId",
          "params": []
        }`);

        expect(response.body).toStrictEqual({
          id: "abc",
          jsonrpc: "2.0",
          result: "0x7a69",
        });
        expect(response.status).toBe(200);
        expect(response.header).toHaveProperty("content-type");
        expect(response.headers["content-type"]).toStrictEqual(
          expect.stringContaining("application/json"),
        );
      });

      it("should return the chain ID when params is omitted", async () => {
        expect.assertions(8);

        // Test without params field
        let response = await request(server).post("/blockchains/besu").send({
          id: "42",
          jsonrpc: "2.0",
          method: "eth_chainId",
        });

        expect(response.body).toStrictEqual({
          id: "42",
          jsonrpc: "2.0",
          result: "0x7a69",
        });
        expect(response.status).toBe(200);
        expect(response.header).toHaveProperty("content-type");
        expect(response.headers["content-type"]).toStrictEqual(
          expect.stringContaining("application/json"),
        );

        // Sending request as a string without params
        response = await request(server).post("/blockchains/besu").send(`{
          "id": "abc",
          "jsonrpc": "2.0",
          "method": "eth_chainId"
        }`);

        expect(response.body).toStrictEqual({
          id: "abc",
          jsonrpc: "2.0",
          result: "0x7a69",
        });
        expect(response.status).toBe(200);
        expect(response.header).toHaveProperty("content-type");
        expect(response.headers["content-type"]).toStrictEqual(
          expect.stringContaining("application/json"),
        );
      });

      it("should ignore notifications (requests without id)", async () => {
        expect.assertions(4);

        const response = await request(server).post("/blockchains/besu").send({
          // No id
          jsonrpc: "2.0",
          method: "eth_chainId",
        });

        expect(response.text).toBe("");
        expect(response.status).toBe(200);
        expect(response.header).toHaveProperty("content-type");
        expect(response.headers["content-type"]).toStrictEqual(
          expect.stringContaining("application/json"),
        );
      });

      it("should return an error when the method does not exist or is not available", async () => {
        expect.assertions(2);

        // "test" method doesn't exist
        const response = await request(server).post("/blockchains/besu").send({
          id: "43",
          jsonrpc: "2.0",
          method: "test",
        });

        expect(response.body).toStrictEqual({
          error: {
            code: -32_601,
            message: "The method test does not exist / is not available.",
          },
          id: "43",
          jsonrpc: "2.0",
        });
        expect(response.status).toBe(200);
      });

      it("should return an error when the batch size exceeds the limit", async () => {
        expect.assertions(2);

        // Create a batch with more than 1024 requests
        const response = await request(server)
          .post("/blockchains/besu")
          .send(
            Array.from({ length: 1025 }).map(() => ({
              id: "42",
              jsonrpc: "2.0",
              method: "eth_chainId",
            })),
          );

        expect(response.body).toStrictEqual({
          error: {
            code: -32_005,
            message: "Number of requests exceeds max batch size",
          },
          // eslint-disable-next-line unicorn/no-null
          id: null,
          jsonrpc: "2.0",
        });
        expect(response.status).toBe(200);
      });

      it("should forward the error returned by the provider", async () => {
        expect.assertions(2);

        const error = {
          error: {
            code: -32_604,
          },
          id: "42",
          jsonrpc: "2.0",
        } satisfies BesuJsonRpcError;

        const provider = hreUrl.startsWith("http")
          ? ethers.JsonRpcProvider
          : ethers.WebSocketProvider;

        vi.spyOn(provider.prototype, "_send").mockImplementation(() => {
          // @ts-expect-error ethers.js expects "id" to be a number while Besu accepts null | number | string
          return Promise.resolve([error as JsonRpcError]);
        });

        const response = await request(server).post("/blockchains/besu").send({
          id: "42",
          jsonrpc: "2.0",
          method: "eth_chainId",
        });

        expect(response.body).toStrictEqual(error);
        expect(response.status).toBe(200);
      });

      it("should handle unexpected internal responses", async () => {
        expect.assertions(2);

        // Unexpected response to ethers.js _send() method: the response contains 2 elements
        const besuResponse = [
          {
            id: "42",
            jsonrpc: "2.0",
            result: "",
          },
          {
            id: "42",
            jsonrpc: "2.0",
            result: "",
          },
        ] satisfies BesuJsonRpcResult[];

        const provider = hreUrl.startsWith("http")
          ? ethers.JsonRpcProvider
          : ethers.WebSocketProvider;

        vi.spyOn(provider.prototype, "_send").mockImplementation(() => {
          // @ts-expect-error ethers.js expects "id" to be a number while Besu accepts null | number | string
          return Promise.resolve(besuResponse as JsonRpcResult[]);
        });

        const response = await request(server).post("/blockchains/besu").send({
          id: "42",
          jsonrpc: "2.0",
          method: "eth_chainId",
        });

        expect(response.body).toStrictEqual({
          error: {
            code: -32_603,
            message: "Internal error",
          },
          id: "42",
          jsonrpc: "2.0",
        });
        expect(response.status).toBe(200);
      });

      it("should handle internal errors", async () => {
        expect.assertions(2);

        const provider = hreUrl.startsWith("http")
          ? ethers.JsonRpcProvider
          : ethers.WebSocketProvider;

        vi.spyOn(provider.prototype, "_send").mockImplementation(() => {
          // Something unexpected happens during the request
          return Promise.reject(new Error("error"));
        });

        const response = await request(server)
          .post("/blockchains/besu")
          .send({
            id: 1,
            jsonrpc: "2.0",
            method: "eth_getTransactionCount",
            params: ["0x213", "latest"],
          });

        // Ledger API should return a generic internal error and log the actual error
        expect(response.body).toStrictEqual({
          error: {
            code: -32_603,
            message: "Internal error",
          },
          id: 1,
          jsonrpc: "2.0",
        });
        expect(response.status).toBe(200);

        // TODO: check that "error" has been logged
      });

      it("should support batch requests", async () => {
        expect.assertions(2);

        const response = await request(server)
          .post("/blockchains/besu")
          .send([
            {
              id: "42",
              jsonrpc: "2.0",
              method: "eth_chainId",
            },
            // "test" method doesn't exist
            {
              id: "43",
              jsonrpc: "2.0",
              method: "test",
            },
            // Notifications should be ignored
            {
              // No id
              jsonrpc: "2.0",
              method: "eth_chainId",
            },
          ]);

        expect(response.body).toStrictEqual([
          {
            id: "42",
            jsonrpc: "2.0",
            result: "0x7a69",
          },
          {
            error: {
              code: -32_601,
              message: "The method test does not exist / is not available.",
            },
            id: "43",
            jsonrpc: "2.0",
          },
        ]);
        expect(response.status).toBe(200);
      });

      it("should return an error when the sender calls eth_sendRawTransaction without a raw transaction", async () => {
        expect.assertions(2);

        const response = await request(server).post("/blockchains/besu").send({
          id: "42",
          jsonrpc: "2.0",
          method: "eth_sendRawTransaction",
          params: [],
        });

        expect(response.body).toStrictEqual({
          error: {
            code: -32_600,
            message:
              "The method eth_sendRawTransaction requires a raw transaction.",
          },
          id: "42",
          jsonrpc: "2.0",
        });
        expect(response.status).toBe(200);
      });

      it("should return an error when the sender calls eth_sendRawTransaction without a raw transaction", async () => {
        expect.assertions(2);

        const response = await request(server).post("/blockchains/besu").send({
          id: "42",
          jsonrpc: "2.0",
          method: "eth_sendRawTransaction",
          params: [],
        });

        expect(response.body).toStrictEqual({
          error: {
            code: -32_600,
            message:
              "The method eth_sendRawTransaction requires a raw transaction.",
          },
          id: "42",
          jsonrpc: "2.0",
        });
        expect(response.status).toBe(200);
      });

      it("should return an error when the sender calls eth_sendRawTransaction with an invalid raw transaction", async () => {
        expect.assertions(2);

        const response = await request(server)
          .post("/blockchains/besu")
          .send({
            id: "42",
            jsonrpc: "2.0",
            method: "eth_sendRawTransaction",
            params: ["not a valid raw transaction"],
          });

        expect(response.body).toStrictEqual({
          error: {
            code: -32_600,
            message: "Invalid raw transaction",
          },
          id: "42",
          jsonrpc: "2.0",
        });
        expect(response.status).toBe(200);
      });

      it("should return an error if the eth_sendRawTransaction transaction is missing the 'to' field", async () => {
        expect.assertions(2);

        const { proxyFactoryContract, templates } = testEnv;
        const template = templates[0]!;

        // In the unit tests, any wallet can deploy a proxy because the TPR and DIDR mocks always return true
        const trustedIssuer = ethers.Wallet.createRandom();
        const trustedIssuerDid = EbsiWallet.createDid();

        const initData = hre.ethers.AbiCoder.defaultAbiCoder().encode(
          ["string", "string", "address", "bytes32"],
          [
            "MyInstance",
            "1.0.0",
            trustedIssuer.address,
            hre.ethers.keccak256("0x"),
          ],
        );

        const data = proxyFactoryContract.interface.encodeFunctionData(
          "deployProxy",
          [template.name, template.version, initData, trustedIssuerDid],
        );

        const tx = await trustedIssuer.signTransaction({
          chainId: "0x7a69",
          data,
          from: trustedIssuer.address,
          gasLimit: "0x1000000",
          gasPrice: "0x0",
          // to: proxyFactoryContractAddress,
          value: "0x0",
        });

        const response = await request(server)
          .post("/blockchains/besu")
          .send({
            id: "42",
            jsonrpc: "2.0",
            method: "eth_sendRawTransaction",
            params: [tx],
          });

        expect(response.body).toStrictEqual({
          error: {
            code: -32_600,
            message:
              "The method eth_sendRawTransaction requires a contract address (to).",
          },
          id: "42",
          jsonrpc: "2.0",
        });
        expect(response.status).toBe(200);
      });

      it("should return an error if the user doesn't have the right policy", async () => {
        expect.assertions(2);

        const { proxyFactoryContract, templates } = testEnv;
        const template = templates[0]!;

        // In the unit tests, any wallet can deploy a proxy because the TPR and DIDR mocks always return true
        const trustedIssuer = ethers.Wallet.createRandom();
        const trustedIssuerDid = EbsiWallet.createDid();

        const initData = hre.ethers.AbiCoder.defaultAbiCoder().encode(
          ["string", "string", "address", "bytes32"],
          [
            "MyInstance",
            "1.0.0",
            trustedIssuer.address,
            hre.ethers.keccak256("0x"),
          ],
        );

        const data = proxyFactoryContract.interface.encodeFunctionData(
          "deployProxy",
          [template.name, template.version, initData, trustedIssuerDid],
        );

        const tx = await trustedIssuer.signTransaction({
          chainId: "0x7a69",
          data,
          from: trustedIssuer.address,
          gasLimit: "0x1000000",
          gasPrice: "0x0",
          to: proxyFactoryContractAddress,
          value: "0x0",
        });

        mockServer.use(
          // Mock TPR API
          http.get(
            `${trustedPoliciesRegistryApiUrl}/subjects/${trustedIssuer.address}/policies/${encodeURIComponent("TCR:deployProxy")}`,
            () => HttpResponse.json({}, { status: 404 }),
          ),
        );

        const response = await request(server)
          .post("/blockchains/besu")
          .send({
            id: "42",
            jsonrpc: "2.0",
            method: "eth_sendRawTransaction",
            params: [tx],
          });

        expect(response.body).toStrictEqual({
          error: {
            code: -32_600,
            message: `Address ${trustedIssuer.address} is not allowed to deploy proxies.`,
          },
          id: "42",
          jsonrpc: "2.0",
        });
        expect(response.status).toBe(200);
      });

      it("should return an internal error if TPR API responds with an error 500", async () => {
        expect.assertions(2);

        const { proxyFactoryContract, templates } = testEnv;
        const template = templates[0]!;

        // In the unit tests, any wallet can deploy a proxy because the TPR and DIDR mocks always return true
        const trustedIssuer = ethers.Wallet.createRandom();
        const trustedIssuerDid = EbsiWallet.createDid();

        const initData = hre.ethers.AbiCoder.defaultAbiCoder().encode(
          ["string", "string", "address", "bytes32"],
          [
            "MyInstance",
            "1.0.0",
            trustedIssuer.address,
            hre.ethers.keccak256("0x"),
          ],
        );

        const data = proxyFactoryContract.interface.encodeFunctionData(
          "deployProxy",
          [template.name, template.version, initData, trustedIssuerDid],
        );

        const tx = await trustedIssuer.signTransaction({
          chainId: "0x7a69",
          data,
          from: trustedIssuer.address,
          gasLimit: "0x1000000",
          gasPrice: "0x0",
          to: proxyFactoryContractAddress,
          value: "0x0",
        });

        mockServer.use(
          // Mock TPR API
          http.get(
            `${trustedPoliciesRegistryApiUrl}/subjects/${trustedIssuer.address}/policies/${encodeURIComponent("TCR:deployProxy")}`,
            () => HttpResponse.json({}, { status: 500 }),
          ),
        );

        const response = await request(server)
          .post("/blockchains/besu")
          .send({
            id: "42",
            jsonrpc: "2.0",
            method: "eth_sendRawTransaction",
            params: [tx],
          });

        expect(response.body).toStrictEqual({
          error: {
            code: -32_603,
            message: "Internal error",
          },
          id: "42",
          jsonrpc: "2.0",
        });
        expect(response.status).toBe(200);
      });

      it("should bypass eth_sendRawTransaction transactions to the proxy contract factory if the user has the right policy", async () => {
        expect.assertions(2);

        const { proxyFactoryContract, templates } = testEnv;
        const template = templates[0]!;

        // In the unit tests, any wallet can deploy a proxy because the TPR and DIDR mocks always return true
        const trustedIssuer = ethers.Wallet.createRandom();
        const trustedIssuerDid = EbsiWallet.createDid();

        const initData = hre.ethers.AbiCoder.defaultAbiCoder().encode(
          ["string", "string", "address", "bytes32"],
          [
            "MyInstance",
            "1.0.0",
            trustedIssuer.address,
            hre.ethers.keccak256("0x"),
          ],
        );

        const data = proxyFactoryContract.interface.encodeFunctionData(
          "deployProxy",
          [template.name, template.version, initData, trustedIssuerDid],
        );

        const tx = await trustedIssuer.signTransaction({
          chainId: "0x7a69",
          data,
          from: trustedIssuer.address,
          gasLimit: "0x1000000",
          gasPrice: "0x0",
          to: proxyFactoryContractAddress,
          value: "0x0",
        });

        mockServer.use(
          // Mock TPR API
          http.get(
            `${trustedPoliciesRegistryApiUrl}/subjects/${trustedIssuer.address}/policies/${encodeURIComponent("TCR:deployProxy")}`,
            () => HttpResponse.json({}, { status: 200 }),
          ),
        );

        const response = await request(server)
          .post("/blockchains/besu")
          .send({
            id: "42",
            jsonrpc: "2.0",
            method: "eth_sendRawTransaction",
            params: [tx],
          });

        expect(response.body).toStrictEqual({
          id: "42",
          jsonrpc: "2.0",
          result: expect.stringMatching(/^0x[0-9a-fA-F]+$/),
        });
        expect(response.status).toBe(200);
      });

      it("should require an access token when eth_sendRawTransaction is called for a trusted contract", async () => {
        expect.assertions(2);

        // In the unit tests, any wallet can deploy a proxy because the TPR and DIDR mocks always return true
        const signer = ethers.Wallet.createRandom();
        const contractAddress = ethers.Wallet.createRandom().address;

        const data = hre.ethers.AbiCoder.defaultAbiCoder().encode(
          ["string", "string", "address", "bytes32"],
          ["Example", "Value", signer.address, hre.ethers.keccak256("0x")],
        );

        const tx = await signer.signTransaction({
          chainId: "0x7a69",
          data,
          from: signer.address,
          gasLimit: "0x1000000",
          gasPrice: "0x0",
          to: contractAddress,
          value: "0x0",
        });

        const response = await request(server)
          .post("/blockchains/besu")
          .send({
            id: "42",
            jsonrpc: "2.0",
            method: "eth_sendRawTransaction",
            params: [tx],
          });

        expect(response.body).toStrictEqual({
          error: {
            code: -32_600,
            message:
              "The method eth_sendRawTransaction requires an access token.",
          },
          id: "42",
          jsonrpc: "2.0",
        });
        expect(response.status).toBe(200);
      });

      it("should require a valid access token when eth_sendRawTransaction is called for a trusted contract", async () => {
        expect.assertions(2);

        // In the unit tests, any wallet can deploy a proxy because the TPR and DIDR mocks always return true
        const signer = ethers.Wallet.createRandom();
        const contractAddress = ethers.Wallet.createRandom().address;

        const data = hre.ethers.AbiCoder.defaultAbiCoder().encode(
          ["string", "string", "address", "bytes32"],
          ["Example", "Value", signer.address, hre.ethers.keccak256("0x")],
        );

        const tx = await signer.signTransaction({
          chainId: "0x7a69",
          data,
          from: signer.address,
          gasLimit: "0x1000000",
          gasPrice: "0x0",
          to: contractAddress,
          value: "0x0",
        });

        const response = await request(server)
          .post("/blockchains/besu")
          .auth("token", { type: "bearer" })
          .send({
            id: "42",
            jsonrpc: "2.0",
            method: "eth_sendRawTransaction",
            params: [tx],
          });

        expect(response.body).toStrictEqual({
          error: {
            code: -32_600,
            message: "Invalid access token: Invalid JWT",
          },
          id: "42",
          jsonrpc: "2.0",
        });
        expect(response.status).toBe(200);
      });

      it("should require an access token with the correct scope when eth_sendRawTransaction is called for a trusted contract", async () => {
        expect.assertions(2);

        // In the unit tests, any wallet can deploy a proxy because the TPR and DIDR mocks always return true
        const signer = ethers.Wallet.createRandom();
        const contractAddress = ethers.Wallet.createRandom().address;

        const data = hre.ethers.AbiCoder.defaultAbiCoder().encode(
          ["string", "string", "address", "bytes32"],
          ["Example", "Value", signer.address, hre.ethers.keccak256("0x")],
        );

        const tx = await signer.signTransaction({
          chainId: "0x7a69",
          data,
          from: signer.address,
          gasLimit: "0x1000000",
          gasPrice: "0x0",
          to: contractAddress,
          value: "0x0",
        });

        const accessToken = await createAccessToken({
          scp: "tir_write", // wrong scope
          sub: "",
          // missing authorization_details
        });

        const response = await request(server)
          .post("/blockchains/besu")
          .auth(accessToken, { type: "bearer" })
          .send({
            id: "42",
            jsonrpc: "2.0",
            method: "eth_sendRawTransaction",
            params: [tx],
          });

        expect(response.body).toStrictEqual({
          error: {
            code: -32_600,
            message: `Invalid access token:
- Invalid 'authorization_details': Required
- Invalid 'scp': Invalid literal value, expected "openid ledger_invoke"`,
          },
          id: "42",
          jsonrpc: "2.0",
        });
        expect(response.status).toBe(200);
      });

      it("should require an access token with the contract address when eth_sendRawTransaction is called for a trusted contract", async () => {
        expect.assertions(2);

        // In the unit tests, any wallet can deploy a proxy because the TPR and DIDR mocks always return true
        const signer = ethers.Wallet.createRandom();
        const contractAddress = ethers.Wallet.createRandom().address;

        const data = hre.ethers.AbiCoder.defaultAbiCoder().encode(
          ["string", "string", "address", "bytes32"],
          ["Example", "Value", signer.address, hre.ethers.keccak256("0x")],
        );

        const tx = await signer.signTransaction({
          chainId: "0x7a69",
          data,
          from: signer.address,
          gasLimit: "0x1000000",
          gasPrice: "0x0",
          to: contractAddress,
          value: "0x0",
        });

        const accessToken = await createAccessToken({
          authorization_details: {
            addresses: [], // contractAddress is not included
          },
          scp: "openid ledger_invoke",
          sub: "",
        });

        const response = await request(server)
          .post("/blockchains/besu")
          .auth(accessToken, { type: "bearer" })
          .send({
            id: "42",
            jsonrpc: "2.0",
            method: "eth_sendRawTransaction",
            params: [tx],
          });

        expect(response.body).toStrictEqual({
          error: {
            code: -32_600,
            message: `Access to the contract ${contractAddress} is not allowed.`,
          },
          id: "42",
          jsonrpc: "2.0",
        });
        expect(response.status).toBe(200);
      });

      it("should require an access token with a valid sub when eth_sendRawTransaction is called for a trusted contract", async () => {
        expect.assertions(2);

        // In the unit tests, any wallet can deploy a proxy because the TPR and DIDR mocks always return true
        const signer = ethers.Wallet.createRandom();
        const contractAddress = ethers.Wallet.createRandom().address;

        const data = hre.ethers.AbiCoder.defaultAbiCoder().encode(
          ["string", "string", "address", "bytes32"],
          ["Example", "Value", signer.address, hre.ethers.keccak256("0x")],
        );

        const tx = await signer.signTransaction({
          chainId: "0x7a69",
          data,
          from: signer.address,
          gasLimit: "0x1000000",
          gasPrice: "0x0",
          to: contractAddress,
          value: "0x0",
        });

        const accessToken = await createAccessToken({
          authorization_details: {
            addresses: [contractAddress],
          },
          scp: "openid ledger_invoke",
          sub: "", // invalid sub (nor did:ebsi neither did:key)
        });

        const response = await request(server)
          .post("/blockchains/besu")
          .auth(accessToken, { type: "bearer" })
          .send({
            id: "42",
            jsonrpc: "2.0",
            method: "eth_sendRawTransaction",
            params: [tx],
          });

        expect(response.body).toStrictEqual({
          error: {
            code: -32_600,
            message: "Invalid access token: sub  is not valid",
          },
          id: "42",
          jsonrpc: "2.0",
        });
        expect(response.status).toBe(200);
      });

      it("should return an error when the access token sub is an invalid did:key DID", async () => {
        expect.assertions(2);

        // In the unit tests, any wallet can deploy a proxy because the TPR and DIDR mocks always return true
        const signer = ethers.Wallet.createRandom();
        const contractAddress = ethers.Wallet.createRandom().address;

        const data = hre.ethers.AbiCoder.defaultAbiCoder().encode(
          ["string", "string", "address", "bytes32"],
          ["Example", "Value", signer.address, hre.ethers.keccak256("0x")],
        );

        const tx = await signer.signTransaction({
          chainId: "0x7a69",
          data,
          from: signer.address,
          gasLimit: "0x1000000",
          gasPrice: "0x0",
          to: contractAddress,
          value: "0x0",
        });

        const accessToken = await createAccessToken({
          authorization_details: {
            addresses: [contractAddress],
          },
          scp: "openid ledger_invoke",
          sub: "did:key:invalid",
        });

        const response = await request(server)
          .post("/blockchains/besu")
          .auth(accessToken, { type: "bearer" })
          .send({
            id: "42",
            jsonrpc: "2.0",
            method: "eth_sendRawTransaction",
            params: [tx],
          });

        expect(response.body).toStrictEqual({
          error: {
            code: -32_600,
            message: "DID did:key:invalid can't be resolved",
          },
          id: "42",
          jsonrpc: "2.0",
        });
        expect(response.status).toBe(200);
      });

      it("should return an error if the subject DID is a did:key DID referencing an ES256 public key", async () => {
        expect.assertions(2);

        // In the unit tests, any wallet can deploy a proxy because the TPR and DIDR mocks always return true
        const signer = ethers.Wallet.createRandom();
        const signerKey = await generateKeyPair("ES256");
        const signerPublicKeyJwk = await exportJWK(signerKey.publicKey);
        const signerDid = EbsiWallet.createDid(
          "NATURAL_PERSON",
          signerPublicKeyJwk,
        );
        const contractAddress = ethers.Wallet.createRandom().address;

        const data = hre.ethers.AbiCoder.defaultAbiCoder().encode(
          ["string", "string", "address", "bytes32"],
          ["Example", "Value", signer.address, hre.ethers.keccak256("0x")],
        );

        const tx = await signer.signTransaction({
          chainId: "0x7a69",
          data,
          from: signer.address,
          gasLimit: "0x1000000",
          gasPrice: "0x0",
          to: contractAddress,
          value: "0x0",
        });

        const accessToken = await createAccessToken({
          authorization_details: {
            addresses: [contractAddress],
          },
          scp: "openid ledger_invoke",
          sub: signerDid,
        });

        const response = await request(server)
          .post("/blockchains/besu")
          .auth(accessToken, { type: "bearer" })
          .send({
            id: "42",
            jsonrpc: "2.0",
            method: "eth_sendRawTransaction",
            params: [tx],
          });

        expect(response.body).toStrictEqual({
          error: {
            code: -32_600,
            message: `The DID ${signerDid} must use secp256k1 curve. Received: P-256`,
          },
          id: "42",
          jsonrpc: "2.0",
        });
        expect(response.status).toBe(200);
      });

      it("should return an error if the subject DID is a did:key DID referencing a public key that doesn't validate the transaction signature", async () => {
        expect.assertions(2);

        // In the unit tests, any wallet can deploy a proxy because the TPR and DIDR mocks always return true
        const signer = ethers.Wallet.createRandom();
        const signerKey = await generateKeyPair("ES256K");
        const signerPublicKeyJwk = await exportJWK(signerKey.publicKey);
        const signerDid = EbsiWallet.createDid(
          "NATURAL_PERSON",
          signerPublicKeyJwk,
        );
        const contractAddress = ethers.Wallet.createRandom().address;

        const data = hre.ethers.AbiCoder.defaultAbiCoder().encode(
          ["string", "string", "address", "bytes32"],
          ["Example", "Value", signer.address, hre.ethers.keccak256("0x")],
        );

        const tx = await signer.signTransaction({
          chainId: "0x7a69",
          data,
          from: signer.address,
          gasLimit: "0x1000000",
          gasPrice: "0x0",
          to: contractAddress,
          value: "0x0",
        });

        const accessToken = await createAccessToken({
          authorization_details: {
            addresses: [contractAddress],
          },
          scp: "openid ledger_invoke",
          sub: signerDid,
        });

        const response = await request(server)
          .post("/blockchains/besu")
          .auth(accessToken, { type: "bearer" })
          .send({
            id: "42",
            jsonrpc: "2.0",
            method: "eth_sendRawTransaction",
            params: [tx],
          });

        expect(response.body).toStrictEqual({
          error: {
            code: -32_600,
            message: `The transaction signer ${signer.address} is not allowed to call the contract ${contractAddress}.`,
          },
          id: "42",
          jsonrpc: "2.0",
        });
        expect(response.status).toBe(200);
      });

      it("should return an error if Authorisation API /.well-known/openid-configuration endpoint returns an error 500", async () => {
        expect.assertions(2);

        // In the unit tests, any wallet can deploy a proxy because the TPR and DIDR mocks always return true
        const signer = ethers.Wallet.createRandom();
        const signerPublicKeyJwk = encode.publicKey.fromHexToJWK(
          signer.publicKey,
        );
        const signerDid = EbsiWallet.createDid(
          "NATURAL_PERSON",
          signerPublicKeyJwk,
        );
        const contractAddress = ethers.Wallet.createRandom().address;

        const data = hre.ethers.AbiCoder.defaultAbiCoder().encode(
          ["string", "string", "address", "bytes32"],
          ["Example", "Value", signer.address, hre.ethers.keccak256("0x")],
        );

        const tx = await signer.signTransaction({
          chainId: "0x7a69",
          data,
          from: signer.address,
          gasLimit: "0x1000000",
          gasPrice: "0x0",
          to: contractAddress,
          value: "0x0",
        });

        const accessToken = await createAccessToken({
          authorization_details: {
            addresses: [contractAddress],
          },
          scp: "openid ledger_invoke",
          sub: signerDid,
        });

        mockServer.use(
          // Mock Auth API /.well-known/openid-configuration endpoint
          http.get(
            `${authorisationApiUrl}/.well-known/openid-configuration`,
            () => HttpResponse.json({}, { status: 500 }),
          ),
        );

        const response = await request(server)
          .post("/blockchains/besu")
          .auth(accessToken, { type: "bearer" })
          .send({
            id: "42",
            jsonrpc: "2.0",
            method: "eth_sendRawTransaction",
            params: [tx],
          });

        expect(response.body).toStrictEqual({
          error: {
            code: -32_603,
            message: "Internal error",
          },
          id: "42",
          jsonrpc: "2.0",
        });
        expect(response.status).toBe(200);
      });

      it("should return an error if Authorisation API /jwks endpoint returns an error 500", async () => {
        expect.assertions(2);

        // In the unit tests, any wallet can deploy a proxy because the TPR and DIDR mocks always return true
        const signer = ethers.Wallet.createRandom();
        const signerPublicKeyJwk = encode.publicKey.fromHexToJWK(
          signer.publicKey,
        );
        const signerDid = EbsiWallet.createDid(
          "NATURAL_PERSON",
          signerPublicKeyJwk,
        );
        const contractAddress = ethers.Wallet.createRandom().address;

        const data = hre.ethers.AbiCoder.defaultAbiCoder().encode(
          ["string", "string", "address", "bytes32"],
          ["Example", "Value", signer.address, hre.ethers.keccak256("0x")],
        );

        const tx = await signer.signTransaction({
          chainId: "0x7a69",
          data,
          from: signer.address,
          gasLimit: "0x1000000",
          gasPrice: "0x0",
          to: contractAddress,
          value: "0x0",
        });

        const accessToken = await createAccessToken({
          authorization_details: {
            addresses: [contractAddress],
          },
          scp: "openid ledger_invoke",
          sub: signerDid,
        });

        mockServer.use(
          // Mock Auth API /jwks endpoint
          http.get(`${authorisationApiUrl}/jwks`, () =>
            HttpResponse.json({}, { status: 500 }),
          ),
        );

        const response = await request(server)
          .post("/blockchains/besu")
          .auth(accessToken, { type: "bearer" })
          .send({
            id: "42",
            jsonrpc: "2.0",
            method: "eth_sendRawTransaction",
            params: [tx],
          });

        expect(response.body).toStrictEqual({
          error: {
            code: -32_603,
            message: "Internal error",
          },
          id: "42",
          jsonrpc: "2.0",
        });
        expect(response.status).toBe(200);
      });

      it("should let the transaction pass if the access token is valid (did:key)", async () => {
        expect.assertions(2);

        // In the unit tests, any wallet can deploy a proxy because the TPR and DIDR mocks always return true
        const signer = ethers.Wallet.createRandom();
        const signerPublicKeyJwk = encode.publicKey.fromHexToJWK(
          signer.publicKey,
        );
        const signerDid = EbsiWallet.createDid(
          "NATURAL_PERSON",
          signerPublicKeyJwk,
        );
        const contractAddress = ethers.Wallet.createRandom().address;

        const data = hre.ethers.AbiCoder.defaultAbiCoder().encode(
          ["string", "string", "address", "bytes32"],
          ["Example", "Value", signer.address, hre.ethers.keccak256("0x")],
        );

        const tx = await signer.signTransaction({
          chainId: "0x7a69",
          data,
          from: signer.address,
          gasLimit: "0x1000000",
          gasPrice: "0x0",
          to: contractAddress,
          value: "0x0",
        });

        const accessToken = await createAccessToken({
          authorization_details: {
            addresses: [contractAddress],
          },
          scp: "openid ledger_invoke",
          sub: signerDid,
        });

        const response = await request(server)
          .post("/blockchains/besu")
          .auth(accessToken, { type: "bearer" })
          .send({
            id: "42",
            jsonrpc: "2.0",
            method: "eth_sendRawTransaction",
            params: [tx],
          });

        expect(response.body).toStrictEqual({
          id: "42",
          jsonrpc: "2.0",
          result: expect.stringMatching(/^0x[0-9a-fA-F]+$/),
        });
        expect(response.status).toBe(200);
      });

      it("should return an error if DIDR API responds with an error 500", async () => {
        expect.assertions(2);

        // In the unit tests, any wallet can deploy a proxy because the TPR and DIDR mocks always return true
        const signer = ethers.Wallet.createRandom();
        const signerDid = EbsiWallet.createDid("LEGAL_ENTITY");
        const contractAddress = ethers.Wallet.createRandom().address;

        const data = hre.ethers.AbiCoder.defaultAbiCoder().encode(
          ["string", "string", "address", "bytes32"],
          ["Example", "Value", signer.address, hre.ethers.keccak256("0x")],
        );

        const tx = await signer.signTransaction({
          chainId: "0x7a69",
          data,
          from: signer.address,
          gasLimit: "0x1000000",
          gasPrice: "0x0",
          to: contractAddress,
          value: "0x0",
        });

        const accessToken = await createAccessToken({
          authorization_details: {
            addresses: [contractAddress],
          },
          scp: "openid ledger_invoke",
          sub: signerDid,
        });

        mockServer.use(
          // Mock DIDR API POST /identifiers/{did}/actions endpoint
          http.post(
            escapeDid(`${didRegistryApiUrl}/identifiers/${signerDid}/actions`),
            () => HttpResponse.json({}, { status: 500 }),
          ),
        );

        const response = await request(server)
          .post("/blockchains/besu")
          .auth(accessToken, { type: "bearer" })
          .send({
            id: "42",
            jsonrpc: "2.0",
            method: "eth_sendRawTransaction",
            params: [tx],
          });

        expect(response.body).toStrictEqual({
          error: {
            code: -32_603,
            message: "Internal error",
          },
          id: "42",
          jsonrpc: "2.0",
        });
        expect(response.status).toBe(200);
      });

      it("should return an error if the did:ebsi DID can't be resolved", async () => {
        expect.assertions(2);

        // In the unit tests, any wallet can deploy a proxy because the TPR and DIDR mocks always return true
        const signer = ethers.Wallet.createRandom();
        const signerDid = EbsiWallet.createDid("LEGAL_ENTITY");
        const contractAddress = ethers.Wallet.createRandom().address;

        const data = hre.ethers.AbiCoder.defaultAbiCoder().encode(
          ["string", "string", "address", "bytes32"],
          ["Example", "Value", signer.address, hre.ethers.keccak256("0x")],
        );

        const tx = await signer.signTransaction({
          chainId: "0x7a69",
          data,
          from: signer.address,
          gasLimit: "0x1000000",
          gasPrice: "0x0",
          to: contractAddress,
          value: "0x0",
        });

        const accessToken = await createAccessToken({
          authorization_details: {
            addresses: [contractAddress],
          },
          scp: "openid ledger_invoke",
          sub: signerDid,
        });

        mockServer.use(
          // Mock DIDR API POST /identifiers/{did}/actions endpoint
          http.post(
            escapeDid(`${didRegistryApiUrl}/identifiers/${signerDid}/actions`),
            () =>
              HttpResponse.json(
                {
                  error: {
                    code: -32_600,
                    message: "did doesn't exist",
                  },
                  jsonrpc: "2.0",
                },
                { status: 400 },
              ),
          ),
        );

        const response = await request(server)
          .post("/blockchains/besu")
          .auth(accessToken, { type: "bearer" })
          .send({
            id: "42",
            jsonrpc: "2.0",
            method: "eth_sendRawTransaction",
            params: [tx],
          });

        expect(response.body).toStrictEqual({
          error: {
            code: -32_600,
            message: `The DID ${signerDid} does not exist`,
          },
          id: "42",
          jsonrpc: "2.0",
        });
        expect(response.status).toBe(200);
      });

      it("should return an error if the did:ebsi DID is not controlled by the transaction signer", async () => {
        expect.assertions(2);

        // In the unit tests, any wallet can deploy a proxy because the TPR and DIDR mocks always return true
        const signer = ethers.Wallet.createRandom();
        const signerDid = EbsiWallet.createDid("LEGAL_ENTITY");
        const contractAddress = ethers.Wallet.createRandom().address;

        const data = hre.ethers.AbiCoder.defaultAbiCoder().encode(
          ["string", "string", "address", "bytes32"],
          ["Example", "Value", signer.address, hre.ethers.keccak256("0x")],
        );

        const tx = await signer.signTransaction({
          chainId: "0x7a69",
          data,
          from: signer.address,
          gasLimit: "0x1000000",
          gasPrice: "0x0",
          to: contractAddress,
          value: "0x0",
        });

        const accessToken = await createAccessToken({
          authorization_details: {
            addresses: [contractAddress],
          },
          scp: "openid ledger_invoke",
          sub: signerDid,
        });

        mockServer.use(
          // Mock DIDR API POST /identifiers/{did}/actions endpoint
          http.post(
            escapeDid(`${didRegistryApiUrl}/identifiers/${signerDid}/actions`),
            () =>
              HttpResponse.json(
                {
                  jsonrpc: "2.0",
                  result: false,
                },
                { status: 200 },
              ),
          ),
        );

        const response = await request(server)
          .post("/blockchains/besu")
          .auth(accessToken, { type: "bearer" })
          .send({
            id: "42",
            jsonrpc: "2.0",
            method: "eth_sendRawTransaction",
            params: [tx],
          });

        expect(response.body).toStrictEqual({
          error: {
            code: -32_600,
            message: `The DID ${signerDid} is not controlled by the address ${signer.address}`,
          },
          id: "42",
          jsonrpc: "2.0",
        });
        expect(response.status).toBe(200);
      });

      it("should let the transaction pass if the access token is valid (did:ebsi)", async () => {
        expect.assertions(2);

        // In the unit tests, any wallet can deploy a proxy because the TPR and DIDR mocks always return true
        const signer = ethers.Wallet.createRandom();
        const signerDid = EbsiWallet.createDid("LEGAL_ENTITY");
        const contractAddress = ethers.Wallet.createRandom().address;

        const data = hre.ethers.AbiCoder.defaultAbiCoder().encode(
          ["string", "string", "address", "bytes32"],
          ["Example", "Value", signer.address, hre.ethers.keccak256("0x")],
        );

        const tx = await signer.signTransaction({
          chainId: "0x7a69",
          data,
          from: signer.address,
          gasLimit: "0x1000000",
          gasPrice: "0x0",
          to: contractAddress,
          value: "0x0",
        });

        const accessToken = await createAccessToken({
          authorization_details: {
            addresses: [contractAddress],
          },
          scp: "openid ledger_invoke",
          sub: signerDid,
        });

        mockServer.use(
          // Mock DIDR API POST /identifiers/{did}/actions endpoint
          http.post(
            escapeDid(`${didRegistryApiUrl}/identifiers/${signerDid}/actions`),
            () =>
              HttpResponse.json(
                {
                  jsonrpc: "2.0",
                  result: true,
                },
                { status: 200 },
              ),
          ),
        );

        const response = await request(server)
          .post("/blockchains/besu")
          .auth(accessToken, { type: "bearer" })
          .send({
            id: "42",
            jsonrpc: "2.0",
            method: "eth_sendRawTransaction",
            params: [tx],
          });

        expect(response.body).toStrictEqual({
          id: "42",
          jsonrpc: "2.0",
          result: expect.stringMatching(/^0x[0-9a-fA-F]+$/),
        });
        expect(response.status).toBe(200);
      });
    },
  );
});
