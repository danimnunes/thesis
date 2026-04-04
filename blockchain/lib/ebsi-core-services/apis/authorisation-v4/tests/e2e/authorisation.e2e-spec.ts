import type {
  EbsiEnvConfiguration,
  EbsiIssuer,
} from "@europeum-ebsi/verifiable-credential";
import type { Schemas } from "@europeum-ebsi/verifiable-presentation/vcdm11.js";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { PresentationSubmission } from "@sphereon/pex-models";
import type { RawServerDefault } from "fastify";
import type { JWK } from "jose";

import { getSigner } from "@ebsiint-api/shared";
import {
  createJWT,
  decodeJWT,
  ES256KSigner,
  hexToBytes,
} from "@europeum-ebsi/did-jwt";
import { fromUrl } from "@europeum-ebsi/ebsi-uri";
import { createVerifiableCredentialJwt } from "@europeum-ebsi/verifiable-credential/vcdm11.js";
import { createVerifiablePresentationJwt } from "@europeum-ebsi/verifiable-presentation/vcdm11.js";
import { EbsiWallet } from "@europeum-ebsi/wallet-lib";
import { ConfigService } from "@nestjs/config";
import { calculateJwkThumbprint, importJWK, jwtVerify } from "jose";
import { randomBytes, randomUUID } from "node:crypto";
import { URLSearchParams } from "node:url";
import qs from "qs";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { ApiConfig } from "../../src/config/configuration.ts";
import type {
  JsonWebKeySet,
  Scope,
  TokenResponse,
} from "../../src/modules/authorisation/authorisation.interfaces.ts";

import { AppModule } from "../../src/app.module.ts";
import {
  CUSTOM_SCOPES,
  DIDR_INVITE_PRESENTATION_DEFINITION,
  DIDR_INVITE_SCOPE,
  DIDR_WRITE_PRESENTATION_DEFINITION,
  DIDR_WRITE_SCOPE,
  LEDGER_INVOKE_PRESENTATION_DEFINITION,
  LEDGER_INVOKE_SCOPE,
  TIMESTAMP_WRITE_PRESENTATION_DEFINITION,
  TIMESTAMP_WRITE_SCOPE,
  TIR_INVITE_PRESENTATION_DEFINITION,
  TIR_INVITE_SCOPE,
  TIR_WRITE_PRESENTATION_DEFINITION,
  TIR_WRITE_SCOPE,
  TNT_AUTHORISE_PRESENTATION_DEFINITION,
  TNT_AUTHORISE_SCOPE,
  TNT_CREATE_PRESENTATION_DEFINITION,
  TNT_CREATE_SCOPE,
  TNT_WRITE_PRESENTATION_DEFINITION,
  TNT_WRITE_SCOPE,
  TPR_WRITE_PRESENTATION_DEFINITION,
  TPR_WRITE_SCOPE,
  TSR_WRITE_PRESENTATION_DEFINITION,
  TSR_WRITE_SCOPE,
} from "../../src/modules/authorisation/authorisation.constants.ts";
import { CreateAccessTokenDto } from "../../src/modules/authorisation/dto/index.ts";
import { getNestFastifyApplication } from "../utils/app.ts";
import {
  createLegalEntity,
  createNaturalPerson,
  createPresentationSubmission,
} from "../utils/data.ts";
import { getServer } from "../utils/getServer.ts";

