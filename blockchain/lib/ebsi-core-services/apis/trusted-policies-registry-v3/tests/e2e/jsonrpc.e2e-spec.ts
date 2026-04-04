import type { PaginatedList } from "@ebsiint-api/shared";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { RawServerDefault } from "fastify";

import { prefixWith0x, waitToBeMined } from "@ebsiint-api/shared";
import { hexToBytes } from "@europeum-ebsi/did-jwt";
import { ConfigService } from "@nestjs/config";
import { ethers } from "ethers";
import crypto from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { ApiConfig } from "../../src/config/configuration.ts";
import type { JsonRpcResponseObject } from "../../src/modules/jsonrpc/jsonrpc.interface.ts";
import type {
  ActivatePolicySchema,
  DeactivatePolicySchema,
  DeleteUserAttributeSchema,
  InsertPolicySchema,
  InsertUserAttributesSchema,
  UnsignedTransaction,
  UpdatePolicySchema,
} from "../../src/modules/jsonrpc/validators/index.ts";
import type {
  PolicyLink,
  PolicyResponseObject,
} from "../../src/modules/policies/policies.interface.ts";

import { AppModule } from "../../src/app.module.ts";
import { formatEthersUnsignedTransaction } from "../../src/modules/jsonrpc/jsonrpc.utils.ts";
import { getNestFastifyApplication } from "../utils/app.ts";
import { createPolicy } from "../utils/data.ts";
import { getTprWriteAccessToken } from "../utils/getAccessToken.ts";
import { getEbsiIssuer } from "../utils/getEbsiIssuer.ts";
import { getServer } from "../utils/getServer.ts";
import { describeWriteOps, writeOps } from "../utils/writeOps.ts";

type JsonRpcParams =
  | ActivatePolicySchema
  | DeactivatePolicySchema
  | DeleteUserAttributeSchema
  | InsertPolicySchema
  | InsertUserAttributesSchema
  | UpdatePolicySchema;

interface SupertestJsonRpcResponse {
  body: JsonRpcResponseObject;
  status: number;
}

interface SupertestPoliciesResponse {
  body: PaginatedList<PolicyLink>;
  status: number;
}

interface SupertestPolicyResponse {
  body: PolicyResponseObject;
  status: number;
}

