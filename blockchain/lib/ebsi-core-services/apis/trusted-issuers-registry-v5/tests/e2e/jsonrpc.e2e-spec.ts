import type { PaginatedList } from "@ebsiint-api/shared";
import type {
  EbsiEnvConfiguration,
  EbsiIssuer,
} from "@europeum-ebsi/verifiable-credential";
import type { Schemas as VCDM11Schemas } from "@europeum-ebsi/verifiable-credential/vcdm11.js";
import type { Schemas as VCDM20Schemas } from "@europeum-ebsi/verifiable-credential/vcdm20.js";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { RawServerDefault } from "fastify";

import {
  encode,
  getPublicKeyJwk,
  getSigner,
  prefixWith0x,
  waitToBeMined,
} from "@ebsiint-api/shared";
import { hexToBytes } from "@europeum-ebsi/did-jwt";
import { fromUrl } from "@europeum-ebsi/ebsi-uri";
import { metadata as vcdm11AttestationSchemaMetadata } from "@europeum-ebsi/vcdm1.1-attestation-schema";
import { metadata as vcdm11BitstringStatusListCredentialSchemaMetadata } from "@europeum-ebsi/vcdm1.1-bitstring-status-list-v1.0-credential-schema";
import { metadata as vcdm11RevocationStatusListSchemaMetadata } from "@europeum-ebsi/vcdm1.1-revocation-statuslist-schema";
import { metadata as vcdm20BitstringStatusListCredentialSchemaMetadata } from "@europeum-ebsi/vcdm2.0-bitstring-status-list-v1.0-credential-schema";
import { createVerifiableCredentialJwt as createVcdm11VerifiableCredentialJwt } from "@europeum-ebsi/verifiable-credential/vcdm11.js";
import { createVerifiableCredentialJwt as createVcdm20VerifiableCredentialJwt } from "@europeum-ebsi/verifiable-credential/vcdm20.js";
import { EbsiWallet } from "@europeum-ebsi/wallet-lib";
import { ConfigService } from "@nestjs/config";
import { useContainer } from "class-validator";
import { ethers } from "ethers";
import { calculateJwkThumbprint, exportJWK, generateKeyPair } from "jose";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { randomBytes, randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { ApiConfig } from "../../src/config/configuration.ts";
import type {
  DidLink,
  IdLink,
  IssuerProxyResponseObject,
} from "../../src/modules/issuers/issuers.interface.ts";
import type { JsonRpcResponseObject } from "../../src/modules/jsonrpc/jsonrpc.interface.ts";
import type { AddIssuerProxySchema } from "../../src/modules/jsonrpc/validators/RequestAddIssuerProxySchema.ts";
import type { RemoveIssuerProxySchema } from "../../src/modules/jsonrpc/validators/RequestRemoveIssuerProxySchema.ts";
import type { UnsignedTransaction } from "../../src/modules/jsonrpc/validators/RequestSendSignedTransactionSchema.ts";
import type { SetAttributeDataSchema } from "../../src/modules/jsonrpc/validators/RequestSetAttributeDataSchema.ts";
import type { SetAttributeMetadataSchema } from "../../src/modules/jsonrpc/validators/RequestSetAttributeMetadataSchema.ts";
import type { UpdateIssuerProxySchema } from "../../src/modules/jsonrpc/validators/RequestUpdateIssuerProxySchema.ts";
import type { IssuerObject } from "../utils/tir.ts";

import { AppModule } from "../../src/app.module.ts";
import { IssuerType } from "../../src/modules/issuers/issuers.constants.ts";
import { formatEthersUnsignedTransaction } from "../../src/modules/jsonrpc/jsonrpc.utils.ts";
import { getNestFastifyApplication } from "../utils/app.ts";
import { describeLocalTestEnvOnly } from "../utils/describeLocalTestEnvOnly.ts";
import { describeWriteOps } from "../utils/describeWriteOps.ts";
import {
  getDidrWriteAccessToken,
  getTirInviteAccessToken,
  getTirWriteAccessToken,
} from "../utils/getAccessToken.ts";
import { getServer } from "../utils/getServer.ts";
import { createIssuer } from "../utils/tir.ts";

interface SupertestAttributesResponse {
  body: {
    items: IdLink[];
  };
  status: number;
}

interface SupertestIssuersResponse {
  body: PaginatedList<DidLink>;
  status: number;
}

interface SupertestJsonRpcResponse {
  body: JsonRpcResponseObject;
  status: number;
}

interface TestIssuer {
  info: EbsiIssuer;
  token: string;
  wallet: ethers.BaseWallet;
}

async function getEbsiIssuer(
  privateKeyHex: string,
  did: string,
  kid?: string,
  alg: "ES256" | "ES256K" = "ES256",
) {
  const privateKey = hexToBytes(privateKeyHex);
  const publicKeyJwk = await getPublicKeyJwk(privateKey, alg);
  const issuer: EbsiIssuer = {
    alg,
    did,
    kid: kid ?? `${did}#${publicKeyJwk.kid}`,
    signer: getSigner(privateKey, alg),
  };
  return issuer;
}

describeWriteOps().each(["EBSI URI", "URL"] as const)(
  "TIR API v5 - JSON-RPC (e2e, using %s as resource locator)",
  (uriType) => {
    let app: NestFastifyApplication;
    let server: RawServerDefault | string;
    let configService: ConfigService<ApiConfig, true>;
    let ledgerApi: string;
    let trustedSchemasRegistryApiUrl: string;
    let authorisationApiUrl: string;
    let sampleTransaction: string;
    let blockscout: {
      bearerToken: string | undefined;
      url: string | undefined;
    };
    let adminIssuer: TestIssuer;
    let testIssuerWithProxy: TestIssuer;
    let ebsiEnvConfig: EbsiEnvConfiguration;

    async function createStatusListCredentialJwt(
      issuer: EbsiIssuer,
      issuerProxy: IssuerProxyResponseObject,
      ebsiEnvConfig: EbsiEnvConfiguration,
      uriType: "EBSI URI" | "URL",
      statusList:
        | "BitstringStatusListCredential"
        | "BitstringStatusListCredentialVCDM2.0"
        | "StatusList2021Credential",
    ) {
      let statusListSchemaUrl: string;
      let newIssuer1StatusListCredential:
        | VCDM11Schemas["BitstringStatusListCredential"]
        | VCDM11Schemas["StatusList2021Credential"]
        | VCDM20Schemas["BitstringStatusListCredential"];

      switch (statusList) {
        case "BitstringStatusListCredential": {
          statusListSchemaUrl = `${trustedSchemasRegistryApiUrl}/schemas/${vcdm11BitstringStatusListCredentialSchemaMetadata.id.multibase_base58btc}`;
          newIssuer1StatusListCredential = {
            "@context": ["https://www.w3.org/2018/credentials/v1"],
            credentialSchema: [
              {
                id:
                  uriType === "URL"
                    ? statusListSchemaUrl
                    : fromUrl(statusListSchemaUrl, ebsiEnvConfig),
                type: "FullJsonSchemaValidator2021",
              },
            ],
            credentialSubject: {
              encodedList:
                "uH4sIAAAAAAAAA-3BMQEAAADCoPVPbQwfoAAAAAAAAAAAAAAAAAAAAIC3AYbSVKsAQAAA",
              // Note: the VC lib requires that credentialSubject.id is a valid EBSI DID. We can't use a URL here!
              // id: `${issuer.proxy.rawProxyData.prefix}${issuer.proxy.rawProxyData.testSuffix}#list`,
              id: issuer.did,
              statusPurpose: "revocation",
              type: "BitstringStatusList",
            },
            id: `${issuerProxy.prefix}${issuerProxy.testSuffix}`,
            issuanceDate: "2025-04-05T14:27:40Z",
            issued: "2025-04-05T14:27:40Z",
            issuer: issuer.did,
            type: [
              "VerifiableCredential",
              "VerifiableAttestation",
              "BitstringStatusListCredential",
            ],
            validFrom: "2025-04-05T14:27:40Z",
          } as const satisfies VCDM11Schemas["BitstringStatusListCredential"];
          break;
        }
        case "BitstringStatusListCredentialVCDM2.0": {
          statusListSchemaUrl = `${trustedSchemasRegistryApiUrl}/schemas/${vcdm20BitstringStatusListCredentialSchemaMetadata.id.multibase_base58btc}`;
          newIssuer1StatusListCredential = {
            "@context": ["https://www.w3.org/ns/credentials/v2"],
            credentialSchema: [
              {
                id:
                  uriType === "URL"
                    ? statusListSchemaUrl
                    : fromUrl(statusListSchemaUrl, ebsiEnvConfig),
                type: "FullJsonSchemaValidator2021",
              },
            ],
            credentialSubject: {
              encodedList:
                "uH4sIAAAAAAAAA-3BMQEAAADCoPVPbQwfoAAAAAAAAAAAAAAAAAAAAIC3AYbSVKsAQAAA",
              // Note: the VC lib requires that credentialSubject.id is a valid EBSI DID. We can't use a URL here!
              // id: `${issuer.proxy.rawProxyData.prefix}${issuer.proxy.rawProxyData.testSuffix}#list`,
              id: issuer.did,
              statusPurpose: "revocation",
              type: "BitstringStatusList",
            },
            id: `${issuerProxy.prefix}${issuerProxy.testSuffix}`,
            issuanceDate: "2025-04-05T14:27:40Z",
            issued: "2025-04-05T14:27:40Z",
            issuer: issuer.did,
            type: [
              "VerifiableCredential",
              "VerifiableAttestation",
              "BitstringStatusListCredential",
            ],
            validFrom: "2025-04-05T14:27:40Z",
          } as const satisfies VCDM20Schemas["BitstringStatusListCredential"];
          break;
        }
        case "StatusList2021Credential": {
          statusListSchemaUrl = `${trustedSchemasRegistryApiUrl}/schemas/${vcdm11RevocationStatusListSchemaMetadata.id.multibase_base58btc}`;
          newIssuer1StatusListCredential = {
            "@context": [
              "https://www.w3.org/2018/credentials/v1",
              "https://w3id.org/vc/status-list/2021/v1",
            ],
            credentialSchema: [
              {
                id:
                  uriType === "URL"
                    ? statusListSchemaUrl
                    : fromUrl(statusListSchemaUrl, ebsiEnvConfig),
                type: "FullJsonSchemaValidator2021",
              },
            ],
            credentialSubject: {
              encodedList:
                "H4sIAAAAAAAAA-3BMQEAAADCoPVPbQwfoAAAAAAAAAAAAAAAAAAAAIC3AYbSVKsAQAAA",
              // Note: the VC lib requires that credentialSubject.id is a valid EBSI DID. We can't use a URL here!
              // id: `${issuer.proxy.rawProxyData.prefix}${issuer.proxy.rawProxyData.testSuffix}#list`,
              id: issuer.did,
              statusPurpose: "revocation",
              type: "StatusList2021",
            },
            id: `${issuerProxy.prefix}${issuerProxy.testSuffix}`,
            issuanceDate: "2025-04-05T14:27:40Z",
            issued: "2025-04-05T14:27:40Z",
            issuer: issuer.did,
            type: [
              "VerifiableCredential",
              "VerifiableAttestation",
              "StatusList2021Credential",
            ],
            validFrom: "2025-04-05T14:27:40Z",
          } as const satisfies VCDM11Schemas["StatusList2021Credential"];
          break;
        }
      }

      const newIssuer1StatusListCredentialJwt =
        statusList === "BitstringStatusListCredentialVCDM2.0"
          ? await createVcdm20VerifiableCredentialJwt(
              newIssuer1StatusListCredential as VCDM20Schemas["Attestation"],
              issuer,
              ebsiEnvConfig,
              {
                skipValidation: true,
              },
            )
          : await createVcdm11VerifiableCredentialJwt(
              newIssuer1StatusListCredential as VCDM11Schemas["Attestation"],
              issuer,
              ebsiEnvConfig,
              {
                skipValidation: true,
              },
            );

      return newIssuer1StatusListCredentialJwt;
    }

    let newIssuer1: IssuerObject;
    let newIssuer2: IssuerObject;
    let newIssuer3: IssuerObject;

    beforeAll(async () => {
      newIssuer1 = createIssuer(IssuerType.RootTAO);
      newIssuer2 = createIssuer(IssuerType.RootTAO);
      newIssuer3 = createIssuer(IssuerType.RootTAO);

      app = await getNestFastifyApplication({
        imports: [AppModule],
      });

      if (process.env.TEST_ENV !== "remote") {
        await app.init();
        const fastifyInstance = app.getHttpAdapter().getInstance();
        await fastifyInstance.ready();
        useContainer(app.select(AppModule), { fallbackOnErrors: true });
      }

      configService = app.get<ConfigService<ApiConfig, true>>(ConfigService);
      server = getServer(app, configService);

      blockscout = configService.get("blockscout", { infer: true });
      ledgerApi = `${configService.get("ledgerApiUrl", { infer: true })}/blockchains/besu`;
      trustedSchemasRegistryApiUrl = configService.get(
        "trustedSchemasRegistryApiUrl",
        { infer: true },
      );
      authorisationApiUrl = configService.get("authorisationApiUrl", {
        infer: true,
      });

      ledgerApi = `${configService.get("ledgerApiUrl", { infer: true })}/blockchains/besu`;
      ebsiEnvConfig = configService.get("ebsiEnvConfig", { infer: true });

      // Get last 2 issuers DID
      let issuersResponse: SupertestIssuersResponse =
        await request(server).get("/issuers");

      // Go to last page (where there is at least 2 admins)
      const { total } = issuersResponse.body;
      issuersResponse = await request(server).get(
        `/issuers?page[after]=${Math.floor(total / 2)}&page[size]=2`,
      );

      // Get testIssuerWithProxy's first proxyId
      const testIssuerWithProxyKid = configService.get(
        "testIssuerWithProxyKid",
        { infer: true },
      );
      const testIssuerWithProxyDid = testIssuerWithProxyKid.split("#")[0]!;

      const testIssuerWithProxyPrivateKey = configService.get(
        "testIssuerWithProxyPrivateKey",
        { infer: true },
      );

      const testIssuerWithProxyWallet = new ethers.Wallet(
        prefixWith0x(testIssuerWithProxyPrivateKey),
      );

      const testIssuerWithProxyInfo = await getEbsiIssuer(
        testIssuerWithProxyPrivateKey,
        testIssuerWithProxyDid,
        testIssuerWithProxyKid,
      );

      try {
        testIssuerWithProxy = {
          info: testIssuerWithProxyInfo,
          token: await getTirWriteAccessToken(
            authorisationApiUrl,
            testIssuerWithProxyInfo,
            ebsiEnvConfig,
          ),
          wallet: testIssuerWithProxyWallet,
        };
      } catch (error) {
        console.error(error);
        throw error;
      }

      // Import "admin" issuer (TI with policies to call the SC methods)
      const adminKid = configService.get("testAdminKid", { infer: true });
      const adminDid = adminKid.split("#")[0]!;
      const adminPrivateKeyHex = configService.get("testAdminPrivateKey", {
        infer: true,
      });
      const adminWallet = new ethers.Wallet(prefixWith0x(adminPrivateKeyHex));
      const adminIssuerInfo = await getEbsiIssuer(
        adminPrivateKeyHex,
        adminDid,
        adminKid,
      );

      try {
        adminIssuer = {
          info: adminIssuerInfo,
          token: await getTirWriteAccessToken(
            authorisationApiUrl,
            adminIssuerInfo,
            ebsiEnvConfig,
          ),
          wallet: adminWallet,
        };
      } catch (error) {
        console.error(error);
        throw error;
      }
    });

    afterAll(async () => {
      await app.close();
    });

    describe.each([
      { method: "setAttributeMetadata" },
      { method: "setAttributeData", useNewIssuer: true },
    ] as const)("/jsonrpc - %o", ({ method, useNewIssuer = false }) => {
      let sender: TestIssuer;
      let senderFirstAttributeId: string;
      let newIssuer: TestIssuer;

      beforeAll(async () => {
        if (useNewIssuer) {
          // Dynamically create pristine issuer
          const newIssuerWallet = ethers.Wallet.createRandom();
          const newIssuerPrivateKey = newIssuerWallet.privateKey;
          const newIssuerDid = EbsiWallet.createDid();
          const newIssuerInfo = await getEbsiIssuer(
            newIssuerPrivateKey,
            newIssuerDid,
            undefined,
            "ES256K",
          );
          const {
            privateKey: newIssuerES256PrivateKey,
            publicKey: newIssuerES256PublicKey,
          } = await generateKeyPair("ES256");
          const newIssuerES256PrivateKeyHex = encode.privateKey.fromJWKToHex(
            await exportJWK(newIssuerES256PrivateKey),
          );
          const newIssuerES256PublicKeyJwk = await exportJWK(
            newIssuerES256PublicKey,
          );
          const newIssuerES256PublicKeyThumbprint =
            await calculateJwkThumbprint(newIssuerES256PublicKeyJwk);
          const newIssuerES256Info = await getEbsiIssuer(
            newIssuerES256PrivateKeyHex,
            newIssuerDid,
          );

          // Admin issuer inserts the new TI's DID document
          const didWriteAccessToken = await getDidrWriteAccessToken(
            authorisationApiUrl,
            adminIssuer.info,
            ebsiEnvConfig,
          );
          const didRegistryApiUrl = configService.get("didRegistryApiUrl", {
            infer: true,
          });
          const now = Math.floor(Date.now() / 1000);
          const in6months = now + 6 * 30 * 24 * 3600;
          let responseBuild: SupertestJsonRpcResponse = await request(
            didRegistryApiUrl,
          )
            .post("/jsonrpc")
            .auth(didWriteAccessToken, { type: "bearer" })
            .send({
              id: 231,
              jsonrpc: "2.0",
              method: "insertDidDocument",
              params: [
                {
                  baseDocument: JSON.stringify({
                    "@context": [
                      "https://www.w3.org/ns/did/v1",
                      "https://w3id.org/security/suites/jws-2020/v1", // Required
                    ],
                  }),
                  did: newIssuerInfo.did,
                  from: adminIssuer.wallet.address,
                  isSecp256k1: true,
                  notAfter: in6months,
                  notBefore: now,
                  publicKey: newIssuerWallet.signingKey.publicKey,
                  vMethodId: newIssuerInfo.kid.split("#")[1],
                },
              ],
            });

          let unsignedTransaction = responseBuild.body.result;
          let uTx = formatEthersUnsignedTransaction(
            unsignedTransaction as UnsignedTransaction,
          );

          let sgnTx = await adminIssuer.wallet.signTransaction(uTx);
          let parsedTx = ethers.Transaction.from(sgnTx).signature;

          if (!parsedTx) {
            throw new Error("Signature not found");
          }

          let responseSend: SupertestJsonRpcResponse = await request(
            didRegistryApiUrl,
          )
            .post("/jsonrpc")
            .auth(didWriteAccessToken, { type: "bearer" })
            .send({
              id: "45",
              jsonrpc: "2.0",
              method: "sendSignedTransaction",
              params: [
                {
                  protocol: "eth",
                  r: parsedTx.r,
                  s: parsedTx.s,
                  signedRawTransaction: sgnTx,
                  unsignedTransaction,
                  v: `0x${Number(parsedTx.v).toString(16)}`,
                },
              ],
            });

          // Wait to be mined
          await waitToBeMined(ledgerApi, responseSend.body.result as string);

          // Add ES256 verification method to DID document
          responseBuild = await request(didRegistryApiUrl)
            .post("/jsonrpc")
            .auth(didWriteAccessToken, { type: "bearer" })
            .send({
              id: 1,
              jsonrpc: "2.0",
              method: "addVerificationMethod",
              params: [
                {
                  did: newIssuerInfo.did,
                  from: adminIssuer.wallet.address,
                  isSecp256k1: false,
                  publicKey: `0x${Buffer.from(
                    JSON.stringify(newIssuerES256PublicKeyJwk),
                  ).toString("hex")}`,
                  vMethodId: newIssuerES256PublicKeyThumbprint,
                },
              ],
            });

          unsignedTransaction = responseBuild.body.result;

          uTx = formatEthersUnsignedTransaction(
            unsignedTransaction as UnsignedTransaction,
          );

          sgnTx = await adminIssuer.wallet.signTransaction(uTx);
          parsedTx = ethers.Transaction.from(sgnTx).signature;

          if (!parsedTx) {
            throw new Error("Signature not found");
          }

          responseSend = await request(didRegistryApiUrl)
            .post("/jsonrpc")
            .auth(didWriteAccessToken, { type: "bearer" })
            .send({
              id: "45",
              jsonrpc: "2.0",
              method: "sendSignedTransaction",
              params: [
                {
                  protocol: "eth",
                  r: parsedTx.r,
                  s: parsedTx.s,
                  signedRawTransaction: sgnTx,
                  unsignedTransaction,
                  v: `0x${Number(parsedTx.v).toString(16)}`,
                },
              ],
            });

          // Wait to be mined
          await waitToBeMined(ledgerApi, responseSend.body.result as string);

          // Register ES256 verification method as assertionMethod
          responseBuild = await request(didRegistryApiUrl)
            .post("/jsonrpc")
            .auth(didWriteAccessToken, { type: "bearer" })
            .send({
              id: 1,
              jsonrpc: "2.0",
              method: "addVerificationRelationship",
              params: [
                {
                  did: newIssuerInfo.did,
                  from: adminIssuer.wallet.address,
                  name: "assertionMethod",
                  notAfter: in6months,
                  notBefore: now,
                  vMethodId: newIssuerES256PublicKeyThumbprint,
                },
              ],
            });

          unsignedTransaction = responseBuild.body.result;

          uTx = formatEthersUnsignedTransaction(
            unsignedTransaction as UnsignedTransaction,
          );

          sgnTx = await adminIssuer.wallet.signTransaction(uTx);
          parsedTx = ethers.Transaction.from(sgnTx).signature;

          if (!parsedTx) {
            throw new Error("Signature not found");
          }

          responseSend = await request(didRegistryApiUrl)
            .post("/jsonrpc")
            .auth(didWriteAccessToken, { type: "bearer" })
            .send({
              id: "45",
              jsonrpc: "2.0",
              method: "sendSignedTransaction",
              params: [
                {
                  protocol: "eth",
                  r: parsedTx.r,
                  s: parsedTx.s,
                  signedRawTransaction: sgnTx,
                  unsignedTransaction,
                  v: `0x${Number(parsedTx.v).toString(16)}`,
                },
              ],
            });

          // Wait to be mined
          await waitToBeMined(ledgerApi, responseSend.body.result as string);

          // Register ES256 verification method as authentication method
          responseBuild = await request(didRegistryApiUrl)
            .post("/jsonrpc")
            .auth(didWriteAccessToken, { type: "bearer" })
            .send({
              id: 1,
              jsonrpc: "2.0",
              method: "addVerificationRelationship",
              params: [
                {
                  did: newIssuerInfo.did,
                  from: adminIssuer.wallet.address,
                  name: "authentication",
                  notAfter: in6months,
                  notBefore: now,
                  vMethodId: newIssuerES256PublicKeyThumbprint,
                },
              ],
            });

          unsignedTransaction = responseBuild.body.result;

          uTx = formatEthersUnsignedTransaction(
            unsignedTransaction as UnsignedTransaction,
          );

          sgnTx = await adminIssuer.wallet.signTransaction(uTx);
          parsedTx = ethers.Transaction.from(sgnTx).signature;

          if (!parsedTx) {
            throw new Error("Signature not found");
          }

          responseSend = await request(didRegistryApiUrl)
            .post("/jsonrpc")
            .auth(didWriteAccessToken, { type: "bearer" })
            .send({
              id: "45",
              jsonrpc: "2.0",
              method: "sendSignedTransaction",
              params: [
                {
                  protocol: "eth",
                  r: parsedTx.r,
                  s: parsedTx.s,
                  signedRawTransaction: sgnTx,
                  unsignedTransaction,
                  v: `0x${Number(parsedTx.v).toString(16)}`,
                },
              ],
            });

          // Wait to be mined
          await waitToBeMined(ledgerApi, responseSend.body.result as string);

          // Admin issuer inserts the new TI
          responseBuild = await request(server)
            .post("/jsonrpc")
            .auth(adminIssuer.token, { type: "bearer" })
            .send({
              id: 231,
              jsonrpc: "2.0",
              method: "setAttributeMetadata",
              params: [
                {
                  attributeIdTao: `0x${"0".repeat(64)}`,
                  did: newIssuerDid,
                  from: adminIssuer.wallet.address,
                  issuerType: IssuerType.RootTAO,
                  revisionId: `0x${randomBytes(32).toString("hex")}`,
                  taoDid: newIssuerDid,
                } satisfies SetAttributeMetadataSchema,
              ],
            });

          unsignedTransaction = responseBuild.body.result;
          uTx = formatEthersUnsignedTransaction(
            unsignedTransaction as UnsignedTransaction,
          );

          sgnTx = await adminIssuer.wallet.signTransaction(uTx);
          parsedTx = ethers.Transaction.from(sgnTx).signature;

          if (!parsedTx) {
            throw new Error("Signature not found");
          }

          responseSend = await request(server)
            .post("/jsonrpc")
            .auth(adminIssuer.token, { type: "bearer" })
            .send({
              id: "45",
              jsonrpc: "2.0",
              method: "sendSignedTransaction",
              params: [
                {
                  protocol: "eth",
                  r: parsedTx.r,
                  s: parsedTx.s,
                  signedRawTransaction: sgnTx,
                  unsignedTransaction,
                  v: `0x${Number(parsedTx.v).toString(16)}`,
                },
              ],
            });

          // Wait to be mined
          await waitToBeMined(ledgerApi, responseSend.body.result as string);

          // Admin Issuer issues a "VerifiableAccreditationToAccredit" to the new issuer
          const issuanceDate = new Date(Date.now() - 5000); // issue 5 seconds ago
          const expirationDate = new Date(
            issuanceDate.getTime() + 2 * 60 * 60 * 1000,
          );
          const verifiableAttestationSchemaUrl = `${trustedSchemasRegistryApiUrl}/schemas/${vcdm11AttestationSchemaMetadata.id.multibase_base58btc}`;
          const termsOfUseUrl = configService.get("testAdminAccreditation", {
            infer: true,
          });
          const vcPayload = {
            "@context": ["https://www.w3.org/2018/credentials/v1"],
            credentialSchema: {
              id:
                uriType === "URL"
                  ? verifiableAttestationSchemaUrl
                  : fromUrl(verifiableAttestationSchemaUrl, ebsiEnvConfig),
              type: "FullJsonSchemaValidator2021",
            },
            credentialSubject: { id: newIssuerDid },
            expirationDate: `${expirationDate.toISOString().slice(0, -5)}Z`,
            id: `urn:uuid:${randomUUID()}`,
            issuanceDate: `${issuanceDate.toISOString().slice(0, -5)}Z`,
            issued: `${issuanceDate.toISOString().slice(0, -5)}Z`,
            issuer: adminIssuer.info.did,
            termsOfUse: {
              id:
                uriType === "URL"
                  ? termsOfUseUrl
                  : fromUrl(termsOfUseUrl, ebsiEnvConfig),
              type: "IssuanceCertificate",
            },
            type: [
              "VerifiableCredential",
              "VerifiableAttestation",
              "VerifiableAccreditationToAccredit",
            ],
            validFrom: `${issuanceDate.toISOString().slice(0, -5)}Z`,
          } satisfies VCDM11Schemas["Attestation"];
          const vcJwt = await createVcdm11VerifiableCredentialJwt(
            vcPayload,
            adminIssuer.info,
            ebsiEnvConfig,
            {
              skipValidation: true,
            },
          );

          // Get access token for new issuer
          try {
            newIssuer = {
              info: newIssuerInfo,
              token: await getTirInviteAccessToken(
                authorisationApiUrl,
                newIssuerES256Info,
                vcJwt,
                ebsiEnvConfig,
              ),
              wallet: newIssuerWallet,
            };
          } catch (error) {
            console.error(error);
            throw error;
          }
        }

        // Choose TX sender
        sender = useNewIssuer ? newIssuer : adminIssuer;

        if (
          method === "setAttributeMetadata" ||
          method === "setAttributeData"
        ) {
          // Get sender's first attribute ID
          const attributesResponse: SupertestAttributesResponse = await request(
            server,
          ).get(`/issuers/${sender.info.did}/attributes`);
          senderFirstAttributeId = attributesResponse.body.items[0]!.id;
        }
      });

      it("should return a new unsigned transaction", async () => {
        if (method === "setAttributeData") {
          // TIR API v5 would return an error because attributeId does not exist
          expect.assertions(0);
          return;
        }

        expect.assertions(2);

        let params = {};

        switch (method) {
          case "setAttributeMetadata": {
            const { attribute, attributeIdTao, did, issuerType, tao } =
              createIssuer(IssuerType.RootTAO);

            params = {
              attributeIdTao,
              did,
              from: sender.wallet.address,
              issuerType,
              revisionId: attribute.id,
              taoDid: tao,
            } satisfies SetAttributeMetadataSchema;
            break;
          }
          default: {
            throw new Error("Invalid method");
          }
        }

        const responseBuild: SupertestJsonRpcResponse = await request(server)
          .post("/jsonrpc")
          .auth(sender.token, { type: "bearer" })
          .send({
            id: 231,
            jsonrpc: "2.0",
            method,
            params: [params],
          });

        expect(responseBuild.body).toStrictEqual({
          id: 231,
          jsonrpc: "2.0",
          result: {
            chainId: expect.any(String),
            data: expect.any(String),
            from: sender.wallet.address,
            gasLimit: expect.any(String),
            gasPrice: expect.any(String),
            nonce: expect.any(String),
            to: expect.any(String),
            value: expect.any(String),
          },
        });
        expect(responseBuild.status).toBe(200);
      });

      it("should return an error when the attribute ID doesn't exist (setAttributeData only)", async () => {
        if (method !== "setAttributeData") {
          expect.assertions(0);
          return;
        }

        expect.assertions(2);

        let params = {};
        const { attribute } = createIssuer(IssuerType.RootTAO);

        switch (method) {
          case "setAttributeData": {
            params = {
              attributeData: attribute.hex,
              attributeId: attribute.id,
              did: newIssuer.info.did,
              from: sender.wallet.address,
            } satisfies SetAttributeDataSchema;
            break;
          }
          default: {
            throw new Error("Invalid method");
          }
        }

        const responseBuild: SupertestJsonRpcResponse = await request(server)
          .post("/jsonrpc")
          .auth(sender.token, { type: "bearer" })
          .send({
            id: 231,
            jsonrpc: "2.0",
            method,
            params: [params],
          });

        expect(responseBuild.body).toStrictEqual({
          error: {
            code: -32_600,
            message: `Invalid 'params.0.attributeId': Attribute ${attribute.id} does not exist`,
          },
          id: 231,
          jsonrpc: "2.0",
        });
        expect(responseBuild.status).toBe(400);
      });

      it("should send a transaction", async () => {
        expect.assertions(7);

        let extraTestUrl = "";
        let extraTestExpectedResponse: unknown = {};
        let params = {};

        switch (method) {
          case "setAttributeData": {
            const newAttributeData = `test - ${new Date().toISOString()}`;
            const newAttributeDataBuffer = Buffer.from(newAttributeData);

            params = {
              attributeData: `0x${newAttributeDataBuffer.toString("hex")}`,
              attributeId: prefixWith0x(senderFirstAttributeId),
              did: sender.info.did,
              from: sender.wallet.address,
            } satisfies SetAttributeDataSchema;

            extraTestUrl = `/issuers/${sender.info.did}`;

            extraTestExpectedResponse = {
              attributes: expect.stringContaining(
                `/issuers/${sender.info.did}/attributes`,
              ),
              did: sender.info.did,
              hasAttributes: true,
            };

            break;
          }
          case "setAttributeMetadata": {
            params = {
              attributeIdTao: newIssuer1.attributeIdTao,
              did: sender.info.did,
              from: sender.wallet.address,
              issuerType: 1, // RootTAO
              revisionId: prefixWith0x(senderFirstAttributeId),
              taoDid: newIssuer1.tao,
            } satisfies SetAttributeMetadataSchema;

            extraTestUrl = `/issuers/${sender.info.did}`;

            extraTestExpectedResponse = {
              attributes: expect.stringContaining(
                `/issuers/${sender.info.did}/attributes`,
              ),
              did: sender.info.did,
              hasAttributes: expect.any(Boolean),
            };

            break;
          }
          default: {
            throw new Error("Invalid method");
          }
        }

        const responseBuild: SupertestJsonRpcResponse = await request(server)
          .post("/jsonrpc")
          .auth(sender.token, { type: "bearer" })
          .send({
            id: 231,
            jsonrpc: "2.0",
            method,
            params: [params],
          });

        expect(responseBuild.body).toStrictEqual({
          id: 231,
          jsonrpc: "2.0",
          result: {
            chainId: expect.any(String),
            data: expect.any(String),
            from: expect.any(String),
            gasLimit: expect.any(String),
            gasPrice: expect.any(String),
            nonce: expect.any(String),
            to: expect.any(String),
            value: expect.any(String),
          },
        });

        const unsignedTransaction = responseBuild.body.result;
        const uTx = formatEthersUnsignedTransaction(
          unsignedTransaction as UnsignedTransaction,
        );

        const sgnTx = await sender.wallet.signTransaction(uTx);
        const signature = ethers.Transaction.from(sgnTx).signature;
        if (!signature) {
          throw new Error("Signature not found");
        }
        const { r, s, v } = signature;

        const responseSend: SupertestJsonRpcResponse = await request(server)
          .post("/jsonrpc")
          .auth(sender.token, { type: "bearer" })
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
        expect(receipt.revertReason).toBeUndefined();
        expect(receipt.status).toBe("0x1");
        sampleTransaction = responseSend.body.result as string;

        // Extra test
        const extraTestResponse = await request(server).get(extraTestUrl);

        expect(extraTestResponse.body).toStrictEqual(extraTestExpectedResponse);
        expect(extraTestResponse.status).toBe(200);
      });

      it("should send the transaction but the SC should reject no authorized users", async () => {
        expect.assertions(4);

        let params: unknown;
        sender = testIssuerWithProxy;

        switch (method) {
          case "setAttributeData": {
            params = {
              attributeData: newIssuer3.attribute.hex,
              attributeId: prefixWith0x(senderFirstAttributeId),
              did: newIssuer.info.did,
              from: sender.wallet.address,
            } satisfies SetAttributeDataSchema;
            break;
          }
          case "setAttributeMetadata": {
            params = {
              attributeIdTao: newIssuer3.attributeIdTao,
              did: EbsiWallet.createDid(),
              from: sender.wallet.address,
              issuerType: newIssuer3.issuerType,
              revisionId: newIssuer3.attribute.id,
              taoDid: newIssuer3.tao,
            } satisfies SetAttributeMetadataSchema;
            break;
          }
          default: {
            throw new Error("Invalid method");
          }
        }

        const responseBuild: SupertestJsonRpcResponse = await request(server)
          .post("/jsonrpc")
          .auth(sender.token, { type: "bearer" })
          .send({
            id: 231,
            jsonrpc: "2.0",
            method,
            params: [params],
          });

        expect(responseBuild.body).toStrictEqual({
          id: 231,
          jsonrpc: "2.0",
          result: {
            chainId: expect.any(String),
            data: expect.any(String),
            from: expect.any(String),
            gasLimit: expect.any(String),
            gasPrice: expect.any(String),
            nonce: expect.any(String),
            to: expect.any(String),
            value: expect.any(String),
          },
        });

        const unsignedTransaction = responseBuild.body.result;
        const uTx = formatEthersUnsignedTransaction(
          unsignedTransaction as UnsignedTransaction,
        );

        const sgnTx = await sender.wallet.signTransaction(uTx);
        const signature = ethers.Transaction.from(sgnTx).signature;
        if (!signature) {
          throw new Error("Signature not found");
        }
        const { r, s, v } = signature;

        const responseSend: SupertestJsonRpcResponse = await request(server)
          .post("/jsonrpc")
          .auth(sender.token, { type: "bearer" })
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

        const expectedRevertReason =
          method === "setAttributeData"
            ? "Not the issuer itself"
            : `doesn't have the attribute TIR:${method}`;

        // wait to be mined
        const receipt = await waitToBeMined(
          ledgerApi,
          responseSend.body.result as string,
        );

        expect(receipt).toStrictEqual(
          expect.objectContaining({
            revertReason: expect.stringContaining(expectedRevertReason),
            status: "0x0",
          }),
        );
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

    describeLocalTestEnvOnly()("with mocked issuer's endpoint", () => {
      describe.each([
        "StatusList2021Credential",
        "BitstringStatusListCredential",
        "BitstringStatusListCredentialVCDM2.0",
      ] as const)("with status list type %s", (statusList) => {
        describe.each([
          "addIssuerProxy",
          "updateIssuerProxy",
          "removeIssuerProxy",
        ] as const)("/jsonrpc - method: %s", (method) => {
          const mockServer = setupServer();
          let testIssuerWithProxyWallet: ethers.Wallet;

          beforeAll(async () => {
            // Intercept network requests
            mockServer.listen({
              onUnhandledRequest: "bypass",
            });

            testIssuerWithProxyWallet = new ethers.Wallet(
              prefixWith0x(
                configService.get("testIssuerWithProxyPrivateKey", {
                  infer: true,
                }),
              ),
            );

            // Mock Trusted Issuers' endpoint
            const statusListCredentialJwt = await createStatusListCredentialJwt(
              testIssuerWithProxy.info,
              newIssuer1.proxies[0]!.obj,
              ebsiEnvConfig,
              uriType,
              statusList,
            );

            mockServer.use(
              http.get(
                `${newIssuer1.proxies[0]!.obj.prefix}${newIssuer1.proxies[0]!.obj.testSuffix}`,
                () => HttpResponse.json(statusListCredentialJwt),
              ),
            );
          });

          afterAll(() => {
            mockServer.close();
          });

          it("should add / update the proxy", async () => {
            expect.assertions(6);

            const { did } = testIssuerWithProxy.info;
            let extraTestUrl = "";
            let extraTestExpectedResponse: unknown = {};
            let extraTestExpectedStatus = 200;
            let params = {};

            switch (method) {
              case "addIssuerProxy": {
                params = {
                  did,
                  from: testIssuerWithProxyWallet.address,
                  proxyData: newIssuer1.proxies[0]!.utf8,
                } satisfies AddIssuerProxySchema;

                extraTestUrl = `/issuers/${did}/proxies/${newIssuer1.proxies[0]!.id}`;

                extraTestExpectedResponse = newIssuer1.proxies[0]!.obj;

                break;
              }
              case "removeIssuerProxy": {
                params = {
                  did,
                  from: testIssuerWithProxyWallet.address,
                  proxyId: newIssuer1.proxies[0]!.id,
                } satisfies RemoveIssuerProxySchema;

                extraTestUrl = `/issuers/${did}/proxies/${newIssuer1.proxies[0]!.id}`;
                extraTestExpectedResponse = {
                  detail: `Proxy ${newIssuer1.proxies[0]!.id} of issuer ${did} can't be found`,
                  status: 404,
                  title: "Proxy Not Found",
                  type: "about:blank",
                };
                extraTestExpectedStatus = 404;

                break;
              }
              case "updateIssuerProxy": {
                params = {
                  did,
                  from: testIssuerWithProxyWallet.address,
                  proxyData: newIssuer2.proxies[0]!.utf8,
                  proxyId: newIssuer1.proxies[0]!.id,
                } satisfies UpdateIssuerProxySchema;

                extraTestUrl = `/issuers/${did}/proxies/${newIssuer1.proxies[0]!.id}`;
                extraTestExpectedResponse = newIssuer2.proxies[0]!.obj;
                break;
              }
              default: {
                throw new Error("Invalid method");
              }
            }

            const responseBuild: SupertestJsonRpcResponse = await request(
              server,
            )
              .post("/jsonrpc")
              .auth(testIssuerWithProxy.token, { type: "bearer" })
              .send({
                id: 231,
                jsonrpc: "2.0",
                method,
                params: [params],
              });

            const unsignedTransaction = responseBuild.body.result;
            const uTx = formatEthersUnsignedTransaction(
              unsignedTransaction as UnsignedTransaction,
            );

            const sgnTx = await testIssuerWithProxyWallet.signTransaction(uTx);
            const signature = ethers.Transaction.from(sgnTx).signature;
            if (!signature) {
              throw new Error("Signature not found");
            }
            const { r, s, v } = signature;

            const responseSend: SupertestJsonRpcResponse = await request(server)
              .post("/jsonrpc")
              .auth(testIssuerWithProxy.token, { type: "bearer" })
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
            expect(receipt.revertReason).toBeUndefined();
            expect(receipt.status).toBe("0x1");
            sampleTransaction = responseSend.body.result as string;

            // Extra test
            const extraTestResponse = await request(server).get(extraTestUrl);

            expect(extraTestResponse.body).toStrictEqual(
              extraTestExpectedResponse,
            );
            expect(extraTestResponse.status).toBe(extraTestExpectedStatus);
          });
        });
      });
    });
  },
);
