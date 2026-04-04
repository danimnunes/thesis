import type { PaginatedList } from "@ebsiint-api/shared";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { RawServerDefault } from "fastify";

import { prefixWith0x, waitToBeMined } from "@ebsiint-api/shared";
import { hexToBytes } from "@europeum-ebsi/did-jwt";
import { ConfigService } from "@nestjs/config";
import { ethers } from "ethers";
import crypto from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, expect, it } from "vitest";

import type { ApiConfig } from "../../src/config/configuration.ts";
import type { JsonRpcResponseObject } from "../../src/modules/jsonrpc/jsonrpc.interface.ts";
import type {
  DeleteUserAttributeSchema,
  InsertUserAttributesSchema,
  UnsignedTransaction,
} from "../../src/modules/jsonrpc/validators/index.ts";
import type { PolicyLink } from "../../src/modules/policies/policies.interface.ts";

import { AppModule } from "../../src/app.module.ts";
import { formatEthersUnsignedTransaction } from "../../src/modules/jsonrpc/jsonrpc.utils.ts";
import { getNestFastifyApplication } from "../utils/app.ts";
import { getTprWriteAccessToken } from "../utils/getAccessToken.ts";
import { getEbsiIssuer } from "../utils/getEbsiIssuer.ts";
import { getServer } from "../utils/getServer.ts";
import { describeWriteOps } from "../utils/writeOps.ts";

type SupertestJsonRpcResponse = SupertestResponse<JsonRpcResponseObject>;

type SupertestPoliciesResponse = SupertestResponse<PaginatedList<PolicyLink>>;

interface SupertestResponse<T = unknown> {
  body: T;
  status: number;
}

