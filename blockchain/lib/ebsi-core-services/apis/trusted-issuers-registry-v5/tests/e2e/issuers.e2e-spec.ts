import type { PaginatedList } from "@ebsiint-api/shared";
import type {
  EbsiEnvConfiguration,
  EbsiIssuer,
} from "@europeum-ebsi/verifiable-credential";
import type { Schemas as VCDM11Schemas } from "@europeum-ebsi/verifiable-credential/vcdm11.js";
import type { Schemas as VCDM20Schemas } from "@europeum-ebsi/verifiable-credential/vcdm20.js";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { RawServerDefault } from "fastify";

import { getSigner } from "@ebsiint-api/shared";
import { hexToBytes } from "@europeum-ebsi/did-jwt";
import { fromUrl } from "@europeum-ebsi/ebsi-uri";
import { metadata as vcdm11BitstringStatusListCredentialSchemaMetadata } from "@europeum-ebsi/vcdm1.1-bitstring-status-list-v1.0-credential-schema";
import { metadata as vcdm11RevocationStatusListSchemaMetadata } from "@europeum-ebsi/vcdm1.1-revocation-statuslist-schema";
import { metadata as vcdm20BitstringStatusListCredentialSchemaMetadata } from "@europeum-ebsi/vcdm2.0-bitstring-status-list-v1.0-credential-schema";
import { createVerifiableCredentialJwt as createVcdm11VerifiableCredentialJwt } from "@europeum-ebsi/verifiable-credential/vcdm11.js";
import { createVerifiableCredentialJwt as createVcdm20VerifiableCredentialJwt } from "@europeum-ebsi/verifiable-credential/vcdm20.js";
import { EbsiWallet } from "@europeum-ebsi/wallet-lib";
import { ConfigService } from "@nestjs/config";
import { useContainer } from "class-validator";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import crypto from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import type { ApiConfig } from "../../src/config/configuration.ts";
import type {
  AttributeObject,
  DidLink,
  IdLink,
  IssuerProxyResponseObject,
  IssuerResponseObject,
  ProxyLink,
} from "../../src/modules/issuers/issuers.interface.ts";

import { AppModule } from "../../src/app.module.ts";
import { getNestFastifyApplication } from "../utils/app.ts";
import { describeLocalTestEnvOnly } from "../utils/describeLocalTestEnvOnly.ts";
import { getServer } from "../utils/getServer.ts";

interface SupertestAttributeResponse {
  body: AttributeObject;
  status: number;
}

interface SupertestAttributesResponse {
  body: {
    items: IdLink[];
  };
  status: number;
}

interface SupertestIssuerProxiesResponse {
  body: PaginatedList<ProxyLink>;
  status: number;
}

interface SupertestIssuerProxyResponse {
  body: IssuerProxyResponseObject;
  status: number;
}

interface SupertestIssuerResponse {
  body: IssuerResponseObject;
  status: number;
}

interface SupertestIssuersResponse {
  body: PaginatedList<DidLink>;
  status: number;
}

interface SupertestStringResponse {
  status: number;
  text: string;
}

/**
 * Escape DID in URLs mocked by MSW
 * @see https://github.com/mswjs/msw/discussions/739#discussioncomment-2524732
 */
function escapeDid(url: string) {
  return url.replace("did:ebsi:", String.raw`did\:ebsi\:`);
}

function getEbsiIssuer(privateKeyHex: string, did: string, kid: string) {
  const privateKey = hexToBytes(privateKeyHex);
  const issuer: EbsiIssuer = {
    alg: "ES256",
    did,
    kid,
    signer: getSigner(privateKey, "ES256"),
  };
  return issuer;
}

