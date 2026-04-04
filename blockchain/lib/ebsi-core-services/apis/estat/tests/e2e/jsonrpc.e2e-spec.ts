import type { EbsiIssuer } from "@europeum-ebsi/verifiable-credential";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { RawServerDefault } from "fastify";

import {
  generatePrivateKey,
  getPublicKeyJwk,
  getSigner,
  waitToBeMined,
} from "@ebsiint-api/shared";
import { hexToBytes } from "@europeum-ebsi/did-jwt";
import { EbsiWallet } from "@europeum-ebsi/wallet-lib";
import { ConfigService } from "@nestjs/config";
import axios from "axios";
import { useContainer } from "class-validator";
import { ethers } from "ethers";
import { randomBytes } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { ApiConfig } from "../../src/config/configuration.ts";
import type { JsonRpcResponseObject } from "../../src/modules/jsonrpc/jsonrpc.interface.ts";
import type {
  AuthoriseDidSchema,
  CreateDocumentSchema,
  GrantAccessSchema,
  RemoveDocumentSchema,
  RevokeAccessSchema,
  UnsignedTransaction,
  WriteEventSchema,
} from "../../src/modules/jsonrpc/validators/index.ts";

import { AppModule } from "../../src/app.module.ts";
import { formatEthersUnsignedTransaction } from "../../src/modules/jsonrpc/jsonrpc.utils.ts";
import { AccountType, Permission } from "../../src/shared/constants.ts";
import { didToHex } from "../../src/shared/utils.ts";
import { getNestFastifyApplication } from "../utils/app.ts";
import { describeWriteOps } from "../utils/describeWriteOps.ts";
import {
  getAccessToken,
  getDidrInviteAccessToken,
} from "../utils/getAccessToken.ts";
import { getServer } from "../utils/getServer.ts";

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

interface TestUser {
  accessToken: {
    didInvite?: string;
    tntAuthorise: string;
    tntCreate: string;
    tntWrite: string;
  };
  info: EbsiIssuer;
  vcOnboard: string;
  wallet: ethers.BaseWallet;
}