describeWriteOps()("TPR API v3 - User journey (e2e)", () => {
  let app: NestFastifyApplication;
  let server: RawServerDefault | string;
  let configService: ConfigService<ApiConfig, true>;
  let ledgerApi: string;
  let adminTestWallet: ethers.Wallet;
  let testAdminAccessToken: string;

  const policyName = `test-${crypto.randomBytes(5).toString("hex")}`;
  const userAddress = ethers.Wallet.createRandom().address;

  beforeAll(async () => {
    app = await getNestFastifyApplication({
      imports: [AppModule],
    });

    if (process.env.TEST_ENV !== "remote") {
      await app.init();
      const fastifyInstance = app.getHttpAdapter().getInstance();
      await fastifyInstance.ready();
    }

    configService = app.get<ConfigService<ApiConfig, true>>(ConfigService);

    ledgerApi = `${configService.get("ledgerApiUrl", { infer: true })}/blockchains/besu`;

    server = getServer(app, configService);

    const ebsiEnvConfig = configService.get("ebsiEnvConfig", { infer: true });

    const adminPrivateKeyHex = configService.get("testAdminPrivateKey", {
      infer: true,
    });
    adminTestWallet = new ethers.Wallet(prefixWith0x(adminPrivateKeyHex));
    const adminKid = configService.get("testAdminKid", { infer: true });
    const adminDid = adminKid.split("#")[0]!;
    const adminIssuerInfo = await getEbsiIssuer(
      hexToBytes(adminPrivateKeyHex),
      adminDid,
      adminKid,
    );

    const authorisationApiUrl = configService.get("authorisationApiUrl", {
      infer: true,
    });

    try {
      testAdminAccessToken = await getTprWriteAccessToken(
        authorisationApiUrl,
        adminIssuerInfo,
        ebsiEnvConfig,
      );
    } catch (error) {
      console.error(error);
      throw error;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it("should complete without errors", async () => {
    // Check if user/subject doesn't exist
    let actualResponse: SupertestPoliciesResponse;

    actualResponse = await request(server).get(`/users/${userAddress}`);
    expect(actualResponse.body).toStrictEqual({
      detail: `User ${userAddress} not found`,
      status: 404,
      title: "User Not Found",
      type: "about:blank",
    });
    expect(actualResponse.status).toBe(404);

    actualResponse = await request(server).get(`/subjects/${userAddress}`);
    expect(actualResponse.body).toStrictEqual({
      detail: `Subject ${userAddress} not found`,
      status: 404,
      title: "Subject Not Found",
      type: "about:blank",
    });
    expect(actualResponse.status).toBe(404);

    // The admin registers a new user with 1 attribute
    let params: DeleteUserAttributeSchema | InsertUserAttributesSchema = {
      attributes: [policyName],
      from: adminTestWallet.address,
      user: userAddress,
    } satisfies InsertUserAttributesSchema;

    let responseBuild: SupertestJsonRpcResponse = await request(server)
      .post("/jsonrpc")
      .auth(testAdminAccessToken, { type: "bearer" })
      .send({
        id: 231,
        jsonrpc: "2.0",
        method: "insertUserAttributes",
        params: [params],
      });

    expect(responseBuild.body).toStrictEqual({
      id: 231,
      jsonrpc: "2.0",
      result: {
        chainId: expect.any(String),
        data: expect.any(String),
        from: params.from,
        gasLimit: expect.any(String),
        gasPrice: expect.any(String),
        nonce: expect.any(String),
        to: expect.any(String),
        value: "0x0",
      },
    });
    expect(responseBuild.status).toBe(200);

    let unsignedTransaction = responseBuild.body.result;
    let uTx = formatEthersUnsignedTransaction(
      unsignedTransaction as UnsignedTransaction,
    );

    let sgnTx = await adminTestWallet.signTransaction(uTx);
    let signature = ethers.Transaction.from(sgnTx).signature;

    if (!signature) {
      throw new Error("Signature not found");
    }

    let responseSend: SupertestJsonRpcResponse = await request(server)
      .post("/jsonrpc")
      .auth(testAdminAccessToken, { type: "bearer" })
      .send({
        id: "45",
        jsonrpc: "2.0",
        method: "sendSignedTransaction",
        params: [
          {
            protocol: "eth",
            r: signature.r,
            s: signature.s,
            signedRawTransaction: sgnTx,
            unsignedTransaction,
            v: `0x${signature.v.toString(16)}`,
          },
        ],
      });

    expect(responseSend.body).toStrictEqual({
      id: "45",
      jsonrpc: "2.0",
      result: expect.any(String),
    });
    expect(responseSend.status).toBe(200);

    // Wait to be mined
    let receipt = await waitToBeMined(
      ledgerApi,
      responseSend.body.result as string,
    );
    expect(receipt.status).toBe("0x1");

    // Check if attribute has been added
    actualResponse = await request(server).get(`/users/${userAddress}`);
    expect(actualResponse.body).toStrictEqual({
      attributes: [policyName],
      user: userAddress,
    });
    expect(actualResponse.status).toBe(200);

    actualResponse = await request(server).get(`/subjects/${userAddress}`);
    expect(actualResponse.body).toStrictEqual({
      subject: userAddress,
    });
    expect(actualResponse.status).toBe(200);

    actualResponse = await request(server).get(
      `/subjects/${userAddress}/policies`,
    );
    expect(actualResponse.body).toStrictEqual({
      items: [
        {
          href: expect.stringContaining(
            `/subjects/${userAddress}/policies/${policyName}`,
          ),
          policyName,
        },
      ],
      links: {
        first: expect.stringContaining(
          `/subjects/${userAddress}/policies?page[after]=1&page[size]=10`,
        ),
        last: expect.stringContaining(
          `/subjects/${userAddress}/policies?page[after]=1&page[size]=10`,
        ),
        next: expect.stringContaining(
          `/subjects/${userAddress}/policies?page[after]=1&page[size]=10`,
        ),
        prev: expect.stringContaining(
          `/subjects/${userAddress}/policies?page[after]=1&page[size]=10`,
        ),
      },
      pageSize: 10,
      self: expect.stringContaining(
        `/subjects/${userAddress}/policies?page[after]=1&page[size]=10`,
      ),
      total: 1,
    });
    expect(actualResponse.status).toBe(200);

    actualResponse = await request(server).get(
      `/subjects/${userAddress}/policies/${policyName}`,
    );
    expect(actualResponse.body).toStrictEqual({
      policyName,
      subject: userAddress,
    });
    expect(actualResponse.status).toBe(200);

    // The admin removes the attribute
    params = {
      attribute: policyName,
      from: adminTestWallet.address,
      user: userAddress,
    } satisfies DeleteUserAttributeSchema;

    responseBuild = await request(server)
      .post("/jsonrpc")
      .auth(testAdminAccessToken, { type: "bearer" })
      .send({
        id: 231,
        jsonrpc: "2.0",
        method: "deleteUserAttribute",
        params: [params],
      });

    expect(responseBuild.body).toStrictEqual({
      id: 231,
      jsonrpc: "2.0",
      result: {
        chainId: expect.any(String),
        data: expect.any(String),
        from: params.from,
        gasLimit: expect.any(String),
        gasPrice: expect.any(String),
        nonce: expect.any(String),
        to: expect.any(String),
        value: "0x0",
      },
    });
    expect(responseBuild.status).toBe(200);

    unsignedTransaction = responseBuild.body.result;
    uTx = formatEthersUnsignedTransaction(
      unsignedTransaction as UnsignedTransaction,
    );

    sgnTx = await adminTestWallet.signTransaction(uTx);
    signature = ethers.Transaction.from(sgnTx).signature;
    if (!signature) {
      throw new Error("Signature not found");
    }

    responseSend = await request(server)
      .post("/jsonrpc")
      .auth(testAdminAccessToken, { type: "bearer" })
      .send({
        id: "45",
        jsonrpc: "2.0",
        method: "sendSignedTransaction",
        params: [
          {
            protocol: "eth",
            r: signature.r,
            s: signature.s,
            signedRawTransaction: sgnTx,
            unsignedTransaction,
            v: `0x${signature.v.toString(16)}`,
          },
        ],
      });

    expect(responseSend.body).toStrictEqual({
      id: "45",
      jsonrpc: "2.0",
      result: expect.any(String),
    });
    expect(responseSend.status).toBe(200);

    // Wait to be mined
    receipt = await waitToBeMined(
      ledgerApi,
      responseSend.body.result as string,
    );
    expect(receipt.status).toBe("0x1");

    // Check if the attribute has been removed correctly
    actualResponse = await request(server).get(`/users/${userAddress}`);
    expect(actualResponse.body).toStrictEqual({
      attributes: [],
      user: userAddress,
    });
    expect(actualResponse.status).toBe(200);

    actualResponse = await request(server).get(`/subjects/${userAddress}`);
    expect(actualResponse.body).toStrictEqual({
      subject: userAddress,
    });
    expect(actualResponse.status).toBe(200);

    actualResponse = await request(server).get(
      `/subjects/${userAddress}/policies`,
    );
    expect(actualResponse.body).toStrictEqual({
      items: [],
      links: {
        first: expect.stringContaining(
          `/subjects/${userAddress}/policies?page[after]=1&page[size]=10`,
        ),
        last: expect.stringContaining(
          `/subjects/${userAddress}/policies?page[after]=1&page[size]=10`,
        ),
        next: expect.stringContaining(
          `/subjects/${userAddress}/policies?page[after]=1&page[size]=10`,
        ),
        prev: expect.stringContaining(
          `/subjects/${userAddress}/policies?page[after]=1&page[size]=10`,
        ),
      },
      pageSize: 10,
      self: expect.stringContaining(
        `/subjects/${userAddress}/policies?page[after]=1&page[size]=10`,
      ),
      total: 0,
    });
    expect(actualResponse.status).toBe(200);

    actualResponse = await request(server).get(
      `/subjects/${userAddress}/policies/${policyName}`,
    );
    expect(actualResponse.body).toStrictEqual({
      detail: `Subject ${userAddress} doesn't have the policy ${policyName}`,
      status: 404,
      title: "Subject Policy Not Found",
      type: "about:blank",
    });
    expect(actualResponse.status).toBe(404);
  });
});
