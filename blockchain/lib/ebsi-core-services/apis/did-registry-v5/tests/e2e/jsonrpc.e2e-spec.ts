import type { EbsiIssuer } from "@europeum-ebsi/verifiable-credential";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { RawServerDefault } from "fastify";
import type { JWK } from "jose";

import { waitToBeMined } from "@ebsiint-api/shared";
import { ConfigService } from "@nestjs/config";
import { ethers } from "ethers";
import { calculateJwkThumbprint, exportJWK, generateKeyPair } from "jose";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { ApiConfig } from "../../src/config/configuration.ts";
import type { JsonRpcResponseObject } from "../../src/modules/jsonrpc/jsonrpc.interface.ts";
import type { AddControllerSchema } from "../../src/modules/jsonrpc/validators/RequestAddControllerSchema.ts";
import type { AddServiceSchema } from "../../src/modules/jsonrpc/validators/RequestAddServiceSchema.ts";
import type { AddVerificationMethodSchema } from "../../src/modules/jsonrpc/validators/RequestAddVerificationMethodSchema.ts";
import type { AddVerificationRelationshipSchema } from "../../src/modules/jsonrpc/validators/RequestAddVerificationRelationshipSchema.ts";
import type { ExpireVerificationMethodSchema } from "../../src/modules/jsonrpc/validators/RequestExpireVerificationMethodSchema.ts";
import type { InsertDidDocumentSchema } from "../../src/modules/jsonrpc/validators/RequestInsertDidDocumentSchema.ts";
import type { RevokeControllerSchema } from "../../src/modules/jsonrpc/validators/RequestRevokeControllerSchema.ts";
import type { RevokeServiceSchema } from "../../src/modules/jsonrpc/validators/RequestRevokeServiceSchema.ts";
import type { RevokeVerificationMethodSchema } from "../../src/modules/jsonrpc/validators/RequestRevokeVerificationMethodSchema.ts";
import type { RollVerificationMethodSchema } from "../../src/modules/jsonrpc/validators/RequestRollVerificationMethodSchema.ts";
import type { UnsignedTransaction } from "../../src/modules/jsonrpc/validators/RequestSendSignedTransactionSchema.ts";
import type { UpdateBaseDocumentSchema } from "../../src/modules/jsonrpc/validators/RequestUpdateBaseDocumentSchema.ts";

import { AppModule } from "../../src/app.module.ts";
import { DEV_DEPENDENCIES } from "../../src/config/configuration.ts";
import { formatEthersUnsignedTransaction } from "../../src/modules/jsonrpc/jsonrpc.utils.ts";
import { getNestFastifyApplication } from "../utils/app.ts";
import { createUser } from "../utils/data.ts";
import { describeWriteOps } from "../utils/describeWriteOps.ts";
import {
  getDidrInviteAccessToken,
  getDidrWriteAccessToken,
} from "../utils/getAccessToken.ts";
import { getServer } from "../utils/getServer.ts";

type JsonRpcParams =
  | AddControllerSchema
  | AddServiceSchema
  | AddVerificationMethodSchema
  | AddVerificationRelationshipSchema
  | ExpireVerificationMethodSchema
  | InsertDidDocumentSchema
  | RevokeControllerSchema
  | RevokeServiceSchema
  | RevokeVerificationMethodSchema
  | RollVerificationMethodSchema
  | UpdateBaseDocumentSchema;

interface SupertestJsonRpcResponse {
  body: JsonRpcResponseObject;
  status: number;
}

interface TestUser {
  info: EbsiIssuer;
  thumbprint: string;
  token: string;
  wallet: ethers.BaseWallet;
}