describeWriteOps()("ESTAT - JSON-RPC (e2e)", () => {
  let app: NestFastifyApplication;
  let server: RawServerDefault | string;
  let configService: ConfigService<ApiConfig, true>;
  let ledgerApi: string;
  let authoriser: TestUser;
  let creator: TestUser;
  const did1 = EbsiWallet.createDid();
  const documentHash1 = `0x${randomBytes(32).toString("hex")}`;
  const documentHash2 = `0x${randomBytes(32).toString("hex")}`;

  const now = Math.floor(Date.now() / 1000);
  const in6months = now + 6 * 30 * 24 * 3600;

  beforeAll(async () => {
    app = await getNestFastifyApplication({
      imports: [AppModule],
    });

    useContainer(app.select(AppModule), { fallbackOnErrors: true });

    configService = app.get<ConfigService<ApiConfig, true>>(ConfigService);

    if (process.env.TEST_ENV !== "remote") {
      await app.init();
      const fastifyInstance = app.getHttpAdapter().getInstance();
      await fastifyInstance.ready();
    }

    server = getServer(app, configService);

    ledgerApi = `${configService.get("ledgerApiUrl", { infer: true })}/blockchains/besu`;

    const kid = configService.get("testAuthorisedLegalEntityKid", {
      infer: true,
    });

    if (!kid) {
      throw new Error("Missing testAuthorisedLegalEntityKid");
    }

    const did = kid.split("#")[0]!;
    const authoriserPrivateKeyHex = configService.get(
      "testAuthorisedLegalEntityPrivateKey",
      { infer: true },
    );

    if (!authoriserPrivateKeyHex) {
      throw new Error("Missing testAuthorisedLegalEntityPrivateKey");
    }

    const authoriserPrivateKey = hexToBytes(authoriserPrivateKeyHex);

    authoriser = {
      accessToken: {
        tntAuthorise: "",
        tntCreate: "",
        tntWrite: "",
      },
      info: {
        alg: "ES256K",
        did,
        kid,
        signer: getSigner(authoriserPrivateKey, "ES256K"),
      },
      vcOnboard: configService.get("testAuthorisedLegalEntityVcToOnboard", {
        infer: true,
      }),
      wallet: new ethers.Wallet(authoriserPrivateKeyHex),
    };

    // register new DID in the DID Registry
    const creatorDid = EbsiWallet.createDid();
    const creatorPrivateKey = generatePrivateKey("ES256K");
    const creatorPublicKeyJwk = await getPublicKeyJwk(
      creatorPrivateKey,
      "ES256K",
    );
    const creatorThumbprint = creatorPublicKeyJwk.kid;
    creator = {
      accessToken: {
        didInvite: "",
        tntAuthorise: "",
        tntCreate: "",
        tntWrite: "",
      },
      info: {
        alg: "ES256K",
        did: creatorDid,
        kid: `${creatorDid}#${creatorThumbprint}`,
        signer: getSigner(creatorPrivateKey, "ES256K"),
      },
      vcOnboard: "",
      wallet: new ethers.Wallet(new ethers.SigningKey(creatorPrivateKey)),
    };
    creator.accessToken.didInvite = await getDidrInviteAccessToken(
      creatorDid,
      configService.get("testAuthApiV4ES256PrivateKey", { infer: true }),
    );

    const params = {
      baseDocument: JSON.stringify({
        "@context": [
          "https://www.w3.org/ns/did/v1",
          "https://w3id.org/security/suites/jws-2020/v1",
        ],
      }),
      did: creator.info.did,
      from: creator.wallet.address,
      isSecp256k1: true,
      notAfter: in6months,
      notBefore: now,
      publicKey: creator.wallet.signingKey.publicKey,
      vMethodId: creatorThumbprint,
    };

    const domain = configService.get("domain", { infer: true });
    const responseBuild = await axios.post<
      JsonRpcResponseObject<UnsignedTransaction>
    >(
      `${domain}/did-registry/v5/jsonrpc`,
      {
        id: 1,
        jsonrpc: "2.0",
        method: "insertDidDocument",
        params: [params],
      },
      {
        headers: {
          Authorization: `Bearer ${creator.accessToken.didInvite}`,
        },
      },
    );

    const unsignedTransaction = responseBuild.data.result;
    const uTx = formatEthersUnsignedTransaction(unsignedTransaction);

    const sgnTx = await creator.wallet.signTransaction(uTx);
    const signature = ethers.Transaction.from(sgnTx).signature;
    if (!signature) {
      throw new Error("Signature not found");
    }
    const { r, s, v } = signature;

    const responseSend = await axios.post<JsonRpcResponseObject<string>>(
      `${domain}/did-registry/v5/jsonrpc`,
      {
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
      },
      {
        headers: {
          Authorization: `Bearer ${creator.accessToken.didInvite}`,
        },
      },
    );

    // wait to be mined
    await waitToBeMined(ledgerApi, responseSend.data.result);
  });

  afterAll(async () => {
    await app.close();
  });

  describe("ESTAT", () => {
    describe.each([
      "authoriseDid",
      "createDocument",
      "createDocument(external timestamp)",
      "writeEvent",
      "writeEvent(external timestamp)",
      "removeDocument",
      "grantAccess",
      "revokeAccess",
    ] as const)("/jsonrpc - send transaction for %s", (m) => {
      const method = m.replace("(external timestamp)", "");

      let user: TestUser;

      beforeAll(async () => {
        const ebsiEnvConfig = configService.get("ebsiEnvConfig", {
          infer: true,
        });

        switch (method) {
          case "authoriseDid": {
            authoriser.accessToken.tntAuthorise = await getAccessToken(
              configService.get("authorisationApiUrl", { infer: true }),
              authoriser.info,
              "openid tnt_authorise",
              ebsiEnvConfig,
              authoriser.vcOnboard,
            );

            break;
          }
          case "createDocument": {
            // request the tnt_create access token after "authoriseDid"
            // is submitted
            creator.accessToken.tntCreate = await getAccessToken(
              configService.get("authorisationApiUrl", { infer: true }),
              creator.info,
              "openid tnt_create",
              ebsiEnvConfig,
              [],
            );

            break;
          }
          case "writeEvent": {
            // request the tnt_write access token after "createDocument"
            // is submitted
            creator.accessToken.tntWrite = await getAccessToken(
              configService.get("authorisationApiUrl", { infer: true }),
              creator.info,
              "openid tnt_write",
              ebsiEnvConfig,
              [],
            );

            break;
          }
          // No default
        }

        user = method === "authoriseDid" ? authoriser : creator;
      });

      it("should work", async () => {
        expect.assertions(5);

        let params: JsonRpcParams;
        let accessToken: string;

        switch (m) {
          case "authoriseDid": {
            params = {
              authorisedDid: creator.info.did,
              from: authoriser.wallet.address,
              senderDid: authoriser.info.did,
              whiteList: true,
            } satisfies AuthoriseDidSchema;
            accessToken = authoriser.accessToken.tntAuthorise;
            break;
          }
          case "createDocument": {
            params = {
              didEbsiCreator: creator.info.did,
              documentHash: documentHash1,
              documentMetadata: "test metadata",
              from: creator.wallet.address,
            } satisfies CreateDocumentSchema;
            accessToken = creator.accessToken.tntCreate;
            break;
          }
          case "createDocument(external timestamp)": {
            params = {
              didEbsiCreator: creator.info.did,
              documentHash: documentHash2,
              documentMetadata: "test metadata",
              from: creator.wallet.address,
              timestamp: Math.floor(Date.now() / 1000),
              timestampProof: `0x${randomBytes(32).toString("hex")}`,
            } satisfies CreateDocumentSchema;
            accessToken = creator.accessToken.tntCreate;
            break;
          }
          case "grantAccess": {
            params = {
              documentHash: documentHash2,
              from: creator.wallet.address,
              grantedByAccount: await didToHex(creator.info.did),
              grantedByAccType: AccountType.DID_EBSI,
              permission: Permission.DELEGATE,
              subjectAccount: await didToHex(did1),
              subjectAccType: AccountType.DID_EBSI,
            } satisfies GrantAccessSchema;
            accessToken = creator.accessToken.tntWrite;
            break;
          }
          case "removeDocument": {
            params = {
              documentHash: documentHash1,
              from: creator.wallet.address,
            } satisfies RemoveDocumentSchema;
            accessToken = creator.accessToken.tntWrite;
            break;
          }
          case "revokeAccess": {
            params = {
              documentHash: documentHash2,
              from: creator.wallet.address,
              permission: 0,
              revokedByAccount: await didToHex(creator.info.did),
              subjectAccount: await didToHex(did1),
            } satisfies RevokeAccessSchema;
            accessToken = creator.accessToken.tntWrite;
            break;
          }
          case "writeEvent": {
            params = {
              eventParams: {
                documentHash: documentHash1,
                externalHash: `0x${randomBytes(32).toString("hex")}`,
                metadata: "test event metadata",
                origin: "",
                sender: await didToHex(creator.info.did),
              },
              from: creator.wallet.address,
            } satisfies WriteEventSchema;
            accessToken = creator.accessToken.tntWrite;
            break;
          }
          case "writeEvent(external timestamp)": {
            params = {
              eventParams: {
                documentHash: documentHash1,
                externalHash: `0x${randomBytes(32).toString("hex")}`,
                metadata: "test event metadata",
                origin: "",
                sender: await didToHex(creator.info.did),
              },
              from: creator.wallet.address,
              timestamp: Math.floor(Date.now() / 1000),
              timestampProof: `0x${randomBytes(32).toString("hex")}`,
            } satisfies WriteEventSchema;
            accessToken = creator.accessToken.tntWrite;
            break;
          }
          default: {
            // TS will return an error if we forget to cover a case
            const exhaustiveCheck: never = m;
            throw new Error(
              `Test Error: Invalid method ${exhaustiveCheck as string}`,
            );
          }
        }

        const responseBuild: SupertestJsonRpcResponse = await request(server)
          .post("/jsonrpc")
          .auth(accessToken, { type: "bearer" })
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

        const unsignedTransaction = responseBuild.body
          .result as UnsignedTransaction;
        const uTx = formatEthersUnsignedTransaction(unsignedTransaction);

        const sgnTx = await user.wallet.signTransaction(uTx);
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