describe("TIR API v5 - Issuers (e2e)", () => {
  let app: NestFastifyApplication;
  let server: RawServerDefault | string;
  let configService: ConfigService<ApiConfig, true>;
  let testIssuerWithProxyKid: string;
  let testIssuerWithProxyDid: string;
  let testIssuerWithProxyPrivateKey: string;
  let testIssuerWithProxyFirstProxyId: string;
  let trustedSchemasRegistryApiUrl: string;
  const randomDid = EbsiWallet.createDid();

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

  let lastExistingIssuerDid: string;
  let beforeLastExistingIssuerDid: string;

  beforeAll(async () => {
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

    // Get last 2 issuers DID
    let issuersResponse: SupertestIssuersResponse =
      await request(server).get("/issuers");

    // Go to last page (where there is at least 2 admins)
    const { total } = issuersResponse.body;
    issuersResponse = await request(server).get(
      `/issuers?page[after]=${Math.floor(total / 2)}&page[size]=2`,
    );

    beforeLastExistingIssuerDid = issuersResponse.body.items[0]!.did;
    lastExistingIssuerDid = issuersResponse.body.items[1]!.did;

    // Get testIssuerWithProxy's first proxyId
    testIssuerWithProxyKid = configService.get("testIssuerWithProxyKid", {
      infer: true,
    });
    testIssuerWithProxyDid = testIssuerWithProxyKid.split("#")[0]!;
    const issuerProxiesResponse: SupertestIssuerProxiesResponse = await request(
      server,
    ).get(`/issuers/${testIssuerWithProxyDid}/proxies`);
    testIssuerWithProxyFirstProxyId =
      issuerProxiesResponse.body.items[0]!.proxyId;
    testIssuerWithProxyPrivateKey = configService.get(
      "testIssuerWithProxyPrivateKey",
      { infer: true },
    );
    trustedSchemasRegistryApiUrl = configService.get(
      "trustedSchemasRegistryApiUrl",
      { infer: true },
    );
  });

  afterAll(async () => {
    await app.close();
  });

  describe("/issuers", () => {
    it("should return a collection of issuers", async () => {
      expect.assertions(2);
      const response: SupertestIssuersResponse =
        await request(server).get("/issuers");

      expect(response.body).toStrictEqual(
        expect.objectContaining({
          items: expect.arrayContaining([]),
          links: expect.objectContaining({
            first: expect.stringContaining(
              "/trusted-issuers-registry/v5/issuers?page[after]=1&page[size]=10",
            ),
            last: expect.stringContaining(
              "/trusted-issuers-registry/v5/issuers?page[after]=",
            ),
            next: expect.stringContaining(
              "/trusted-issuers-registry/v5/issuers?page[after]=",
            ),
            prev: expect.stringContaining(
              "/trusted-issuers-registry/v5/issuers?page[after]=1&page[size]=10",
            ),
          }),
          pageSize: expect.any(Number),
          self: expect.stringContaining(
            "/trusted-issuers-registry/v5/issuers?page[after]=1&page[size]=10",
          ),
          total: expect.any(Number),
        }),
      );
      expect(response.status).toBe(200);
    });
  });

  describe.each(["latest", "deprecated"] as const)(
    "/issuers/{did} (version: %s)",
    (version) => {
      it("should return a specific issuer", async () => {
        expect.assertions(2);

        const response: SupertestIssuerResponse = await request(server).get(
          `/issuers/${lastExistingIssuerDid}?version=${version}`,
        );
        expect(response.body).toStrictEqual(
          version === "latest"
            ? {
                attributes: expect.any(String),
                did: lastExistingIssuerDid,
                hasAttributes: expect.any(Boolean),
              }
            : {
                attributes: expect.arrayContaining([]),
                did: lastExistingIssuerDid,
              },
        );
        expect(response.status).toBe(200);
      });

      it("should throw an error if the issuer DID is not correctly formatted", async () => {
        expect.assertions(2);

        const response = await request(server).get(
          `/issuers/not-a-did?version=${version}`,
        );

        expect(response.body).toStrictEqual({
          detail: '["did must be a valid DID v1"]',
          status: 400,
          title: "Bad Request",
          type: "about:blank",
        });
        expect(response.status).toBe(400);
      });

      it("should throw an error if the issuer DID is not a valid EBSI DID", async () => {
        expect.assertions(2);

        const response = await request(server).get(
          `/issuers/did:ebsi:z1234?version=${version}`,
        );

        expect(response.body).toStrictEqual({
          detail: '["did must be a valid DID v1"]',
          status: 400,
          title: "Bad Request",
          type: "about:blank",
        });
        expect(response.status).toBe(400);
      });

      it("should throw an error if the issuer is not found", async () => {
        expect.assertions(2);

        const response = await request(server).get(
          `/issuers/${randomDid}?version=${version}`,
        );

        expect(response.body).toStrictEqual({
          detail: `Issuer ${randomDid} not found`,
          status: 404,
          title: "Issuer Not Found",
          type: "about:blank",
        });
        expect(response.status).toBe(404);
      });
    },
  );

  describe("/issuers/{did}/attributes", () => {
    it("should return the attributes from a specific issuer", async () => {
      expect.assertions(2);

      const response: SupertestAttributesResponse = await request(server).get(
        `/issuers/${lastExistingIssuerDid}/attributes`,
      );

      expect(response.body).toStrictEqual(
        expect.objectContaining({
          items: expect.arrayContaining([]),
          links: expect.objectContaining({
            first: expect.stringContaining(
              `/trusted-issuers-registry/v5/issuers/${lastExistingIssuerDid}/attributes?page[after]=1&page[size]=10`,
            ),
            last: expect.stringContaining(
              `/trusted-issuers-registry/v5/issuers/${lastExistingIssuerDid}/attributes?page[after]=`,
            ),
            next: expect.stringContaining(
              `/trusted-issuers-registry/v5/issuers/${lastExistingIssuerDid}/attributes?page[after]=`,
            ),
            prev: expect.stringContaining(
              `/trusted-issuers-registry/v5/issuers/${lastExistingIssuerDid}/attributes?page[after]=1&page[size]=10`,
            ),
          }),
          pageSize: expect.any(Number),
          self: expect.stringContaining(
            `/trusted-issuers-registry/v5/issuers/${lastExistingIssuerDid}/attributes?page[after]=1&page[size]=10`,
          ),
          total: expect.any(Number),
        }),
      );
      expect(response.status).toBe(200);
    });

    it("should throw an error if the issuer DID is not correctly formatted", async () => {
      expect.assertions(2);

      const response = await request(server).get(
        "/issuers/not-a-did/attributes",
      );

      expect(response.body).toStrictEqual({
        detail: '["did must be a valid DID v1"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
    });

    it("should throw an error if the issuer DID is not a valid EBSI DID", async () => {
      expect.assertions(2);

      const response = await request(server).get(
        "/issuers/did:ebsi:z1234/attributes",
      );

      expect(response.body).toStrictEqual({
        detail: '["did must be a valid DID v1"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
    });

    it("should throw an error if the issuer is not found", async () => {
      expect.assertions(2);

      const response = await request(server).get(
        `/issuers/${randomDid}/attributes`,
      );

      expect(response.body).toStrictEqual({
        detail: `Issuer ${randomDid} not found`,
        status: 404,
        title: "Issuer Not Found",
        type: "about:blank",
      });
      expect(response.status).toBe(404);
    });
  });

  describe("/issuers/{did}/attributes/{attributeId}", () => {
    let attributeId: string;

    beforeAll(async () => {
      const responseAttributes: SupertestAttributesResponse = await request(
        server,
      ).get(`/issuers/${lastExistingIssuerDid}/attributes`);

      attributeId = responseAttributes.body.items[0]!.id;
    });

    it("should return a specific attribute", async () => {
      expect.assertions(2);

      const response: SupertestAttributeResponse = await request(server).get(
        `/issuers/${lastExistingIssuerDid}/attributes/${attributeId}`,
      );
      expect(response.body).toStrictEqual({
        attribute: {
          body: expect.any(String),
          hash: expect.any(String),
          issuerType: expect.any(String),
          rootTao: expect.any(String),
          tao: expect.any(String),
        },
        did: lastExistingIssuerDid,
      });
      expect(response.status).toBe(200);
    });

    it("should throw an error if the issuer DID is not correctly formatted", async () => {
      expect.assertions(2);

      const response = await request(server).get(
        `/issuers/not-a-did/attributes/${attributeId}`,
      );

      expect(response.body).toStrictEqual({
        detail: '["did must be a valid DID v1"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
    });

    it("should throw an error if the issuer DID is not a valid EBSI DID", async () => {
      expect.assertions(2);

      const response = await request(server).get(
        `/issuers/did:ebsi:z1234/attributes/${attributeId}`,
      );

      expect(response.body).toStrictEqual({
        detail: '["did must be a valid DID v1"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
    });

    it("should throw an error if the issuer is not found", async () => {
      expect.assertions(2);

      const response = await request(server).get(
        `/issuers/${randomDid}/attributes/${attributeId}`,
      );

      expect(response.body).toStrictEqual({
        detail: `Issuer ${randomDid} not found`,
        status: 404,
        title: "Issuer Not Found",
        type: "about:blank",
      });
      expect(response.status).toBe(404);
    });

    it("should throw an error when attribute is not found", async () => {
      expect.assertions(5);

      // consult a random attribute
      const wrongAttributeId =
        "0x31a014c390aa9ad2b47a1df8904c8addf87db279b06eae50797f546da63229d2";
      const response: SupertestAttributeResponse = await request(server).get(
        `/issuers/${lastExistingIssuerDid}/attributes/${wrongAttributeId}`,
      );
      expect(response.body).toStrictEqual({
        detail: expect.stringContaining(
          `Attribute ${wrongAttributeId} not found`,
        ),
        status: 404,
        title: "Attribute Not Found",
        type: "about:blank",
      });
      expect(response.status).toBe(404);

      // consult an attribute from a different did
      const responseAttributes: SupertestAttributesResponse = await request(
        server,
      ).get(`/issuers/${beforeLastExistingIssuerDid}/attributes`);
      expect(responseAttributes.status).toBe(200);

      const attributeId2 = responseAttributes.body.items[0]!.id;

      const response2: SupertestAttributeResponse = await request(server).get(
        `/issuers/${lastExistingIssuerDid}/attributes/${attributeId2}`,
      );
      expect(response2.body).toStrictEqual({
        detail: expect.stringContaining(`Attribute ${attributeId2} not found`),
        status: 404,
        title: "Attribute Not Found",
        type: "about:blank",
      });
      expect(response2.status).toBe(404);
    });
  });

  describe.each(["latest", "deprecated"] as const)(
    "/issuers/{did}/attributes/{attributeId}/revisions (version: %s)",
    (version) => {
      let attributeId: string;

      beforeAll(async () => {
        const responseAttributes: SupertestAttributesResponse = await request(
          server,
        ).get(`/issuers/${lastExistingIssuerDid}/attributes`);

        attributeId = responseAttributes.body.items[0]!.id;
      });

      it("should return revisions", async () => {
        expect.assertions(3);

        const urlPath = `/trusted-issuers-registry/v5/issuers/${lastExistingIssuerDid}/attributes/${attributeId}/revisions`;

        const response = await request(server).get(
          `/issuers/${lastExistingIssuerDid}/attributes/${attributeId}/revisions?version=${version}`,
        );
        expect(response.body).toStrictEqual({
          items: expect.arrayContaining([]),
          links: {
            first: expect.stringContaining(urlPath),
            last: expect.stringContaining(urlPath),
            next: expect.stringContaining(urlPath),
            prev: expect.stringContaining(urlPath),
          },
          pageSize: expect.any(Number),
          self: expect.stringContaining(urlPath),
          total: expect.any(Number),
        });
        expect(response.status).toBe(200);

        if (version === "latest") {
          expect((response.body as { items: unknown }).items).toStrictEqual(
            expect.arrayContaining([
              expect.objectContaining({
                href: expect.any(String),
                id: expect.any(String),
              }),
            ]),
          );
        } else {
          expect((response.body as { items: unknown }).items).toStrictEqual(
            expect.arrayContaining([
              expect.objectContaining({
                body: expect.any(String),
                hash: expect.any(String),
                issuerType: expect.any(String),
                rootTao: expect.any(String),
                tao: expect.any(String),
              }),
            ]),
          );
        }
      });

      it("should throw an error if the issuer DID is not correctly formatted", async () => {
        expect.assertions(2);

        const response = await request(server).get(
          `/issuers/not-a-did/attributes/${attributeId}/revisions?version=${version}`,
        );

        expect(response.body).toStrictEqual({
          detail: '["did must be a valid DID v1"]',
          status: 400,
          title: "Bad Request",
          type: "about:blank",
        });
        expect(response.status).toBe(400);
      });

      it("should throw an error if the issuer DID is not a valid EBSI DID", async () => {
        expect.assertions(2);

        const response = await request(server).get(
          `/issuers/did:ebsi:z1234/attributes/${attributeId}/revisions?version=${version}`,
        );

        expect(response.body).toStrictEqual({
          detail: '["did must be a valid DID v1"]',
          status: 400,
          title: "Bad Request",
          type: "about:blank",
        });
        expect(response.status).toBe(400);
      });

      it("should throw an error if the issuer is not found", async () => {
        expect.assertions(2);

        const response = await request(server).get(
          `/issuers/${randomDid}/attributes/${attributeId}/revisions?version=${version}`,
        );

        expect(response.body).toStrictEqual({
          detail: `Issuer ${randomDid} not found`,
          status: 404,
          title: "Issuer Not Found",
          type: "about:blank",
        });
        expect(response.status).toBe(404);
      });

      it("should throw an error when attribute is not found", async () => {
        expect.assertions(5);

        // consult a random attribute
        const wrongAttributeId =
          "0x31a014c390aa9ad2b47a1df8904c8addf87db279b06eae50797f546da63229d2";
        const response: SupertestAttributeResponse = await request(server).get(
          `/issuers/${lastExistingIssuerDid}/attributes/${wrongAttributeId}/revisions?version=${version}`,
        );
        expect(response.body).toStrictEqual({
          detail: expect.stringContaining(
            `Attribute ${wrongAttributeId} not found`,
          ),
          status: 404,
          title: "Attribute Not Found",
          type: "about:blank",
        });
        expect(response.status).toBe(404);

        // consult an attribute from a different did
        const responseAttributes: SupertestAttributesResponse = await request(
          server,
        ).get(`/issuers/${beforeLastExistingIssuerDid}/attributes`);
        expect(responseAttributes.status).toBe(200);

        const attributeId2 = responseAttributes.body.items[0]!.id;

        const response2: SupertestAttributeResponse = await request(server).get(
          `/issuers/${lastExistingIssuerDid}/attributes/${attributeId2}/revisions?version=${version}`,
        );
        expect(response2.body).toStrictEqual({
          detail: expect.stringContaining(
            `Attribute ${attributeId2} not found`,
          ),
          status: 404,
          title: "Attribute Not Found",
          type: "about:blank",
        });
        expect(response2.status).toBe(404);
      });
    },
  );

  describe("/issuers/{did}/attributes/{attributeId}/revisions/{revisionId}", () => {
    let attributeId: string;
    let revisionId: string;

    beforeAll(async () => {
      const responseAttributes: SupertestAttributesResponse = await request(
        server,
      ).get(`/issuers/${lastExistingIssuerDid}/attributes`);

      attributeId = responseAttributes.body.items[0]!.id;

      const responseRevisions: SupertestAttributesResponse = await request(
        server,
      ).get(
        `/issuers/${lastExistingIssuerDid}/attributes/${attributeId}/revisions`,
      );

      revisionId = responseRevisions.body.items[0]!.id;
    });

    it("should return a specific revision", async () => {
      expect.assertions(2);

      const response: SupertestAttributeResponse = await request(server).get(
        `/issuers/${lastExistingIssuerDid}/attributes/${attributeId}/revisions/${revisionId}`,
      );
      expect(response.body).toStrictEqual({
        attribute: {
          body: expect.any(String),
          hash: expect.any(String),
          issuerType: expect.any(String),
          rootTao: expect.any(String),
          tao: expect.any(String),
        },
        did: lastExistingIssuerDid,
      });
      expect(response.status).toBe(200);
    });

    it("should throw an error if the issuer DID is not correctly formatted", async () => {
      expect.assertions(2);

      const response = await request(server).get(
        `/issuers/not-a-did/attributes/${attributeId}/revisions/${revisionId}`,
      );

      expect(response.body).toStrictEqual({
        detail: '["did must be a valid DID v1"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
    });

    it("should throw an error if the issuer DID is not a valid EBSI DID", async () => {
      expect.assertions(2);

      const response = await request(server).get(
        `/issuers/did:ebsi:z1234/attributes/${attributeId}/revisions/${revisionId}`,
      );

      expect(response.body).toStrictEqual({
        detail: '["did must be a valid DID v1"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
    });

    it("should throw an error if the issuer is not found", async () => {
      expect.assertions(2);

      const response = await request(server).get(
        `/issuers/${randomDid}/attributes/${attributeId}/revisions/${revisionId}`,
      );

      expect(response.body).toStrictEqual({
        detail: `Issuer ${randomDid} not found`,
        status: 404,
        title: "Issuer Not Found",
        type: "about:blank",
      });
      expect(response.status).toBe(404);
    });

    it("should throw an error when attribute is not found", async () => {
      expect.assertions(5);

      // consult a random attribute
      const wrongAttributeId =
        "0x31a014c390aa9ad2b47a1df8904c8addf87db279b06eae50797f546da63229d2";
      const response: SupertestAttributeResponse = await request(server).get(
        `/issuers/${lastExistingIssuerDid}/attributes/${wrongAttributeId}/revisions/${revisionId}`,
      );
      expect(response.body).toStrictEqual({
        detail: expect.stringContaining(
          `Attribute ${wrongAttributeId} not found`,
        ),
        status: 404,
        title: "Attribute Not Found",
        type: "about:blank",
      });
      expect(response.status).toBe(404);

      // consult an attribute from a different did
      const responseAttributes: SupertestAttributesResponse = await request(
        server,
      ).get(`/issuers/${beforeLastExistingIssuerDid}/attributes`);
      expect(responseAttributes.status).toBe(200);

      const attributeId2 = responseAttributes.body.items[0]!.id;

      const response2: SupertestAttributeResponse = await request(server).get(
        `/issuers/${lastExistingIssuerDid}/attributes/${attributeId2}/revisions/${revisionId}`,
      );
      expect(response2.body).toStrictEqual({
        detail: expect.stringContaining(`Attribute ${attributeId2} not found`),
        status: 404,
        title: "Attribute Not Found",
        type: "about:blank",
      });
      expect(response2.status).toBe(404);
    });

    it("should throw an error when revision is not found", async () => {
      expect.assertions(2);

      // consult a random attribute
      const wrongRevisionId =
        "0x31a014c390aa9ad2b47a1df8904c8addf87db279b06eae50797f546da63229d2";
      const response: SupertestAttributeResponse = await request(server).get(
        `/issuers/${lastExistingIssuerDid}/attributes/${attributeId}/revisions/${wrongRevisionId}`,
      );
      expect(response.body).toStrictEqual({
        detail: expect.stringContaining(
          `Revision ${wrongRevisionId} not found`,
        ),
        status: 404,
        title: "Revision Not Found",
        type: "about:blank",
      });
      expect(response.status).toBe(404);
    });
  });

  describe("/issuers/{did}/proxies", () => {
    it("should return the proxies from a specific issuer", async () => {
      expect.assertions(2);

      const response: SupertestIssuerProxiesResponse = await request(
        server,
      ).get(`/issuers/${testIssuerWithProxyDid}/proxies`);

      const url = `/trusted-issuers-registry/v5/issuers/${testIssuerWithProxyDid}/proxies`;
      expect(response.body).toStrictEqual(
        expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({
              href: expect.stringContaining(`${url}/0x`),
              proxyId: expect.stringContaining("0x"),
            }),
          ]),
          links: {
            first: expect.stringContaining(
              `${url}?page[after]=1&page[size]=10`,
            ),
            last: expect.stringContaining(`${url}?page[after]=`),
            next: expect.stringContaining(`${url}?page[after]=`),
            prev: expect.stringContaining(`${url}?page[after]=1&page[size]=10`),
          },
          pageSize: 10,
          self: expect.stringContaining(`${url}?page[after]=1&page[size]=10`),
          total: expect.any(Number),
        }),
      );
      expect(response.status).toBe(200);
    });

    it("should throw an error if the issuer DID is not correctly formatted", async () => {
      expect.assertions(2);

      const response = await request(server).get("/issuers/not-a-did/proxies");

      expect(response.body).toStrictEqual({
        detail: '["did must be a valid DID v1"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
    });

    it("should throw an error if the issuer DID is not a valid EBSI DID", async () => {
      expect.assertions(2);

      const response = await request(server).get(
        "/issuers/did:ebsi:z1234/proxies",
      );

      expect(response.body).toStrictEqual({
        detail: '["did must be a valid DID v1"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
    });

    it("should throw an error if the issuer is not found", async () => {
      expect.assertions(2);

      const response = await request(server).get(
        `/issuers/${randomDid}/proxies`,
      );

      expect(response.body).toStrictEqual({
        detail: `Issuer ${randomDid} not found`,
        status: 404,
        title: "Issuer Not Found",
        type: "about:blank",
      });
      expect(response.status).toBe(404);
    });
  });

  describe("/issuers/{did}/proxies/{proxyId}", () => {
    it("should return the proxy from a specific issuer", async () => {
      expect.assertions(2);

      const response: SupertestIssuerProxyResponse = await request(server).get(
        `/issuers/${testIssuerWithProxyDid}/proxies/${testIssuerWithProxyFirstProxyId}`,
      );

      expect(response.body).toStrictEqual({
        headers: expect.any(Object),
        prefix: expect.any(String),
        testSuffix: expect.any(String),
      });
      expect(response.status).toBe(200);
    });

    it("should throw an error if the issuer DID is not correctly formatted", async () => {
      expect.assertions(2);

      const response = await request(server).get(
        `/issuers/not-a-did/proxies/${testIssuerWithProxyFirstProxyId}`,
      );

      expect(response.body).toStrictEqual({
        detail: '["did must be a valid DID v1"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
    });

    it("should throw an error if the issuer DID is not a valid EBSI DID", async () => {
      expect.assertions(2);

      const response = await request(server).get(
        `/issuers/did:ebsi:z1234/proxies/${testIssuerWithProxyFirstProxyId}`,
      );

      expect(response.body).toStrictEqual({
        detail: '["did must be a valid DID v1"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
    });

    it("should throw an error if the issuer is not found", async () => {
      expect.assertions(2);

      const response = await request(server).get(
        `/issuers/${randomDid}/proxies/${testIssuerWithProxyFirstProxyId}`,
      );

      expect(response.body).toStrictEqual({
        detail: `Issuer ${randomDid} not found`,
        status: 404,
        title: "Issuer Not Found",
        type: "about:blank",
      });
      expect(response.status).toBe(404);
    });

    it("should throw an error if the proxy is not found", async () => {
      expect.assertions(2);

      const invalidProxyId = `0x${crypto.randomBytes(32).toString("hex")}`;

      const response = await request(server).get(
        `/issuers/${testIssuerWithProxyDid}/proxies/${invalidProxyId}`,
      );

      expect(response.body).toStrictEqual({
        detail: `Proxy ${invalidProxyId} of issuer ${testIssuerWithProxyDid} can't be found`,
        status: 404,
        title: "Proxy Not Found",
        type: "about:blank",
      });
      expect(response.status).toBe(404);
    });
  });

  describe("/issuers/{did}/proxies/{proxyId}/{path}", () => {
    const path = "/creds/1";

    // All the tests that require a mock server are run only locally
    describeLocalTestEnvOnly()("with mocked issuer's endpoint", () => {
      let proxy: IssuerProxyResponseObject;
      const mockServer = setupServer();

      beforeAll(async () => {
        // Intercept network requests
        mockServer.listen({
          onUnhandledRequest: "bypass",
        });

        // Get first proxy information
        const response: SupertestIssuerProxyResponse = await request(
          server,
        ).get(
          `/issuers/${testIssuerWithProxyDid}/proxies/${testIssuerWithProxyFirstProxyId}`,
        );
        proxy = response.body;
      });

      afterEach(() => {
        mockServer.resetHandlers();
      });

      afterAll(() => {
        mockServer.close();
      });

      describe.each([
        "StatusList2021Credential",
        "BitstringStatusListCredential",
        "BitstringStatusListCredentialVCDM2.0",
      ] as const)("with status list type %s", (statusList) => {
        it.each(["URL", "EBSI URI"] as const)(
          `should return a ${statusList} JWT (using %s as resource locator)`,
          async (uriType) => {
            expect.assertions(2);

            // Mock issuer's endpoint response
            const ebsiEnvConfig = configService.get("ebsiEnvConfig", {
              infer: true,
            });

            const testIssuerWithProxy = getEbsiIssuer(
              testIssuerWithProxyPrivateKey,
              testIssuerWithProxyDid,
              testIssuerWithProxyKid,
            );

            const statusListCredentialJwt = await createStatusListCredentialJwt(
              testIssuerWithProxy,
              proxy,
              ebsiEnvConfig,
              uriType,
              statusList,
            );

            mockServer.use(
              http.get(escapeDid(`${proxy.prefix}${path}`), () =>
                HttpResponse.json(statusListCredentialJwt),
              ),
            );

            const response: SupertestStringResponse = await request(server).get(
              `/issuers/${testIssuerWithProxyDid}/proxies/${testIssuerWithProxyFirstProxyId}${path}`,
            );

            expect(response.text).toStrictEqual(statusListCredentialJwt);
            expect(response.status).toBe(200);
          },
        );

        it("should return an error 500 when the Trusted Issuer's endpoint respond with a 500", async () => {
          expect.assertions(2);

          // Mock issuer's endpoint response
          mockServer.use(
            http.get(
              escapeDid(`${proxy.prefix}${path}`),
              () => new HttpResponse(undefined, { status: 500 }),
            ),
          );

          const response = await request(server).get(
            `/issuers/${testIssuerWithProxyDid}/proxies/${testIssuerWithProxyFirstProxyId}${path}`,
          );

          expect(response.body).toStrictEqual({
            detail: "The Status List Credential can't be retrieved",
            status: 500,
            title: "Unreachable Status List Credential",
            type: "about:blank",
          });
          expect(response.status).toBe(500);
        });

        it(`should return an error 500 when the Trusted Issuer's endpoint respond with an invalid ${statusList}`, async () => {
          expect.assertions(2);

          // Mock issuer's endpoint response
          mockServer.use(
            http.get(escapeDid(`${proxy.prefix}${path}`), () =>
              HttpResponse.text("invalid jwt"),
            ),
          );

          const response = await request(server).get(
            `/issuers/${testIssuerWithProxyDid}/proxies/${testIssuerWithProxyFirstProxyId}${path}`,
          );

          expect(response.body).toStrictEqual({
            detail:
              "The Status List Credential returned by the Issuer's proxy is not a JWT",
            status: 500,
            title: "Invalid Status List Credential",
            type: "about:blank",
          });
          expect(response.status).toBe(500);
        });
      });
    });

    it("should throw an error if the issuer DID is not correctly formatted", async () => {
      expect.assertions(2);

      const response = await request(server).get(
        `/issuers/not-a-did/proxies/${testIssuerWithProxyFirstProxyId}${path}`,
      );

      expect(response.body).toStrictEqual({
        detail: '["did must be a valid DID v1"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
    });

    it("should throw an error if the issuer DID is not a valid EBSI DID", async () => {
      expect.assertions(2);

      const response = await request(server).get(
        `/issuers/did:ebsi:z1234/proxies/${testIssuerWithProxyFirstProxyId}${path}`,
      );

      expect(response.body).toStrictEqual({
        detail: '["did must be a valid DID v1"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
    });

    it("should throw an error if the issuer is not found", async () => {
      expect.assertions(2);

      const response = await request(server).get(
        `/issuers/${randomDid}/proxies/${testIssuerWithProxyFirstProxyId}${path}`,
      );

      expect(response.body).toStrictEqual({
        detail: `Issuer ${randomDid} not found`,
        status: 404,
        title: "Issuer Not Found",
        type: "about:blank",
      });
      expect(response.status).toBe(404);
    });

    it("should throw an error if the proxy is not found", async () => {
      expect.assertions(2);

      const invalidProxyId = `0x${crypto.randomBytes(32).toString("hex")}`;

      const response = await request(server).get(
        `/issuers/${testIssuerWithProxyDid}/proxies/${invalidProxyId}${path}`,
      );

      expect(response.body).toStrictEqual({
        detail: `Proxy ${invalidProxyId} of issuer ${testIssuerWithProxyDid} can't be found`,
        status: 404,
        title: "Proxy Not Found",
        type: "about:blank",
      });
      expect(response.status).toBe(404);
    });
  });
});