describeWriteOps()("DID Registry API v5 - JSON-RPC (e2e)", () => {
  let app: NestFastifyApplication;
  let server: RawServerDefault | string;
  let configService: ConfigService<ApiConfig, true>;
  let ledgerApi: string;
  const now = Math.floor(Date.now() / 1000);
  const in6months = now + 6 * 30 * 24 * 3600;
  let user: TestUser;
  let lastDid: string;

  beforeAll(async () => {
    app = await getNestFastifyApplication({
      imports: [AppModule],
    });

    configService = app.get<ConfigService<ApiConfig, true>>(ConfigService);

    if (process.env.TEST_ENV !== "remote") {
      await app.init();
      await app.getHttpAdapter().getInstance().ready();
    }

    server = getServer(app, configService);

    ledgerApi = `${configService.get("domain", { infer: true })}/ledger/${DEV_DEPENDENCIES.ledger}/blockchains/besu`;

    // Get last identifier
    const getAllIdentifiers = await request(server).get("/identifiers");
    const { total } = getAllIdentifiers.body as {
      total: number;
    };
    const getIdentifiersLastPage = await request(server).get(
      `/identifiers?page[after]=${Math.ceil(total / 10)}&page[size]=10`,
    );
    const { items: identifiers } = getIdentifiersLastPage.body as {
      items: {
        did: string;
        href: string;
      }[];
    };
    lastDid = identifiers.at(-1)!.did;
  });

  afterAll(async () => {
    await app.close();
  });

  describe("registering a new DID document", () => {
    beforeAll(async () => {
      // Create new user
      const userDetails = await createUser();

      const authApiV3ES256PrivateKey = configService.get(
        "testAuthApiV4ES256PrivateKey",
        { infer: true },
      );

      const userAccessToken = await getDidrInviteAccessToken(
        userDetails.did,
        authApiV3ES256PrivateKey,
      );

      user = {
        info: userDetails,
        thumbprint: userDetails.thumbprint,
        token: userAccessToken,
        wallet: userDetails.wallet,
      };
    });

    describe("/jsonrpc - send transaction for insertDidDocument", () => {
      it("should work", async () => {
        expect.assertions(5);

        const params = {
          baseDocument: JSON.stringify({
            "@context": [
              "https://www.w3.org/ns/did/v1",
              "https://w3id.org/security/suites/jws-2020/v1", // Required
            ],
          }),
          did: user.info.did,
          from: user.wallet.address,
          isSecp256k1: true,
          notAfter: in6months,
          notBefore: now,
          publicKey: user.wallet.signingKey.publicKey,
          vMethodId: user.thumbprint,
        } satisfies InsertDidDocumentSchema;

        const responseBuild: SupertestJsonRpcResponse = await request(server)
          .post("/jsonrpc")
          .auth(user.token, { type: "bearer" })
          .send({
            id: 1,
            jsonrpc: "2.0",
            method: "insertDidDocument",
            params: [params],
          });

        expect(responseBuild.body).toStrictEqual({
          id: 1,
          jsonrpc: "2.0",
          result: {
            chainId: expect.any(String),
            data: expect.any(String),
            from: user.wallet.address,
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
          unsignedTransaction as UnsignedTransaction,
        );

        const sgnTx = await user.wallet.signTransaction(uTx);
        const signature = ethers.Transaction.from(sgnTx).signature;
        if (!signature) {
          throw new Error("Signature not found");
        }
        const { r, s, v } = signature;

        const responseSend: SupertestJsonRpcResponse = await request(server)
          .post("/jsonrpc")
          .auth(user.token, { type: "bearer" })
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
    });
  });

  describe("updating the new DID document", () => {
    let publicKeyJwk2: JWK;
    let thumbprint2: string;
    let publicKeyJwk3: JWK;
    let thumbprint3: string;

    beforeAll(async () => {
      try {
        const ebsiEnvConfig = configService.get("ebsiEnvConfig", {
          infer: true,
        });
        const didrWriteToken = await getDidrWriteAccessToken(
          configService.get("authorisationApiUrl", { infer: true }),
          user.info,
          ebsiEnvConfig,
        );
        user.token = didrWriteToken;
      } catch (error) {
        console.error(error);
        throw error;
      }

      const keyPair2 = await generateKeyPair("EdDSA", { crv: "Ed25519" });
      publicKeyJwk2 = await exportJWK(keyPair2.publicKey);
      thumbprint2 = await calculateJwkThumbprint(publicKeyJwk2);

      const keyPair3 = await generateKeyPair("ES256");
      publicKeyJwk3 = await exportJWK(keyPair3.publicKey);
      thumbprint3 = await calculateJwkThumbprint(publicKeyJwk3);
    });

    describe.each([
      "updateBaseDocument",
      "addController",
      "revokeController",
      "addVerificationMethod",
      "addVerificationRelationship",
      "expireVerificationMethod",
      "revokeVerificationMethod",
      "rollVerificationMethod",
      "addService",
      "revokeService",
    ] as const)("/jsonrpc - send transaction for %s", (method) => {
      it("should work", async () => {
        expect.assertions(5);

        let params: JsonRpcParams;

        switch (method) {
          case "addController": {
            // it is already a controller
            params = {
              controller: lastDid,
              did: user.info.did,
              from: user.wallet.address,
            } satisfies AddControllerSchema;
            break;
          }
          case "addService": {
            params = {
              did: user.info.did,
              from: user.wallet.address,
              service: JSON.stringify({
                id: "1",
                serviceEndpoint: {
                  byId: "/vc/{id}",
                  byType: "/type/{type}",
                  registries: [
                    "https://registry.example.com/{credentialSubject.id}",
                    "https://identity.foundation/vcs/{credentialSubject.id}",
                  ],
                },
                type: "CredentialRegistry",
              }),
            } satisfies AddServiceSchema;
            break;
          }
          case "addVerificationMethod": {
            params = {
              did: user.info.did,
              from: user.wallet.address,
              isSecp256k1: false,
              publicKey: `0x${Buffer.from(
                JSON.stringify(publicKeyJwk2),
              ).toString("hex")}`,
              vMethodId: thumbprint2,
            } satisfies AddVerificationMethodSchema;
            break;
          }
          case "addVerificationRelationship": {
            params = {
              did: user.info.did,
              from: user.wallet.address,
              name: "assertionMethod",
              notAfter: in6months,
              notBefore: now,
              vMethodId: thumbprint2,
            } satisfies AddVerificationRelationshipSchema;
            break;
          }
          case "expireVerificationMethod": {
            params = {
              did: user.info.did,
              from: user.wallet.address,
              notAfter: now + 600,
              vMethodId: thumbprint2,
            } satisfies ExpireVerificationMethodSchema;
            break;
          }
          case "revokeController": {
            params = {
              controller: lastDid,
              did: user.info.did,
              from: user.wallet.address,
            } satisfies RevokeControllerSchema;
            break;
          }
          case "revokeService": {
            params = {
              did: user.info.did,
              from: user.wallet.address,
              serviceId: "1",
            } satisfies RevokeServiceSchema;
            break;
          }
          case "revokeVerificationMethod": {
            params = {
              did: user.info.did,
              from: user.wallet.address,
              notAfter: now - 60,
              vMethodId: thumbprint2,
            } satisfies RevokeVerificationMethodSchema;
            break;
          }
          case "rollVerificationMethod": {
            params = {
              args: {
                did: user.info.did,
                duration: 3600,
                isSecp256k1: false,
                notAfter: in6months,
                notBefore: now,
                oldVMethodId: thumbprint2,
                publicKey: `0x${Buffer.from(
                  JSON.stringify(publicKeyJwk3),
                ).toString("hex")}`,
                vMethodId: thumbprint3,
              },
              from: user.wallet.address,
            } satisfies RollVerificationMethodSchema;
            break;
          }
          case "updateBaseDocument": {
            params = {
              baseDocument: JSON.stringify({
                "@context": [
                  "https://www.w3.org/ns/did/v1",
                  "https://w3id.org/security/suites/jws-2020/v1",
                ],
                testKey: randomUUID(),
              }),
              did: user.info.did,
              from: user.wallet.address,
            } satisfies UpdateBaseDocumentSchema;
            break;
          }
          default: {
            throw new Error("Test Error: Invalid method");
          }
        }

        const responseBuild: SupertestJsonRpcResponse = await request(server)
          .post("/jsonrpc")
          .auth(user.token, { type: "bearer" })
          .send({
            id: 1,
            jsonrpc: "2.0",
            method,
            params: [params],
          });

        expect(responseBuild.body).toStrictEqual({
          id: 1,
          jsonrpc: "2.0",
          result: {
            chainId: expect.any(String),
            data: expect.any(String),
            from: user.wallet.address,
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
          unsignedTransaction as UnsignedTransaction,
        );

        const sgnTx = await user.wallet.signTransaction(uTx);
        const signature = ethers.Transaction.from(sgnTx).signature;
        if (!signature) {
          throw new Error("Signature not found");
        }
        const { r, s, v } = signature;

        const responseSend: SupertestJsonRpcResponse = await request(server)
          .post("/jsonrpc")
          .auth(user.token, { type: "bearer" })
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
    });
  });
});