describe("TPR API v3 - JSON RPC (e2e)", () => {
  let app: NestFastifyApplication;
  let server: RawServerDefault | string;
  let configService: ConfigService<ApiConfig, true>;
  let ledgerApi: string;
  let adminTestWallet: ethers.Wallet;
  let testAdminAccessToken: string;
  let testUserAccessToken: string;
  let sampleTransaction: string;
  let blockscout: {
    bearerToken: string | undefined;
    url: string | undefined;
  };

  const pName = `test-${crypto.randomBytes(5).toString("hex")}`;
  const policy1 = createPolicy(1, pName);
  const policy2 = createPolicy(1, pName);
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

    if (writeOps()) {
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

      const testUserPrivateKeyHex = configService.get("testUserPrivateKey", {
        infer: true,
      });
      const testUserKid = configService.get("testUserKid", { infer: true });
      const testUserDid = testUserKid.split("#")[0]!;
      const testUserIssuerInfo = await getEbsiIssuer(
        hexToBytes(testUserPrivateKeyHex),
        testUserDid,
        testUserKid,
      );

      const authorisationApiUrl = configService.get("authorisationApiUrl", {
        infer: true,
      });

      try {
        testUserAccessToken = await getTprWriteAccessToken(
          authorisationApiUrl,
          testUserIssuerInfo,
          ebsiEnvConfig,
        );

        testAdminAccessToken = await getTprWriteAccessToken(
          authorisationApiUrl,
          adminIssuerInfo,
          ebsiEnvConfig,
        );
      } catch (error) {
        console.error(error);
        throw error;
      }
    }

    blockscout = configService.get("blockscout", { infer: true });
  });

  afterAll(async () => {
    await app.close();
  });

  describeWriteOps()("/jsonrpc", () => {
    // policy id to test "activate" and "deactivate"
    let policyA: PolicyResponseObject;
    beforeAll(async () => {
      let getPoliciesResponse: SupertestPoliciesResponse =
        await request(server).get("/policies");
      const { last } = getPoliciesResponse.body.links!;
      getPoliciesResponse = await request(server).get(
        `/policies${last.slice(last.indexOf("?"))}`,
      );
      if (getPoliciesResponse.body.items.length === 1) {
        const { prev } = getPoliciesResponse.body.links!;
        getPoliciesResponse = await request(server).get(
          `/policies${prev.slice(last.indexOf("?"))}`,
        );
      }
      const name = getPoliciesResponse.body.items.at(-2)!.policyName;
      const policyResponse: SupertestPolicyResponse = await request(server).get(
        `/policies/${name}`,
      );
      policyA = policyResponse.body;
    });

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

    it("should reject a POST with an invalid access token", async () => {
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

    it("should throw Bad Request for a bad JSON-RPC call", async () => {
      expect.assertions(2);

      const response = await request(server)
        .post("/jsonrpc")
        .auth(testAdminAccessToken, { type: "bearer" })
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

    it("should throw an Invalid Request error for bad method", async () => {
      expect.assertions(2);

      const response = await request(server)
        .post("/jsonrpc")
        .auth(testAdminAccessToken, { type: "bearer" })
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

    it("should throw an error if the signer doesn't control the DID", async () => {
      expect.assertions(4);

      const signer = ethers.Wallet.createRandom();

      const { description, policyName } = policy1;
      const param = {
        description,
        from: signer.address,
        policyName,
      } satisfies InsertPolicySchema;

      const responseBuild: SupertestJsonRpcResponse = await request(server)
        .post("/jsonrpc")
        .auth(testAdminAccessToken, { type: "bearer" })
        .send({
          id: 231,
          jsonrpc: "2.0",
          method: "insertPolicy",
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
        .auth(testAdminAccessToken, { type: "bearer" })
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
            configService.get("testAdminKid", { infer: true }).split("#")[0]
          } is not controlled by the address ${signer.address}`,
        },
        id: "45",
        jsonrpc: "2.0",
      });
      expect(responseSend.status).toBe(400);
    });

    it("should throw an error if the wallet doesn't have the role OPERATOR_ROLE 0x97667070c54ef182b0f5858b034beac1b6f3089aa2d3188bb1e8929f4fa9b929", async () => {
      expect.assertions(3);

      const signer = new ethers.Wallet(configService.get("testUserPrivateKey"));

      const { description, policyName } = policy1;
      const param = {
        description,
        from: signer.address,
        policyName,
      } satisfies InsertPolicySchema;

      const responseBuild: SupertestJsonRpcResponse = await request(server)
        .post("/jsonrpc")
        .auth(testUserAccessToken, { type: "bearer" })
        .send({
          id: 231,
          jsonrpc: "2.0",
          method: "insertPolicy",
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

      const responseSend: SupertestJsonRpcResponse = await request(server)
        .post("/jsonrpc")
        .auth(testUserAccessToken, { type: "bearer" })
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

      // Wait to be mined
      const receipt = await waitToBeMined(
        ledgerApi,
        responseSend.body.result as string,
      );

      // The transaction should have failed
      expect(receipt.status).toBe("0x0");
    });

    // Tests to be repeated for every method
    describe.each([
      "insertPolicy",
      "updatePolicy",
      "deactivatePolicy",
      "activatePolicy",
      "insertUserAttributes",
      "deleteUserAttribute",
    ])("/jsonrpc with method %s", (method: string) => {
      describeWriteOps()("(test writing data on the ledger)", () => {
        it("should return a valid unsigned transaction that we can sign and send to sendSignedTransaction", async () => {
          expect.assertions(7);

          let param: JsonRpcParams;

          // Get number of existing policies
          const response: SupertestPoliciesResponse =
            await request(server).get("/policies");
          // Update last policy
          const lastPolicyId = `${response.body.total}`;

          // Use test account, as defined in hardhat.config.ts
          const signer = adminTestWallet;

          switch (method) {
            case "activatePolicy": {
              param = {
                from: signer.address,
                policyName: policyA.policyName,
              } satisfies ActivatePolicySchema;
              break;
            }
            case "deactivatePolicy": {
              param = {
                from: signer.address,
                policyName: policyA.policyName,
              } satisfies DeactivatePolicySchema;
              break;
            }
            case "deleteUserAttribute": {
              param = {
                attribute: "other-attribute",
                from: signer.address,
                user: userAddress,
              } satisfies DeleteUserAttributeSchema;
              break;
            }
            case "insertPolicy": {
              const { description, policyName } = policy1;
              param = {
                description,
                from: signer.address,
                policyName,
              } satisfies InsertPolicySchema;
              break;
            }
            case "insertUserAttributes": {
              param = {
                attributes: [pName, "other-attribute"],
                from: signer.address,
                user: userAddress,
              } satisfies InsertUserAttributesSchema;
              break;
            }
            case "updatePolicy": {
              const { description, policyName } = policy2;
              param = {
                description,
                from: signer.address,
                policyName,
              } satisfies UpdatePolicySchema;
              break;
            }
            default: {
              throw new Error(`Test Error: Invalid method ${method}`);
            }
          }

          const responseBuild: SupertestJsonRpcResponse = await request(server)
            .post("/jsonrpc")
            .auth(testAdminAccessToken, { type: "bearer" })
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

          const responseSend: SupertestJsonRpcResponse = await request(server)
            .post("/jsonrpc")
            .auth(testAdminAccessToken, { type: "bearer" })
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

          // Wait to be mined
          const receipt = await waitToBeMined(
            ledgerApi,
            responseSend.body.result as string,
          );
          expect(receipt.status).toBe("0x1");
          sampleTransaction = responseSend.body.result as string;

          // Check if policy has been inserted/updated correctly
          let expectedResponseBody: unknown;
          let actualResponse: SupertestPoliciesResponse;

          switch (method) {
            case "activatePolicy": {
              // Expected response
              expectedResponseBody = policyA;

              // Actual response
              actualResponse = await request(server).get(
                `/policies/${policyA.policyName}`,
              );

              break;
            }
            case "deactivatePolicy": {
              // Expected response
              expectedResponseBody = {
                ...policyA,
                status: false,
              } as PolicyResponseObject;

              // Actual response
              actualResponse = await request(server).get(
                `/policies/${policyA.policyName}`,
              );

              break;
            }
            case "deleteUserAttribute": {
              expectedResponseBody = {
                attributes: [pName],
                user: userAddress,
              };
              actualResponse = await request(server).get(
                `/users/${userAddress}`,
              );
              break;
            }
            case "insertPolicy": {
              const { description, policyName } = policy1;

              // Get number of existing policies
              const getPoliciesResponse: SupertestPoliciesResponse =
                await request(server).get("/policies");

              const policyId = `${getPoliciesResponse.body.total}`;

              // Expected response
              expectedResponseBody = {
                description,
                policyId: `${policyId}`,
                policyName,
                status: true,
              } as PolicyResponseObject;

              // Actual response
              actualResponse = await request(server).get(
                `/policies/${policyName}`,
              );

              break;
            }
            case "insertUserAttributes": {
              expectedResponseBody = {
                attributes: [pName, "other-attribute"],
                user: userAddress,
              };
              actualResponse = await request(server).get(
                `/users/${userAddress}`,
              );
              break;
            }
            case "updatePolicy": {
              const { description, policyName } = policy2;

              // Expected response
              expectedResponseBody = {
                description,
                policyId: `${lastPolicyId}`,
                policyName,
                status: true,
              } as PolicyResponseObject;

              // Actual response
              actualResponse = await request(server).get(
                `/policies/${policyName}`,
              );

              break;
            }
            default: {
              break;
            }
          }

          expect(actualResponse!.body).toStrictEqual(expectedResponseBody);
          expect(actualResponse!.status).toBe(200);
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
      });

      it("should accept a request without id", async () => {
        expect.assertions(2);

        const signer = adminTestWallet;

        let param: JsonRpcParams;

        switch (method) {
          case "activatePolicy": {
            const { policyName } = policy1;
            param = {
              from: signer.address,
              policyName,
            } satisfies ActivatePolicySchema;
            break;
          }
          case "deactivatePolicy": {
            const { policyName } = policy1;
            param = {
              from: signer.address,
              policyName,
            } satisfies DeactivatePolicySchema;
            break;
          }
          case "deleteUserAttribute": {
            param = {
              attribute: pName,
              from: signer.address,
              user: userAddress,
            } satisfies DeleteUserAttributeSchema;
            break;
          }
          case "insertPolicy": {
            const { description, policyName } = policy1;
            param = {
              description,
              from: signer.address,
              policyName,
            } satisfies InsertPolicySchema;
            break;
          }
          case "insertUserAttributes": {
            param = {
              attributes: [pName],
              from: signer.address,
              user: userAddress,
            } satisfies InsertUserAttributesSchema;
            break;
          }
          case "updatePolicy": {
            const { description, policyName } = policy2;
            param = {
              description,
              from: signer.address,
              policyName,
            } satisfies UpdatePolicySchema;
            break;
          }
          default: {
            throw new Error(`Test Error: Invalid method ${method}`);
          }
        }

        const responseBuild = await request(server)
          .post("/jsonrpc")
          .auth(testAdminAccessToken, { type: "bearer" })
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

        const params: JsonRpcParams[] = [];
        const expectedErrorMessages: string[] = [];

        switch (method) {
          case "activatePolicy": {
            params.push({
              from: signer.address,
              policyId: "test",
            } satisfies ActivatePolicySchema);

            expectedErrorMessages.push(
              "Invalid 'params.0.policyId': Not an integer string",
            );

            break;
          }
          case "deactivatePolicy": {
            params.push({
              from: signer.address,
              policyId: "test",
            } satisfies DeactivatePolicySchema);

            expectedErrorMessages.push(
              "Invalid 'params.0.policyId': Not an integer string",
            );

            break;
          }
          case "deleteUserAttribute": {
            params.push({
              attribute: pName,
              from: signer.address,
              user: "0x123",
            } satisfies DeleteUserAttributeSchema);

            expectedErrorMessages.push(
              "Invalid 'params.0.user': Invalid Ethereum address",
            );

            break;
          }
          case "insertPolicy": {
            params.push({
              // policyName: policy1.policyName, <- missing policyName
              description: policy1.description,
              from: signer.address,
            } as InsertPolicySchema);

            expectedErrorMessages.push(
              "Invalid 'params.0.policyName': Required",
            );

            params.push({
              description: policy2.description,
              from: "bad address",
              policyName: policy2.policyName,
            } satisfies InsertPolicySchema);

            expectedErrorMessages.push(
              "Invalid 'params.0.from': Invalid Ethereum address",
            );

            break;
          }
          case "insertUserAttributes": {
            params.push({
              attributes: [pName],
              from: signer.address,
              user: "0x123",
            } satisfies InsertUserAttributesSchema);

            expectedErrorMessages.push(
              "Invalid 'params.0.user': Invalid Ethereum address",
            );

            break;
          }
          case "updatePolicy": {
            params.push({
              description: policy1.description, // <- missing description
              from: signer.address,
              policyName: 40,
            } as unknown as UpdatePolicySchema);

            expectedErrorMessages.push(
              "Invalid 'params.0.policyName': Expected string, received number",
            );

            params.push({
              description: 15, // Invalid description
              from: signer.address,
              policyName: policy2.policyName,
            } as unknown as UpdatePolicySchema);

            expectedErrorMessages.push(
              "Invalid 'params.0.description': Expected string, received number",
            );

            params.push({
              description: policy2.description,
              from: signer.address,
              policyId: "test",
            } satisfies UpdatePolicySchema);

            expectedErrorMessages.push(
              "Invalid 'params.0.policyId': Not an integer string",
            );

            params.push({
              description: policy2.description,
              from: "bad address",
              policyName: policy2.policyName,
            } satisfies UpdatePolicySchema);

            expectedErrorMessages.push(
              "Invalid 'params.0.from': Invalid Ethereum address",
            );

            break;
          }
          default: {
            throw new Error(`Test Error: Invalid method ${method}`);
          }
        }

        expect.assertions(params.length * 2);

        await Promise.all(
          params.map(async (param, index) => {
            const response1 = await request(server)
              .post("/jsonrpc")
              .auth(testAdminAccessToken, {
                type: "bearer",
              })
              .send({
                id: 231,
                jsonrpc: "2.0",
                method,
                params: [param],
              });

            expect(response1.body).toStrictEqual({
              error: {
                code: -32_600,
                message: expect.stringContaining(expectedErrorMessages[index]!),
              },
              id: 231,
              jsonrpc: "2.0",
            });
            expect(response1.status).toBe(400);
          }),
        );
      });

      it("should throw an error when the unsignedTransaction has been tampered", async () => {
        expect.assertions(6);

        const signer = adminTestWallet;

        let param1: JsonRpcParams;
        let param2: JsonRpcParams;

        switch (method) {
          case "activatePolicy": {
            param1 = {
              from: signer.address,
              policyId: "1",
            } satisfies ActivatePolicySchema;

            param2 = {
              from: signer.address,
              policyId: "2",
            } satisfies ActivatePolicySchema;

            break;
          }
          case "deactivatePolicy": {
            param1 = {
              from: signer.address,
              policyId: "1",
            } satisfies DeactivatePolicySchema;

            param2 = {
              from: signer.address,
              policyId: "2",
            } satisfies DeactivatePolicySchema;

            break;
          }
          case "deleteUserAttribute": {
            param1 = {
              attribute: "name1",
              from: signer.address,
              user: userAddress,
            } satisfies DeleteUserAttributeSchema;

            param2 = {
              attribute: "name2",
              from: signer.address,
              user: userAddress,
            } satisfies DeleteUserAttributeSchema;

            break;
          }
          case "insertPolicy": {
            const { description, policyName } = policy1;

            param1 = {
              description,
              from: signer.address,
              policyName,
            } satisfies InsertPolicySchema;
            param2 = {
              description,
              from: signer.address,
              policyName: "another name",
            } satisfies InsertPolicySchema;
            break;
          }
          case "insertUserAttributes": {
            param1 = {
              attributes: ["name1"],
              from: signer.address,
              user: userAddress,
            } satisfies InsertUserAttributesSchema;

            param2 = {
              attributes: ["name2"],
              from: signer.address,
              user: userAddress,
            } satisfies InsertUserAttributesSchema;

            break;
          }
          case "updatePolicy": {
            const { description } = policy1;

            param1 = {
              description,
              from: signer.address,
              policyId: "1",
            } satisfies UpdatePolicySchema;
            param2 = {
              description,
              from: signer.address,
              policyId: "1",
              policyName: "another name",
            } satisfies UpdatePolicySchema;
            break;
          }
          default: {
            throw new Error(`Test Error: Invalid method ${method}`);
          }
        }

        const responseBuild1: SupertestJsonRpcResponse = await request(server)
          .post("/jsonrpc")
          .auth(testAdminAccessToken, { type: "bearer" })
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
          .auth(testAdminAccessToken, { type: "bearer" })
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
          .auth(testAdminAccessToken, { type: "bearer" })
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
          .auth(testAdminAccessToken, { type: "bearer" })
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
  });
});