describe("Authorisation  API v4 (e2e)", () => {
  let app: NestFastifyApplication;
  let server: RawServerDefault | string;
  let configService: ConfigService<ApiConfig, true>;
  let authorisationApiV4Url: string;
  let ebsiEnvConfig: EbsiEnvConfiguration;

  beforeAll(async () => {
    app = await getNestFastifyApplication({
      imports: [AppModule],
    });

    configService = app.get<ConfigService<ApiConfig, true>>(ConfigService);

    const testEnv = configService.get("testEnv", { infer: true });

    if (testEnv !== "remote") {
      await app.init();
      const fastifyInstance = app.getHttpAdapter().getInstance();
      await fastifyInstance.ready();
    }

    server = getServer(app, configService);

    const domain = configService.get("domain", { infer: true });
    const apiUrlPrefix = configService.get("apiUrlPrefix", { infer: true });
    authorisationApiV4Url = `${domain}${apiUrlPrefix}`;
    ebsiEnvConfig = configService.get("ebsiEnvConfig");
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /.well-known/openid-configuration", () => {
    it("should return the well-known OpenID configuration", async () => {
      expect.assertions(2);

      const response = await request(server).get(
        "/.well-known/openid-configuration",
      );

      expect(response.body).toStrictEqual({
        authorization_endpoint: `${authorisationApiV4Url}/authorize`,
        grant_types_supported: ["vp_token"],
        id_token_signing_alg_values_supported: ["none"],
        id_token_types_supported: ["subject_signed_id_token"],
        issuer: expect.any(String),
        jwks_uri: `${authorisationApiV4Url}/jwks`,
        presentation_definition_endpoint: `${authorisationApiV4Url}/presentation-definitions`,
        response_types_supported: ["token"],
        scopes_supported: ["openid", ...CUSTOM_SCOPES],
        subject_syntax_types_supported: ["did:ebsi", "did:key"],
        subject_trust_frameworks_supported: ["ebsi"],
        subject_types_supported: ["public"],
        token_endpoint: `${authorisationApiV4Url}/token`,
        token_endpoint_auth_methods_supported: ["private_key_jwt"],
        vp_formats_supported: {
          jwt_vc: {
            alg_values_supported: ["ES256"],
          },
          jwt_vc_json: {
            alg_values_supported: ["ES256"],
          },
          jwt_vp: {
            alg_values_supported: ["ES256"],
          },
          jwt_vp_json: {
            alg_values_supported: ["ES256"],
          },
        },
      });

      expect(response.status).toBe(200);
    });
  });

  describe("GET /jwks", () => {
    it("should return the OP's JWKS", async () => {
      expect.assertions(4);

      const response = await request(server).get("/jwks");

      expect(response.body).toStrictEqual({
        keys: expect.arrayContaining([
          {
            alg: "ES256",
            crv: "P-256",
            kid: expect.any(String),
            kty: "EC",
            x: expect.any(String),
            y: expect.any(String),
          },
        ]),
      });
      expect(
        (response.headers as Record<string, unknown>)["content-type"],
      ).toBe("application/jwk-set+json; charset=utf-8");
      expect(response.status).toBe(200);

      const jwk = (response.body as { keys: JWK[] }).keys[0]!;
      const thumbprint = await calculateJwkThumbprint(jwk);

      expect(jwk.kid).toBe(thumbprint);
    });
  });

  describe("GET /presentation-definitions", () => {
    it("should return an error if the scope is invalid", async () => {
      expect.assertions(2);

      const response = await request(server).get(
        "/presentation-definitions?scope=test",
      );

      expect(response.body).toStrictEqual({
        detail: `["scope must be a combination of 'openid' and one of the supported scopes ('didr_invite', 'didr_write', 'ledger_invoke', 'tir_invite', 'tir_write', 'timestamp_write', 'tnt_authorise', 'tnt_create', 'tnt_write', 'tpr_write', 'tsr_write')"]`,
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
    });

    it("should return the expected presentation definition for the given scope", async () => {
      expect.assertions(22);

      //  With explicit scope "openid didr_invite"
      let response = await request(server).get(
        `/presentation-definitions?scope=${encodeURIComponent(
          `openid ${DIDR_INVITE_SCOPE}`,
        )}`,
      );

      expect(response.body).toStrictEqual(DIDR_INVITE_PRESENTATION_DEFINITION);
      expect(response.status).toBe(200);

      // With explicit scope "openid didr_write"
      response = await request(server).get(
        `/presentation-definitions?scope=${encodeURIComponent(
          `openid ${DIDR_WRITE_SCOPE}`,
        )}`,
      );

      expect(response.body).toStrictEqual(DIDR_WRITE_PRESENTATION_DEFINITION);
      expect(response.status).toBe(200);

      // With explicit scope "openid ledger_invoke"
      response = await request(server).get(
        `/presentation-definitions?scope=${encodeURIComponent(
          `openid ${LEDGER_INVOKE_SCOPE}`,
        )}`,
      );

      expect(response.body).toStrictEqual(
        LEDGER_INVOKE_PRESENTATION_DEFINITION,
      );
      expect(response.status).toBe(200);

      // With explicit scope "openid tir_invite"
      response = await request(server).get(
        `/presentation-definitions?scope=${encodeURIComponent(
          `openid ${TIR_INVITE_SCOPE}`,
        )}`,
      );

      expect(response.body).toStrictEqual(TIR_INVITE_PRESENTATION_DEFINITION);
      expect(response.status).toBe(200);

      // With explicit scope "openid tir_write"
      response = await request(server).get(
        `/presentation-definitions?scope=${encodeURIComponent(
          `openid ${TIR_WRITE_SCOPE}`,
        )}`,
      );

      expect(response.body).toStrictEqual(TIR_WRITE_PRESENTATION_DEFINITION);
      expect(response.status).toBe(200);

      // With explicit scope "openid timestamp_write"
      response = await request(server).get(
        `/presentation-definitions?scope=${encodeURIComponent(
          `openid ${TIMESTAMP_WRITE_SCOPE}`,
        )}`,
      );

      expect(response.body).toStrictEqual(
        TIMESTAMP_WRITE_PRESENTATION_DEFINITION,
      );
      expect(response.status).toBe(200);

      // With explicit scope "openid tnt_authorise"
      response = await request(server).get(
        `/presentation-definitions?scope=${encodeURIComponent(
          `openid ${TNT_AUTHORISE_SCOPE}`,
        )}`,
      );

      expect(response.body).toStrictEqual(
        TNT_AUTHORISE_PRESENTATION_DEFINITION,
      );
      expect(response.status).toBe(200);

      // With explicit scope "openid tnt_create"
      response = await request(server).get(
        `/presentation-definitions?scope=${encodeURIComponent(
          `openid ${TNT_CREATE_SCOPE}`,
        )}`,
      );

      expect(response.body).toStrictEqual(TNT_CREATE_PRESENTATION_DEFINITION);
      expect(response.status).toBe(200);

      // With explicit scope "openid tnt_write"
      response = await request(server).get(
        `/presentation-definitions?scope=${encodeURIComponent(
          `openid ${TNT_WRITE_SCOPE}`,
        )}`,
      );

      const tntWritePresentationDefinition = structuredClone(
        TNT_WRITE_PRESENTATION_DEFINITION,
      );
      expect(response.body).toStrictEqual(tntWritePresentationDefinition);
      expect(response.status).toBe(200);

      // With explicit scope "openid tpr_write"
      response = await request(server).get(
        `/presentation-definitions?scope=${encodeURIComponent(
          `openid ${TPR_WRITE_SCOPE}`,
        )}`,
      );

      const tprWritePresentationDefinition = structuredClone(
        TPR_WRITE_PRESENTATION_DEFINITION,
      );
      expect(response.body).toStrictEqual(tprWritePresentationDefinition);
      expect(response.status).toBe(200);

      // With explicit scope "openid tsr_write"
      response = await request(server).get(
        `/presentation-definitions?scope=${encodeURIComponent(
          `openid ${TSR_WRITE_SCOPE}`,
        )}`,
      );

      const tsrWritePresentationDefinition = structuredClone(
        TSR_WRITE_PRESENTATION_DEFINITION,
      );
      expect(response.body).toStrictEqual(tsrWritePresentationDefinition);
      expect(response.status).toBe(200);
    });
  });

  describe("POST /token", () => {
    it("should return an error if the grant_type is invalid", async () => {
      expect.assertions(3);

      const response = await request(server)
        .post("/token")
        .set("Content-Type", "application/x-www-form-urlencoded")
        .send(
          new URLSearchParams({
            grant_type: "test",
          }).toString(),
        );

      expect(response.body).toStrictEqual({
        error: "invalid_request",
        error_description: "grant_type must be equal to vp_token",
      });
      expect(response.status).toBe(400);
      expect(
        (response.headers as Record<string, unknown>)["content-type"],
      ).toBe("application/json; charset=utf-8");
    });

    it("should return an error if the scope is invalid", async () => {
      expect.assertions(3);

      const response = await request(server)
        .post("/token")
        .set("Content-Type", "application/x-www-form-urlencoded")
        .send(
          new URLSearchParams({
            grant_type: "vp_token",
            scope: "test",
          }).toString(),
        );

      expect(response.body).toStrictEqual({
        error: "invalid_request",
        error_description:
          "scope must be a combination of 'openid' and one of the supported scopes ('didr_invite', 'didr_write', 'ledger_invoke', 'tir_invite', 'tir_write', 'timestamp_write', 'tnt_authorise', 'tnt_create', 'tnt_write', 'tpr_write', 'tsr_write')",
      });
      expect(response.status).toBe(400);
      expect(
        (response.headers as Record<string, unknown>)["content-type"],
      ).toBe("application/json; charset=utf-8");
    });

    it("should return an error if the vp_token is invalid", async () => {
      expect.assertions(3);

      const response = await request(server)
        .post("/token")
        .set("Content-Type", "application/x-www-form-urlencoded")
        .send(
          new URLSearchParams({
            grant_type: "vp_token",
            scope: "openid didr_invite",
            vp_token: "test",
          }).toString(),
        );

      expect(response.body).toStrictEqual({
        error: "invalid_request",
        error_description: "vp_token must be a jwt string",
      });
      expect(response.status).toBe(400);
      expect(
        (response.headers as Record<string, unknown>)["content-type"],
      ).toBe("application/json; charset=utf-8");
    });

    describe.each(["EBSI URI", "URL"] as const)(
      "using %s as resource locator",
      (uriType) => {
        describe.each(CUSTOM_SCOPES)(
          "with scope 'openid %s'",
          (customScope) => {
            const scope: Scope = `openid ${customScope}`;

            describe.each([
              ["jwt_vp", "jwt_vc"],
              ["jwt_vp", "jwt_vc_json"],
              ["jwt_vp_json", "jwt_vc"],
              ["jwt_vp_json", "jwt_vc_json"],
            ] as const)(
              "and VP format '%s' and VC format '%s'",
              (vpFormat, vcFormat) => {
                let issuer: EbsiIssuer;
                let client: EbsiIssuer;
                let vcPayload: Schemas["Attestation"];
                let vpPayload: Schemas["Presentation"];
                let presentationSubmission: PresentationSubmission;
                let issuanceDate: Date;
                let expirationDate: Date;

                beforeAll(async () => {
                  const issuerKid = configService.get("testIssuerKid", {
                    infer: true,
                  });
                  if (!issuerKid)
                    throw new Error("TEST_ISSUER_KID must be defined");

                  const issuerAlg = configService.get("testIssuerAlg", {
                    infer: true,
                  });
                  if (!issuerAlg)
                    throw new Error("TEST_ISSUER_ALG must be defined");
                  // Only support ES256 issuer
                  if (issuerAlg !== "ES256") {
                    throw new Error("TEST_ISSUER_ALG must be ES256");
                  }

                  const issuerPrivateKey = configService.get(
                    "testIssuerPrivateKey",
                    {
                      infer: true,
                    },
                  );
                  if (!issuerPrivateKey) {
                    throw new Error("TEST_ISSUER_PRIVATE_KEY must be defined");
                  }

                  const issuerAttribute = configService.get(
                    "testIssuerAttribute",
                    {
                      infer: true,
                    },
                  );
                  if (!issuerAttribute) {
                    throw new Error("TEST_ISSUER_ATTRIBUTE must be defined");
                  }

                  issuer = {
                    alg: issuerAlg,
                    did: issuerKid.split("#")[0]!,
                    kid: issuerKid,
                    signer: getSigner(hexToBytes(issuerPrivateKey), issuerAlg),
                  };

                  if (
                    [
                      DIDR_INVITE_SCOPE,
                      TIR_INVITE_SCOPE,
                      TNT_AUTHORISE_SCOPE,
                    ].includes(customScope)
                  ) {
                    // client is a new LE
                    const legalEntity = await createLegalEntity(["ES256"]);
                    client = legalEntity.keys.ES256;
                  } else if (
                    customScope === TNT_CREATE_SCOPE ||
                    customScope === TNT_WRITE_SCOPE
                  ) {
                    const clientKid = configService.get(
                      "testTntAuthorisedUserKid",
                      {
                        infer: true,
                      },
                    );

                    if (!clientKid) {
                      throw new Error(
                        "TEST_TNT_AUTHORISED_USER_KID must be defined",
                      );
                    }

                    const clientPrivateKey = configService.get(
                      "testTntAuthorisedUserPrivateKey",
                      { infer: true },
                    );

                    if (!clientPrivateKey) {
                      throw new Error(
                        "TEST_TNT_AUTHORISED_USER_PRIVATE_KEY must be defined",
                      );
                    }

                    client = {
                      alg: "ES256K",
                      did: clientKid.split("#")[0]!,
                      kid: clientKid,
                      signer: getSigner(hexToBytes(clientPrivateKey), "ES256K"),
                    };
                  } else if (customScope === LEDGER_INVOKE_SCOPE) {
                    // client is a new NP
                    const naturalPerson = await createNaturalPerson("ES256");
                    client = naturalPerson.keys.ES256;
                  } else {
                    client = issuer;
                  }

                  issuanceDate = new Date(Date.now() - 5000); // issue 5 seconds ago
                  // JWT access token must have 2 hours expiration time and there are no Refresh Tokens.
                  expirationDate = new Date(
                    issuanceDate.getTime() + 2 * 60 * 60 * 1000,
                  );

                  const credentialSchemaUrl = configService.get(
                    "testOidSchemaPattern",
                    {
                      infer: true,
                    },
                  );

                  if (!credentialSchemaUrl) {
                    throw new Error("TEST_OID_SCHEMA_PATTERN is not defined");
                  }

                  // Note: in this test, the VC issuer is also the VC subject and the VP holder
                  vcPayload = {
                    "@context": ["https://www.w3.org/2018/credentials/v1"],
                    credentialSchema: {
                      id:
                        uriType === "EBSI URI"
                          ? fromUrl(credentialSchemaUrl, ebsiEnvConfig)
                          : credentialSchemaUrl,
                      type: "FullJsonSchemaValidator2021",
                    },
                    credentialSubject: { id: client.did, type: "same-device" },
                    expirationDate: `${expirationDate.toISOString().slice(0, -5)}Z`,
                    id: `urn:uuid:${randomUUID()}`,
                    issuanceDate: `${issuanceDate.toISOString().slice(0, -5)}Z`,
                    issued: `${issuanceDate.toISOString().slice(0, -5)}Z`,
                    issuer: issuer.did,
                    termsOfUse: {
                      id:
                        uriType === "EBSI URI"
                          ? fromUrl(issuerAttribute, ebsiEnvConfig)
                          : issuerAttribute,
                      type: "IssuanceCertificate",
                    },
                    type: ["VerifiableCredential", "VerifiableAttestation"],
                    validFrom: `${issuanceDate.toISOString().slice(0, -5)}Z`,
                  };

                  switch (customScope) {
                    case DIDR_INVITE_SCOPE:
                    case TNT_AUTHORISE_SCOPE: {
                      vcPayload.type.push("VerifiableAuthorisationToOnboard");
                      break;
                    }
                    case LEDGER_INVOKE_SCOPE: {
                      vcPayload.type.push("VerifiableAuthorisationToInvoke");
                      break;
                    }
                    case TIR_INVITE_SCOPE: {
                      vcPayload.type.push("VerifiableAccreditationToAccredit");
                      break;
                    }
                    // No default
                  }

                  vpPayload = {
                    "@context": ["https://www.w3.org/2018/credentials/v1"],
                    holder: client.did,
                    type: ["VerifiablePresentation"],
                    verifiableCredential: [],
                  };
                });

                beforeEach(() => {
                  // Reset to valid presentation submission before each test
                  presentationSubmission = createPresentationSubmission(
                    customScope,
                    vpFormat,
                    vcFormat,
                  );
                  // Reset to empty verifiable credential array before each test to allow each test to add its own verifiable credential
                  vpPayload.verifiableCredential = [];
                  vpPayload["id"] = randomUUID(); // VP ID is used as JWT JTI.
                });

                describe("vp_token validation", () => {
                  beforeEach(() => {
                    // Reset to empty verifiable credential array before each test to allow each test to add its own verifiable credential
                    vpPayload.verifiableCredential = [];
                    vpPayload["id"] = randomUUID(); // VP ID is used as JWT JTI.
                  });

                  it("should return an error the audience is not the service", async () => {
                    if (
                      [
                        DIDR_INVITE_SCOPE,
                        LEDGER_INVOKE_SCOPE,
                        TIR_INVITE_SCOPE,
                        TNT_AUTHORISE_SCOPE,
                      ].includes(customScope)
                    ) {
                      const vcJwt = await createVerifiableCredentialJwt(
                        vcPayload,
                        issuer,
                        ebsiEnvConfig,
                        {
                          skipValidation: true,
                        },
                      );

                      vpPayload.verifiableCredential.push(vcJwt);
                    }

                    const vpJwt = await createVerifiablePresentationJwt(
                      vpPayload,
                      client,
                      "authentication-service-v3",
                      ebsiEnvConfig,
                      {
                        exp: Math.floor(Date.now() / 1000) + 60, // Expires in 1 minute (less than the 5 minutes limit)
                        nbf: Math.floor(Date.now() / 1000) - 100,
                        nonce: randomUUID(),
                        skipValidation: true,
                      },
                    );

                    const response = await request(server)
                      .post("/token")
                      .set("Content-Type", "application/x-www-form-urlencoded")
                      .send(
                        new URLSearchParams({
                          grant_type: "vp_token",
                          presentation_submission: JSON.stringify(
                            presentationSubmission,
                          ),
                          scope,
                          vp_token: vpJwt,
                        } satisfies CreateAccessTokenDto).toString(),
                      );

                    expect(response.body).toStrictEqual({
                      error: "invalid_request",
                      error_description: `Invalid Verifiable Presentation: JWT "aud" property MUST match the expected audience "${authorisationApiV4Url}"`,
                    });
                    expect(response.status).toBe(400);
                    expect(
                      (response.headers as Record<string, unknown>)[
                        "content-type"
                      ],
                    ).toBe("application/json; charset=utf-8");
                  });

                  it("should return an error if sub is not the client's DID", async () => {
                    if (
                      [
                        DIDR_INVITE_SCOPE,
                        LEDGER_INVOKE_SCOPE,
                        TIR_INVITE_SCOPE,
                        TNT_AUTHORISE_SCOPE,
                      ].includes(customScope)
                    ) {
                      const vcJwt = await createVerifiableCredentialJwt(
                        vcPayload,
                        issuer,
                        ebsiEnvConfig,
                        {
                          skipValidation: true,
                        },
                      );

                      vpPayload.verifiableCredential.push(vcJwt);
                    }

                    const vpJwt = await createVerifiablePresentationJwt(
                      vpPayload,
                      client,
                      authorisationApiV4Url,
                      ebsiEnvConfig,
                      {
                        exp: Math.floor(Date.now() / 1000) + 60, // Expires in 1 minute (less than the 5 minutes limit)
                        nbf: Math.floor(Date.now() / 1000) - 100,
                        nonce: randomUUID(),
                        skipValidation: true,
                      },
                    );

                    // Fake a change in original vpJwt
                    const vpJwtDecoded = decodeJWT(vpJwt);
                    const anotherDid = EbsiWallet.createDid();
                    vpJwtDecoded.payload.sub = anotherDid;
                    const vpTokenTampered = createJWT(
                      vpJwtDecoded.payload,
                      {
                        signer: ES256KSigner(randomBytes(32)),
                      },
                      {
                        alg: "ES256K",
                        kid: client.kid,
                        typ: "JWT",
                      },
                    );

                    const response = await request(server)
                      .post("/token")
                      .set("Content-Type", "application/x-www-form-urlencoded")
                      .send(
                        new URLSearchParams({
                          grant_type: "vp_token",
                          presentation_submission: JSON.stringify(
                            presentationSubmission,
                          ),
                          scope,
                          vp_token: vpTokenTampered,
                        } satisfies CreateAccessTokenDto).toString(),
                      );

                    expect(response.body).toStrictEqual({
                      error: "invalid_request",
                      error_description: `Invalid Verifiable Presentation: JWT "sub" property MUST match the VP holder "${client.did}"`,
                    });
                    expect(response.status).toBe(400);
                    expect(
                      (response.headers as Record<string, unknown>)[
                        "content-type"
                      ],
                    ).toBe("application/json; charset=utf-8");
                  });

                  it("should return an error if the VP JWT has expired", async () => {
                    if (
                      [
                        DIDR_INVITE_SCOPE,
                        LEDGER_INVOKE_SCOPE,
                        TIR_INVITE_SCOPE,
                        TNT_AUTHORISE_SCOPE,
                      ].includes(customScope)
                    ) {
                      const vcJwt = await createVerifiableCredentialJwt(
                        vcPayload,
                        issuer,
                        ebsiEnvConfig,
                        {
                          skipValidation: true,
                        },
                      );

                      vpPayload.verifiableCredential.push(vcJwt);
                    }

                    const vpJwt = await createVerifiablePresentationJwt(
                      vpPayload,
                      client,
                      authorisationApiV4Url,
                      ebsiEnvConfig,
                      {
                        exp: Math.floor(Date.now() / 1000) - 100,
                        nbf: Math.floor(Date.now() / 1000) - 100,
                        nonce: randomUUID(),
                        skipValidation: true,
                      },
                    );

                    const response = await request(server)
                      .post("/token")
                      .set("Content-Type", "application/x-www-form-urlencoded")
                      .send(
                        new URLSearchParams({
                          grant_type: "vp_token",
                          presentation_submission: JSON.stringify(
                            presentationSubmission,
                          ),
                          scope,
                          vp_token: vpJwt,
                        } satisfies CreateAccessTokenDto).toString(),
                      );

                    expect(response.body).toStrictEqual({
                      error: "invalid_request",
                      error_description: "The vp_token has expired.",
                    });
                    expect(response.status).toBe(400);
                    expect(
                      (response.headers as Record<string, unknown>)[
                        "content-type"
                      ],
                    ).toBe("application/json; charset=utf-8");
                  });

                  it("should return an error if the VP JWT expires in more than 5 minutes", async () => {
                    if (
                      [
                        DIDR_INVITE_SCOPE,
                        LEDGER_INVOKE_SCOPE,
                        TIR_INVITE_SCOPE,
                        TNT_AUTHORISE_SCOPE,
                      ].includes(customScope)
                    ) {
                      const vcJwt = await createVerifiableCredentialJwt(
                        vcPayload,
                        issuer,
                        ebsiEnvConfig,
                        {
                          skipValidation: true,
                        },
                      );

                      vpPayload.verifiableCredential.push(vcJwt);
                    }

                    const vpJwt = await createVerifiablePresentationJwt(
                      vpPayload,
                      client,
                      authorisationApiV4Url,
                      ebsiEnvConfig,
                      {
                        exp: Math.floor(Date.now() / 1000) + 600, // Expires in 10 minutes, more than the 5 minutes limit
                        nbf: Math.floor(Date.now() / 1000) - 100,
                        nonce: randomUUID(),
                        skipValidation: true,
                      },
                    );

                    const response = await request(server)
                      .post("/token")
                      .set("Content-Type", "application/x-www-form-urlencoded")
                      .send(
                        new URLSearchParams({
                          grant_type: "vp_token",
                          presentation_submission: JSON.stringify(
                            presentationSubmission,
                          ),
                          scope,
                          vp_token: vpJwt,
                        } satisfies CreateAccessTokenDto).toString(),
                      );

                    expect(response.body).toStrictEqual({
                      error: "invalid_request",
                      error_description:
                        "The vp_token must not have an expiration time of more than 5 minutes in the future.",
                    });
                    expect(response.status).toBe(400);
                    expect(
                      (response.headers as Record<string, unknown>)[
                        "content-type"
                      ],
                    ).toBe("application/json; charset=utf-8");
                  });

                  it("should return an error if the VP JWT is not valid yet", async () => {
                    if (
                      [
                        DIDR_INVITE_SCOPE,
                        LEDGER_INVOKE_SCOPE,
                        TIR_INVITE_SCOPE,
                        TNT_AUTHORISE_SCOPE,
                      ].includes(customScope)
                    ) {
                      const vcJwt = await createVerifiableCredentialJwt(
                        vcPayload,
                        issuer,
                        ebsiEnvConfig,
                        {
                          skipValidation: true,
                        },
                      );

                      vpPayload.verifiableCredential.push(vcJwt);
                    }

                    const vpJwt = await createVerifiablePresentationJwt(
                      vpPayload,
                      client,
                      authorisationApiV4Url,
                      ebsiEnvConfig,
                      {
                        exp: Math.floor(Date.now() / 1000) + 120, // Expires in 2 minutes (less than the 5 minutes limit)
                        nbf: Math.floor(Date.now() / 1000) + 100,
                        nonce: randomUUID(),
                        skipValidation: true,
                      },
                    );

                    const response = await request(server)
                      .post("/token")
                      .set("Content-Type", "application/x-www-form-urlencoded")
                      .send(
                        new URLSearchParams({
                          grant_type: "vp_token",
                          presentation_submission: JSON.stringify(
                            presentationSubmission,
                          ),
                          scope,
                          vp_token: vpJwt,
                        } satisfies CreateAccessTokenDto).toString(),
                      );

                    expect(response.body).toStrictEqual({
                      error: "invalid_request",
                      error_description:
                        "Invalid Verifiable Presentation: JWT is not valid yet",
                    });
                    expect(response.status).toBe(400);
                    expect(
                      (response.headers as Record<string, unknown>)[
                        "content-type"
                      ],
                    ).toBe("application/json; charset=utf-8");
                  });

                  it("should return an error if nonce is not included in vp_token", async () => {
                    if (
                      [
                        DIDR_INVITE_SCOPE,
                        LEDGER_INVOKE_SCOPE,
                        TIR_INVITE_SCOPE,
                        TNT_AUTHORISE_SCOPE,
                      ].includes(customScope)
                    ) {
                      const vcJwt = await createVerifiableCredentialJwt(
                        vcPayload,
                        issuer,
                        ebsiEnvConfig,
                        {
                          skipValidation: true,
                        },
                      );

                      vpPayload.verifiableCredential.push(vcJwt);
                    }

                    const vpJwt = await createVerifiablePresentationJwt(
                      vpPayload,
                      client,
                      authorisationApiV4Url,
                      ebsiEnvConfig,
                      {
                        exp: Math.floor(Date.now() / 1000) + 60, // Expires in 1 minute (less than the 5 minutes limit)
                        // We don't add any nonce
                        nbf: Math.floor(Date.now() / 1000) - 100,
                        skipValidation: true,
                      },
                    );

                    // Try submitting a vp without neither a nonce.
                    const response = await request(server)
                      .post("/token")
                      .set("Content-Type", "application/x-www-form-urlencoded")
                      .send(
                        new URLSearchParams({
                          grant_type: "vp_token",
                          presentation_submission: JSON.stringify(
                            presentationSubmission,
                          ),
                          scope,
                          vp_token: vpJwt,
                        } satisfies CreateAccessTokenDto).toString(),
                      );

                    expect(response.body).toStrictEqual({
                      error: "invalid_request",
                      error_description:
                        "The vp_token must contain a nonce in order to prevent replay attacks.",
                    });
                    expect(response.status).toBe(400);
                    expect(
                      (response.headers as Record<string, unknown>)[
                        "content-type"
                      ],
                    ).toBe("application/json; charset=utf-8");
                  });

                  it("should return an error when a nonce has been used twice", async () => {
                    if (
                      [
                        DIDR_INVITE_SCOPE,
                        LEDGER_INVOKE_SCOPE,
                        TIR_INVITE_SCOPE,
                        TNT_AUTHORISE_SCOPE,
                      ].includes(customScope)
                    ) {
                      const vcJwt = await createVerifiableCredentialJwt(
                        vcPayload,
                        issuer,
                        ebsiEnvConfig,
                        {
                          skipValidation: true,
                        },
                      );

                      vpPayload.verifiableCredential.push(vcJwt);
                    }

                    // Create VP JWT manually
                    const vpJwt = createJWT(
                      {
                        aud: authorisationApiV4Url,
                        exp: Math.floor(Date.now() / 1000) + 60, // Expires in 1 minute (less than the 5 minutes limit)
                        iat: Math.floor(issuanceDate.getTime() / 1000),
                        iss: client.did,
                        nbf: Math.floor(issuanceDate.getTime() / 1000),
                        nonce: randomUUID(),
                        sub: client.did,
                        vp: vpPayload,
                      },
                      {
                        signer: client.signer,
                      },
                      {
                        alg: client.alg,
                        kid: client.kid,
                        typ: "JWT",
                      },
                    );

                    await request(server)
                      .post("/token")
                      .set("Content-Type", "application/x-www-form-urlencoded")
                      .send(
                        new URLSearchParams({
                          grant_type: "vp_token",
                          presentation_submission: JSON.stringify(
                            presentationSubmission,
                          ),
                          scope,
                          vp_token: vpJwt,
                        } satisfies CreateAccessTokenDto).toString(),
                      );

                    // Try submitting the same VP again.
                    const response = await request(server)
                      .post("/token")
                      .set("Content-Type", "application/x-www-form-urlencoded")
                      .send(
                        new URLSearchParams({
                          grant_type: "vp_token",
                          presentation_submission: JSON.stringify(
                            presentationSubmission,
                          ),
                          scope,
                          vp_token: vpJwt,
                        } satisfies CreateAccessTokenDto).toString(),
                      );

                    expect(response.body).toStrictEqual({
                      error: "invalid_request",
                      error_description:
                        "The vp_token contains a nonce which has already been used.",
                    });
                    expect(response.status).toBe(400);
                  });
                });

                it("should return an error if the presentation submission is invalid (including error details)", async () => {
                  presentationSubmission = {
                    definition_id: "openid_presentation",
                    descriptor_map: [
                      {
                        format: vpFormat,
                        id: "same-device-in-time-credential",
                        path: "$",
                        path_nested: {
                          format: vcFormat,
                          id: randomUUID(),
                          path: "$vp.verifiableCredential[0]", // wrong path
                        },
                      },
                    ],
                    id: randomUUID(),
                  };

                  if (
                    [
                      DIDR_INVITE_SCOPE,
                      LEDGER_INVOKE_SCOPE,
                      TIR_INVITE_SCOPE,
                      TNT_AUTHORISE_SCOPE,
                    ].includes(customScope)
                  ) {
                    const vcJwt = await createVerifiableCredentialJwt(
                      vcPayload,
                      issuer,
                      ebsiEnvConfig,
                      {
                        skipValidation: true,
                      },
                    );

                    vpPayload.verifiableCredential.push(vcJwt);
                  }

                  let vpJwt = await createVerifiablePresentationJwt(
                    vpPayload,
                    client,
                    authorisationApiV4Url,
                    ebsiEnvConfig,
                    {
                      exp: Math.floor(Date.now() / 1000) + 60, // Expires in 1 minute (less than the 5 minutes limit)
                      nbf: Math.floor(Date.now() / 1000) - 100,
                      nonce: randomUUID(),
                      skipValidation: true,
                    },
                  );

                  let response = await request(server)
                    .post("/token")
                    .set("Content-Type", "application/x-www-form-urlencoded")
                    .send(
                      new URLSearchParams({
                        grant_type: "vp_token",
                        presentation_submission: JSON.stringify(
                          presentationSubmission,
                        ),
                        scope,
                        vp_token: vpJwt,
                      } satisfies CreateAccessTokenDto).toString(),
                    );

                  expect(response.body).toStrictEqual({
                    error: "invalid_request",
                    error_description: `Invalid Presentation Submission:
- [root.presentation_submission] each descriptor should have a one id in it, on all levels
- [root.presentation_submission] each path should be a valid jsonPath`,
                  });
                  expect(response.status).toBe(400);
                  expect(
                    (response.headers as Record<string, unknown>)[
                      "content-type"
                    ],
                  ).toBe("application/json; charset=utf-8");

                  presentationSubmission = {
                    definition_id: "openid_presentation",
                    descriptor_map: [
                      {
                        format: vpFormat,
                        id: "same-device-in-time-credential",
                        path: "$",
                        path_nested: {
                          format: vcFormat,
                          id: randomUUID(),
                          path: "$.vp.verifiableCredential[1]", // no credential at this index
                        },
                      },
                    ],
                    id: randomUUID(),
                  };

                  vpJwt = await createVerifiablePresentationJwt(
                    vpPayload,
                    client,
                    authorisationApiV4Url,
                    ebsiEnvConfig,
                    {
                      exp: Math.floor(Date.now() / 1000) + 60, // Expires in 1 minute (less than the 5 minutes limit)
                      nbf: Math.floor(Date.now() / 1000) - 100,
                      nonce: randomUUID(),
                      skipValidation: true,
                    },
                  );

                  response = await request(server)
                    .post("/token")
                    .set("Content-Type", "application/x-www-form-urlencoded")
                    .send(
                      new URLSearchParams({
                        grant_type: "vp_token",
                        presentation_submission: JSON.stringify(
                          presentationSubmission,
                        ),
                        scope,
                        vp_token: vpJwt,
                      } satisfies CreateAccessTokenDto).toString(),
                    );

                  expect(response.body).toStrictEqual({
                    error: "invalid_request",
                    error_description: `Invalid Presentation Submission:
- [root.presentation_submission] each descriptor should have a one id in it, on all levels`,
                  });
                  expect(response.status).toBe(400);
                  expect(
                    (response.headers as Record<string, unknown>)[
                      "content-type"
                    ],
                  ).toBe("application/json; charset=utf-8");

                  presentationSubmission = {
                    definition_id: "openid_presentation",
                    descriptor_map: [
                      {
                        format: vpFormat,
                        id: "same-device-in-time-credential",
                        path: "$.vp", // wrong path
                        path_nested: {
                          format: vcFormat,
                          id: randomUUID(),
                          path: "$.vc.verifiableCredential[0]", // wrong path
                        },
                      },
                    ],
                    id: randomUUID(),
                  };

                  vpJwt = await createVerifiablePresentationJwt(
                    vpPayload,
                    client,
                    authorisationApiV4Url,
                    ebsiEnvConfig,
                    {
                      exp: Math.floor(Date.now() / 1000) + 60, // Expires in 1 minute (less than the 5 minutes limit)
                      nbf: Math.floor(Date.now() / 1000) - 100,
                      nonce: randomUUID(),
                      skipValidation: true,
                    },
                  );

                  response = await request(server)
                    .post("/token")
                    .set("Content-Type", "application/x-www-form-urlencoded")
                    .send(
                      new URLSearchParams({
                        grant_type: "vp_token",
                        presentation_submission: JSON.stringify(
                          presentationSubmission,
                        ),
                        scope,
                        vp_token: vpJwt,
                      } satisfies CreateAccessTokenDto).toString(),
                    );

                  expect(response.body).toStrictEqual({
                    error: "invalid_request",
                    error_description: `Invalid Presentation Submission:
- [root.presentation_submission] each descriptor should have a one id in it, on all levels`,
                  });
                  expect(response.status).toBe(400);
                  expect(
                    (response.headers as Record<string, unknown>)[
                      "content-type"
                    ],
                  ).toBe("application/json; charset=utf-8");

                  vpJwt = await createVerifiablePresentationJwt(
                    vpPayload,
                    client,
                    authorisationApiV4Url,
                    ebsiEnvConfig,
                    {
                      exp: Math.floor(Date.now() / 1000) + 60, // Expires in 1 minute (less than the 5 minutes limit)
                      nbf: Math.floor(Date.now() / 1000) - 100,
                      nonce: randomUUID(),
                      skipValidation: true,
                    },
                  );

                  response = await request(server)
                    .post("/token")
                    .set("Content-Type", "application/x-www-form-urlencoded")
                    .send(
                      qs.stringify({
                        grant_type: "vp_token",
                        presentation_submission: presentationSubmission,
                        scope,
                        vp_token: vpJwt,
                      }),
                    );

                  expect(response.body).toStrictEqual({
                    error: "invalid_request",
                    error_description:
                      "presentation_submission must be a json string",
                  });
                  expect(response.status).toBe(400);
                  expect(
                    (response.headers as Record<string, unknown>)[
                      "content-type"
                    ],
                  ).toBe("application/json; charset=utf-8");

                  vpJwt = await createVerifiablePresentationJwt(
                    vpPayload,
                    client,
                    authorisationApiV4Url,
                    ebsiEnvConfig,
                    {
                      exp: Math.floor(Date.now() / 1000) + 60, // Expires in 1 minute (less than the 5 minutes limit)
                      nbf: Math.floor(Date.now() / 1000) - 100,
                      nonce: randomUUID(),
                      skipValidation: true,
                    },
                  );

                  response = await request(server)
                    .post("/token")
                    .set("Content-Type", "application/x-www-form-urlencoded")
                    .send(
                      new URLSearchParams({
                        grant_type: "vp_token",
                        presentation_submission: JSON.stringify({ foo: "bar" }), // invalid json
                        scope,
                        vp_token: vpJwt,
                      } satisfies CreateAccessTokenDto).toString(),
                    );

                  expect(response.body).toStrictEqual({
                    error: "invalid_request",
                    error_description: `Invalid Presentation Submission:
- Validation error. Path: 'presentation_submission.definition_id'. Reason: Required
- Validation error. Path: 'presentation_submission.descriptor_map'. Reason: Required
- Validation error. Path: 'presentation_submission.id'. Reason: Required`,
                  });
                  expect(response.status).toBe(400);
                  expect(
                    (response.headers as Record<string, unknown>)[
                      "content-type"
                    ],
                  ).toBe("application/json; charset=utf-8");
                });

                it("should return an error if the content is not application/x-www-form-urlencoded", async () => {
                  if (
                    [
                      DIDR_INVITE_SCOPE,
                      LEDGER_INVOKE_SCOPE,
                      TIR_INVITE_SCOPE,
                      TNT_AUTHORISE_SCOPE,
                    ].includes(customScope)
                  ) {
                    const vcJwt = await createVerifiableCredentialJwt(
                      vcPayload,
                      issuer,
                      ebsiEnvConfig,
                      {
                        skipValidation: true,
                      },
                    );

                    vpPayload.verifiableCredential.push(vcJwt);
                  }

                  const nonce = randomUUID();

                  const vpJwt = await createVerifiablePresentationJwt(
                    vpPayload,
                    client,
                    authorisationApiV4Url,
                    ebsiEnvConfig,
                    {
                      exp: Math.floor(Date.now() / 1000) + 60, // Expires in 1 minute (less than the 5 minutes limit)
                      nbf: Math.floor(Date.now() / 1000) - 100,
                      nonce,
                      skipValidation: true,
                    },
                  );

                  const response = await request(server)
                    .post("/token")
                    .set("Content-Type", "application/json")
                    .send({
                      grant_type: "vp_token",
                      presentation_submission: presentationSubmission,
                      scope,
                      vp_token: vpJwt,
                    });

                  expect(response.body).toStrictEqual({
                    error: "invalid_request",
                    error_description:
                      "Content-type must be application/x-www-form-urlencoded",
                  });
                  expect(response.status).toBe(400);
                  expect(
                    (response.headers as Record<string, unknown>)[
                      "content-type"
                    ],
                  ).toBe("application/json; charset=utf-8");
                });

                it("should return an access token and an ID token when the presentation is valid", async () => {
                  if (
                    customScope === TIR_INVITE_SCOPE ||
                    customScope === TNT_AUTHORISE_SCOPE ||
                    customScope === LEDGER_INVOKE_SCOPE
                  ) {
                    // /!\ Skip test - Could be implemented later
                    expect.assertions(0);
                    return;
                  }

                  if (customScope === DIDR_INVITE_SCOPE) {
                    const vcJwt = await createVerifiableCredentialJwt(
                      vcPayload,
                      issuer,
                      ebsiEnvConfig,
                      {
                        skipValidation: true,
                      },
                    );

                    vpPayload.verifiableCredential.push(vcJwt);
                  }

                  const nonce = randomUUID();

                  const vpJwt = await createVerifiablePresentationJwt(
                    vpPayload,
                    client,
                    authorisationApiV4Url,
                    ebsiEnvConfig,
                    {
                      exp: Math.floor(Date.now() / 1000) + 60, // Expires in 1 minute (less than the 5 minutes limit)
                      nbf: Math.floor(Date.now() / 1000),
                      nonce,
                      skipValidation: true,
                    },
                  );

                  const response = await request(server)
                    .post("/token")
                    .set("Content-Type", "application/x-www-form-urlencoded")
                    .send(
                      new URLSearchParams({
                        grant_type: "vp_token",
                        presentation_submission: JSON.stringify(
                          presentationSubmission,
                        ),
                        scope,
                        vp_token: vpJwt,
                      } satisfies CreateAccessTokenDto).toString(),
                    );

                  expect(response.body).toStrictEqual({
                    access_token: expect.any(String),
                    expires_in: 7200,
                    id_token: expect.any(String),
                    scope,
                    token_type: "Bearer",
                  });

                  expect(response.status).toBe(200);

                  // Decode access token
                  const { access_token: accessToken } =
                    response.body as TokenResponse;
                  const decodedAccessToken = decodeJWT(accessToken);

                  expect(decodedAccessToken.header).toStrictEqual({
                    alg: "ES256",
                    kid: expect.any(String),
                    typ: "JWT",
                  });

                  expect(decodedAccessToken.payload).toStrictEqual({
                    aud: authorisationApiV4Url,
                    exp: expect.any(Number),
                    iat: expect.any(Number),
                    iss: authorisationApiV4Url,
                    jti: expect.any(String),
                    scp: scope,
                    sub: client.did,
                  });

                  // Get API public key in order to verify the signature
                  const { kid: accessTokenKid } = decodedAccessToken.header;
                  const jwksResponse = await request(server).get("/jwks");

                  expect(jwksResponse.status).toBe(200);

                  const { keys } = jwksResponse.body as JsonWebKeySet;
                  const apiPublicKeyJwk = keys.find(
                    (key) => key["kid"] === accessTokenKid,
                  );

                  expect(apiPublicKeyJwk).toBeDefined();

                  const apiPublicKey = await importJWK(apiPublicKeyJwk as JWK);

                  // Verify the signature of the access token
                  await expect(
                    jwtVerify(accessToken, apiPublicKey),
                  ).resolves.not.toThrow();

                  // Decode and verify ID Token
                  const { id_token: idToken } = response.body as TokenResponse;
                  const decodedIdToken = decodeJWT(idToken);

                  expect(decodedIdToken.header).toStrictEqual({
                    alg: "ES256",
                    kid: expect.any(String),
                    typ: "JWT",
                  });

                  expect(decodedIdToken.payload).toStrictEqual({
                    aud: client.did,
                    exp: expect.any(Number),
                    iat: expect.any(Number),
                    iss: authorisationApiV4Url,
                    jti: expect.any(String),
                    nonce,
                    sub: client.did,
                  });

                  await expect(
                    jwtVerify(idToken, apiPublicKey),
                  ).resolves.not.toThrow();
                });
              },
            );
          },
        );
      },
    );
  });
});
