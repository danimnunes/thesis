import type { PaginatedList } from "@ebsiint-api/shared";
import type {
  EbsiEnvConfiguration,
  EbsiIssuer,
} from "@europeum-ebsi/verifiable-credential";
import type {
  Schemas,
  TypeExtensions,
} from "@europeum-ebsi/verifiable-presentation/vcdm11.js";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { PresentationSubmission } from "@sphereon/pex-models";
import type { RawServerDefault } from "fastify";
import type { JWK } from "jose";

import { createJWT, decodeJWT, ES256KSigner } from "@europeum-ebsi/did-jwt";
import { fromUrl } from "@europeum-ebsi/ebsi-uri";
import { metadata as attestationSchemaMetadata } from "@europeum-ebsi/vcdm1.1-attestation-schema";
import { metadata as issuanceCertificateSchemaMetadata } from "@europeum-ebsi/vcdm1.1-type-extensions-terms-of-use-issuance-certificate-schema";
import { createVerifiableCredentialJwt } from "@europeum-ebsi/verifiable-credential/vcdm11.js";
import { createVerifiablePresentationJwt } from "@europeum-ebsi/verifiable-presentation/vcdm11.js";
import { EbsiWallet } from "@europeum-ebsi/wallet-lib";
import { ConfigService } from "@nestjs/config";
import { calculateJwkThumbprint, importJWK, jwtVerify } from "jose";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { randomBytes, randomUUID } from "node:crypto";
import { URLSearchParams } from "node:url";
import qs from "qs";
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

import type { LegalEntity } from "../../../tests/utils/data.ts";
import type { ApiConfig } from "../../config/configuration.ts";
import type {
  Access,
  JsonWebKeySet,
  Scope,
  TokenResponse,
  TrustedContract,
} from "./authorisation.interfaces.ts";

import { getNestFastifyApplication } from "../../../tests/utils/app.ts";
import {
  createDidDocument,
  createLegalEntity,
  createPresentationSubmission,
} from "../../../tests/utils/data.ts";
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
} from "./authorisation.constants.ts";
import { AuthorisationModule } from "./authorisation.module.ts";
import { CreateAccessTokenDto } from "./dto/index.ts";

vi.mock("did-jwt", async () => {
  const mod = await vi.importActual<typeof import("@europeum-ebsi/did-jwt")>(
    "@europeum-ebsi/did-jwt",
  );
  // Return a mocked version so we can redefine property `verifyJWT` later
  return {
    ...mod,
  };
});

/**
 * Escape DID in URLs mocked by MSW
 * @see https://github.com/mswjs/msw/discussions/739#discussioncomment-2524732
 */
function escapeDid(url: string) {
  return url.replace("did:ebsi:", String.raw`did\:ebsi\:`);
}

describe("Authorisation Module (using VCDM 1.1)", () => {
  describe.each([
    "EBSI URI",
    // "URL"
  ] as const)(
    "Authorisation Module (using %s as resource locator)",
    (uriType) => {
      let app: NestFastifyApplication;
      let server: RawServerDefault;
      let configService: ConfigService<ApiConfig, true>;
      let domain: string;
      let serviceEndpoint: string;
      let credentialIssuer: LegalEntity<"EdDSA" | "ES256">;
      let credentialIssuerAccreditationUrl: string;
      let credentialSubject: LegalEntity<"EdDSA" | "ES256" | "ES256K">;
      let ebsiEnvConfig: EbsiEnvConfiguration;
      const mockServer = setupServer();

      const attestationSchema = `https://api-test.ebsi.eu/trusted-schemas-registry/v3/schemas/${
        attestationSchemaMetadata.id.multibase_base58btc
      }`;
      const issuanceCertificateSchema = `https://api-test.ebsi.eu/trusted-schemas-registry/v3/schemas/${
        issuanceCertificateSchemaMetadata.id.multibase_base58btc
      }`;

      beforeAll(async () => {
        // Intercept network requests
        mockServer.listen({
          onUnhandledRequest: ({ url }, print) => {
            // Bypass local requests
            if (new URL(url).hostname === "127.0.0.1") return;

            print.error();
          },
        });

        app = await getNestFastifyApplication({
          imports: [AuthorisationModule],
        });

        configService = app.get<ConfigService<ApiConfig, true>>(ConfigService);

        await app.init();
        const fastifyInstance = app.getHttpAdapter().getInstance();
        await fastifyInstance.ready();

        server = app.getHttpServer();

        domain = configService.get("domain", { infer: true });
        const apiUrlPrefix = configService.get("apiUrlPrefix", {
          infer: true,
        });
        serviceEndpoint = `${domain}${apiUrlPrefix}`;
        ebsiEnvConfig = configService.get("ebsiEnvConfig", { infer: true });

        credentialIssuer = await createLegalEntity(["ES256", "EdDSA"]);
        credentialIssuerAccreditationUrl = `${domain}/trusted-issuers-registry/v5/issuers/${
          credentialIssuer.did
        }/attributes/${randomBytes(16).toString("hex")}`;
        credentialSubject = await createLegalEntity([
          "ES256K",
          "ES256",
          "EdDSA",
        ]);
      });

      function mockCredentialIssuer() {
        mockServer.use(
          http.get(
            escapeDid(
              `${domain}/did-registry/v5/identifiers/${credentialIssuer.did}`,
            ),
            ({ request }) => {
              const url = new URL(request.url);
              const validAt = url.searchParams.get("valid-at");

              // Only return the document if the valid-at parameter is present
              if (!validAt) {
                return HttpResponse.json(
                  "Invalid request (missing valid-at parameter)",
                  { status: 404 },
                );
              }

              // Make sure the request has the x-request-id header
              if (!request.headers.has("x-request-id")) {
                return HttpResponse.json(
                  "Invalid request (missing x-request-id header)",
                  { status: 400 },
                );
              }

              return HttpResponse.json(credentialIssuer.didDocument);
            },
          ),
          http.get(
            escapeDid(
              `${domain}/trusted-issuers-registry/v5/issuers/${credentialIssuer.did}`,
            ),
            ({ request }) => {
              // Make sure the request has the x-request-id header
              if (!request.headers.has("x-request-id")) {
                return HttpResponse.json(
                  "Invalid request (missing x-request-id header)",
                  { status: 400 },
                );
              }

              return HttpResponse.json({});
            },
          ),
        );

        // Issuer Self-Accreditation
        const iat = Math.round(Date.now() / 1000) - 5; // issued 5 seconds ago
        const exp = iat + 365 * 24 * 3600;
        const jti = `urn:uuid:${randomUUID()}`;
        const issuanceDate = new Date(iat * 1000).toISOString();
        const expirationDate = new Date(exp * 1000).toISOString();
        const accreditation = {
          "@context": ["https://www.w3.org/2018/credentials/v1"],
          credentialSchema: {
            id:
              uriType === "EBSI URI"
                ? fromUrl(attestationSchema, ebsiEnvConfig)
                : attestationSchema,
            type: "FullJsonSchemaValidator2021",
          },
          credentialSubject: {
            accreditedFor: [
              {
                policies: [
                  {
                    type: "ebsiPilot2023",
                    uri: "{uri to EBSI gov documents}",
                  },
                ],
                schemaId: attestationSchema,
                types: [
                  "VerifiableCredential",
                  "VerifiableAttestation",
                  "VerifiableAuthorisationForTrustChain",
                ],
              },
            ],
            id: credentialIssuer.did,
          },
          expirationDate,
          id: jti,
          issuanceDate,
          issued: issuanceDate,
          issuer: credentialIssuer.did,
          type: [
            "VerifiableCredential",
            "VerifiableAttestation",
            "VerifiableAccreditation",
            "VerifiableAccreditationToAttest",
          ],
          validFrom: issuanceDate,
          validUntil: expirationDate,
        } satisfies Schemas["Attestation"];

        const accreditationVcJwt = createJWT(
          {
            exp,
            iat,
            iss: accreditation.issuer,
            jti,
            nbf: iat,
            sub: accreditation.credentialSubject.id,
            vc: accreditation,
          },
          {
            signer: credentialIssuer.keys.ES256.signer,
          },
          {
            alg: credentialIssuer.keys.ES256.alg,
            kid: credentialIssuer.keys.ES256.kid,
            typ: "JWT",
          },
        );

        mockServer.use(
          http.get(
            escapeDid(credentialIssuerAccreditationUrl),
            ({ request }) => {
              // Make sure the request has the x-request-id header
              if (!request.headers.has("x-request-id")) {
                return HttpResponse.json(
                  "Invalid request (missing x-request-id header)",
                  { status: 400 },
                );
              }

              return HttpResponse.json({
                attribute: { body: accreditationVcJwt },
              });
            },
          ),
        );
      }

      beforeEach(() => {
        mockCredentialIssuer();
      });

      afterEach(() => {
        mockServer.resetHandlers();
      });

      afterAll(async () => {
        mockServer.close();

        await app.close();
      });

      describe("GET /.well-known/openid-configuration", () => {
        it("should return the well-known OpenID configuration", async () => {
          expect.assertions(2);

          const response = await request(server).get(
            "/.well-known/openid-configuration",
          );

          expect(response.body).toStrictEqual({
            authorization_endpoint: `${serviceEndpoint}/authorize`,
            grant_types_supported: ["vp_token"],
            id_token_signing_alg_values_supported: ["none"],
            id_token_types_supported: ["subject_signed_id_token"],
            issuer: expect.any(String),
            jwks_uri: `${serviceEndpoint}/jwks`,
            presentation_definition_endpoint: `${serviceEndpoint}/presentation-definitions`,
            response_types_supported: ["token"],
            scopes_supported: ["openid", ...CUSTOM_SCOPES],
            subject_syntax_types_supported: ["did:ebsi", "did:key"],
            subject_trust_frameworks_supported: ["ebsi"],
            subject_types_supported: ["public"],
            token_endpoint: `${serviceEndpoint}/token`,
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

          expect(response.status).toBe(200);
          expect(
            (response.headers as Record<string, unknown>)["content-type"],
          ).toBe("application/jwk-set+json; charset=utf-8");

          const jwk = (response.body as { keys: JWK[] }).keys[0]!;
          const thumbprint = await calculateJwkThumbprint(jwk);

          expect(jwk.kid).toBe(thumbprint);
        });
      });

      describe("GET /presentation-definitions", () => {
        it("should return an error if the scope is invalid", async () => {
          expect.assertions(12);

          // Without explicit scope
          let response = await request(server).get("/presentation-definitions");

          expect(response.body).toStrictEqual({
            detail: `["scope must be a combination of 'openid' and one of the supported scopes ('didr_invite', 'didr_write', 'ledger_invoke', 'tir_invite', 'tir_write', 'timestamp_write', 'tnt_authorise', 'tnt_create', 'tnt_write', 'tpr_write', 'tsr_write')"]`,
            status: 400,
            title: "Bad Request",
            type: "about:blank",
          });
          expect(response.status).toBe(400);
          expect(
            (response.headers as Record<string, unknown>)["content-type"],
          ).toBe("application/problem+json; charset=utf-8");

          // With an invalid scope
          response = await request(server).get(
            "/presentation-definitions?scope=test",
          );

          expect(response.body).toStrictEqual({
            detail: `["scope must be a combination of 'openid' and one of the supported scopes ('didr_invite', 'didr_write', 'ledger_invoke', 'tir_invite', 'tir_write', 'timestamp_write', 'tnt_authorise', 'tnt_create', 'tnt_write', 'tpr_write', 'tsr_write')"]`,
            status: 400,
            title: "Bad Request",
            type: "about:blank",
          });
          expect(response.status).toBe(400);
          expect(
            (response.headers as Record<string, unknown>)["content-type"],
          ).toBe("application/problem+json; charset=utf-8");

          // Doesn't contain "openid"
          response = await request(server).get(
            `/presentation-definitions?${new URLSearchParams({
              scope: "didr_write tir_write",
            }).toString()}`,
          );

          expect(response.body).toStrictEqual({
            detail: `["scope must be a combination of 'openid' and one of the supported scopes ('didr_invite', 'didr_write', 'ledger_invoke', 'tir_invite', 'tir_write', 'timestamp_write', 'tnt_authorise', 'tnt_create', 'tnt_write', 'tpr_write', 'tsr_write')"]`,
            status: 400,
            title: "Bad Request",
            type: "about:blank",
          });
          expect(response.status).toBe(400);
          expect(
            (response.headers as Record<string, unknown>)["content-type"],
          ).toBe("application/problem+json; charset=utf-8");

          // Includes only "openid"
          response = await request(server).get(
            "/presentation-definitions?scope=openid",
          );

          expect(response.body).toStrictEqual({
            detail: `["scope must be a combination of 'openid' and one of the supported scopes ('didr_invite', 'didr_write', 'ledger_invoke', 'tir_invite', 'tir_write', 'timestamp_write', 'tnt_authorise', 'tnt_create', 'tnt_write', 'tpr_write', 'tsr_write')"]`,
            status: 400,
            title: "Bad Request",
            type: "about:blank",
          });
          expect(response.status).toBe(400);
          expect(
            (response.headers as Record<string, unknown>)["content-type"],
          ).toBe("application/problem+json; charset=utf-8");
        });

        it("should return the expected presentation definition for the given scope", async () => {
          expect.assertions(22);

          //  With explicit scope "openid didr_invite"
          let response = await request(server).get(
            `/presentation-definitions?scope=${encodeURIComponent(
              `openid ${DIDR_INVITE_SCOPE}`,
            )}`,
          );

          expect(response.body).toStrictEqual(
            DIDR_INVITE_PRESENTATION_DEFINITION,
          );
          expect(response.status).toBe(200);

          // With explicit scope "openid didr_write"
          response = await request(server).get(
            `/presentation-definitions?scope=${encodeURIComponent(
              `openid ${DIDR_WRITE_SCOPE}`,
            )}`,
          );

          expect(response.body).toStrictEqual(
            DIDR_WRITE_PRESENTATION_DEFINITION,
          );
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

          expect(response.body).toStrictEqual(
            TIR_INVITE_PRESENTATION_DEFINITION,
          );
          expect(response.status).toBe(200);

          // With explicit scope "openid tir_write"
          response = await request(server).get(
            `/presentation-definitions?scope=${encodeURIComponent(
              `openid ${TIR_WRITE_SCOPE}`,
            )}`,
          );

          expect(response.body).toStrictEqual(
            TIR_WRITE_PRESENTATION_DEFINITION,
          );
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

          const tntCreatePresentationDefinition = structuredClone(
            TNT_CREATE_PRESENTATION_DEFINITION,
          );
          expect(response.body).toStrictEqual(tntCreatePresentationDefinition);
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

      describe.each([
        ["jwt_vp", "jwt_vc"],
        ["jwt_vp", "jwt_vc_json"],
        ["jwt_vp_json", "jwt_vc"],
        ["jwt_vp_json", "jwt_vc_json"],
      ] as const)(
        "POST /token (VP format: %s, VC format: %s)",
        (vpFormat, vcFormat) => {
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

          it("should return a detailed error if VP JWT is invalid (missing 'verifiableCredential' property)", async () => {
            expect.assertions(2);

            const scope = "openid tnt_create";

            const vpPayload = {
              "@context": ["https://www.w3.org/2018/credentials/v1"],
              // 'verifiableCredential' is missing
              // verifiableCredential: [],
              holder: credentialSubject.did,
              id: `urn:uuid:${randomUUID()}`,
              type: ["VerifiablePresentation"],
            } satisfies Omit<Schemas["Presentation"], "verifiableCredential">;

            const presentationSubmission = createPresentationSubmission(
              TNT_CREATE_SCOPE,
              vpFormat,
              vcFormat,
            );

            // Manually create VP JWT
            // Create VP JWT manually
            const now = Math.floor(Date.now() / 1000);
            const vpJwt = createJWT(
              {
                aud: serviceEndpoint,
                exp: now + 60, // 1 minute expiration
                iat: now,
                iss: credentialIssuer.did,
                nbf: now,
                nonce: randomUUID(),
                sub: credentialIssuer.did,
                vp: vpPayload,
              },
              {
                signer: credentialIssuer.keys.ES256.signer,
              },
              {
                alg: credentialIssuer.keys.ES256.alg,
                kid: credentialIssuer.keys.ES256.kid,
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
                  vp_token: vpJwt,
                } satisfies CreateAccessTokenDto).toString(),
              );

            expect(response.body).toStrictEqual({
              error: "invalid_request",
              error_description:
                "Invalid Verifiable Presentation: Invalid EBSI Verifiable Presentation. The root value is missing the required field 'verifiableCredential'.",
            });

            expect(response.status).toBe(400);
          });

          describe.each(CUSTOM_SCOPES)(
            "with scope 'openid %s'",
            (customScope) => {
              const scope: Scope = `openid ${customScope}`;
              let vcPayload: Schemas["Attestation"];
              let vpPayload: Schemas["Presentation"];
              let presentationSubmission: PresentationSubmission;
              let issuanceDate: Date;
              let expirationDate: Date;

              function setupEnvironment() {
                mockCredentialIssuer();

                issuanceDate = new Date(Date.now() - 5000); // issue 5 seconds ago
                // JWT access token must have 2 hours expiration time and there are no Refresh Tokens.
                expirationDate = new Date(
                  issuanceDate.getTime() + 2 * 60 * 60 * 1000,
                );

                vcPayload = {
                  "@context": ["https://www.w3.org/2018/credentials/v1"],
                  credentialSchema: [
                    {
                      id:
                        uriType === "EBSI URI"
                          ? fromUrl(attestationSchema, ebsiEnvConfig)
                          : attestationSchema,
                      type: "FullJsonSchemaValidator2021",
                    },
                    {
                      id:
                        uriType === "EBSI URI"
                          ? fromUrl(issuanceCertificateSchema, ebsiEnvConfig)
                          : issuanceCertificateSchema,
                      type: "FullJsonSchemaValidator2021",
                    },
                  ],
                  credentialSubject: {
                    id: credentialSubject.did,
                    ...(customScope === LEDGER_INVOKE_SCOPE && {
                      contractAddress:
                        "0x61c36a8d610163660E21a8b7359e1Cac0C9133e1",
                    }),
                  },
                  expirationDate: `${expirationDate.toISOString().slice(0, -5)}Z`,
                  id: `urn:uuid:${randomUUID()}`,
                  issuanceDate: `${issuanceDate.toISOString().slice(0, -5)}Z`,
                  issued: `${issuanceDate.toISOString().slice(0, -5)}Z`,
                  issuer: credentialIssuer.did,
                  termsOfUse: {
                    id:
                      uriType === "EBSI URI"
                        ? fromUrl(
                            credentialIssuerAccreditationUrl,
                            ebsiEnvConfig,
                          )
                        : credentialIssuerAccreditationUrl,
                    type: "IssuanceCertificate",
                  },
                  type: ["VerifiableCredential", "VerifiableAttestation"],
                  validFrom: `${issuanceDate.toISOString().slice(0, -5)}Z`,
                } satisfies Schemas["Attestation"] &
                  TypeExtensions["termsOfUse"]["IssuanceCertificate"];

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
                  holder: credentialSubject.did,
                  id: `urn:uuid:${randomUUID()}`,
                  type: ["VerifiablePresentation"],
                  verifiableCredential: [],
                } satisfies Schemas["Presentation"];

                // Reset to valid presentation submission before each test
                presentationSubmission = createPresentationSubmission(
                  customScope,
                  vpFormat,
                  vcFormat,
                );

                // If scope=didr_invite, the DID is not yet registered in the DIDR and TIR
                if (customScope === DIDR_INVITE_SCOPE) {
                  mockServer.use(
                    http.get(
                      escapeDid(
                        `${domain}/did-registry/v5/identifiers/${credentialSubject.did}`,
                      ),
                      ({ request }) => {
                        // Make sure the request has the x-request-id header
                        if (!request.headers.has("x-request-id")) {
                          return HttpResponse.json(
                            "Invalid request (missing x-request-id header)",
                            { status: 400 },
                          );
                        }

                        return HttpResponse.text("Not found", {
                          status: 404,
                        });
                      },
                    ),
                  );
                } else {
                  mockServer.use(
                    http.get(
                      escapeDid(
                        `${domain}/did-registry/v5/identifiers/${credentialSubject.did}`,
                      ),
                      ({ request }) => {
                        // Make sure the request has the x-request-id header
                        if (!request.headers.has("x-request-id")) {
                          return HttpResponse.json(
                            "Invalid request (missing x-request-id header)",
                            { status: 400 },
                          );
                        }

                        return HttpResponse.json(credentialSubject.didDocument);
                      },
                    ),
                  );
                }

                if (customScope === TIR_INVITE_SCOPE) {
                  mockServer.use(
                    http.get(
                      escapeDid(
                        `${domain}/trusted-issuers-registry/v5/issuers/${credentialSubject.did}`,
                      ),
                      ({ request }) => {
                        // Make sure the request has the x-request-id header
                        if (!request.headers.has("x-request-id")) {
                          return HttpResponse.json(
                            "Invalid request (missing x-request-id header)",
                            { status: 400 },
                          );
                        }

                        return HttpResponse.json({
                          attributes: `${domain}/trusted-issuers-registry/v5/issuers/${credentialSubject.did}/attributes`,
                          did: credentialSubject.did,
                          hasAttributes: false,
                        });
                      },
                    ),
                  );
                }

                if (customScope === TIR_WRITE_SCOPE) {
                  mockServer.use(
                    http.get(
                      escapeDid(
                        `${domain}/trusted-issuers-registry/v5/issuers/${credentialSubject.did}`,
                      ),
                      ({ request }) => {
                        // Make sure the request has the x-request-id header
                        if (!request.headers.has("x-request-id")) {
                          return HttpResponse.json(
                            "Invalid request (missing x-request-id header)",
                            { status: 400 },
                          );
                        }

                        return HttpResponse.json({
                          attributes: `${domain}/trusted-issuers-registry/v5/issuers/${credentialSubject.did}/attributes`,
                          did: credentialSubject.did,
                          hasAttributes: true,
                        });
                      },
                    ),
                  );
                }

                if (customScope === TNT_AUTHORISE_SCOPE) {
                  mockServer.use(
                    http.get(
                      `${domain}/trusted-policies-registry/v3/users/${credentialSubject.address}`,
                      ({ request }) => {
                        // Make sure the request has the x-request-id header
                        if (!request.headers.has("x-request-id")) {
                          return HttpResponse.json(
                            "Invalid request (missing x-request-id header)",
                            { status: 400 },
                          );
                        }

                        return HttpResponse.json({
                          attributes: ["TNT:authoriseDid"],
                          user: credentialSubject.address,
                        });
                      },
                    ),
                  );
                }

                if (customScope === LEDGER_INVOKE_SCOPE) {
                  mockServer.use(
                    http.get(
                      escapeDid(
                        `${domain}/trusted-contracts-registry/v1/contracts/0x61c36a8d610163660E21a8b7359e1Cac0C9133e1`,
                      ),
                      ({ request }) => {
                        // Make sure the request has the x-request-id header
                        if (!request.headers.has("x-request-id")) {
                          return HttpResponse.json(
                            "Invalid request (missing x-request-id header)",
                            { status: 400 },
                          );
                        }

                        return HttpResponse.json({
                          address: "0x61c36a8d610163660E21a8b7359e1Cac0C9133e1",
                          deployer: credentialIssuer.address,
                          deployerDID: credentialIssuer.did,
                          deploymentTimestamp: 1_760_600_272,
                          isActive: true,
                          templateId:
                            "0x957cef8a6ccfa45ea37ec9976fa2cdeb916d96039d6dac5bd68e37284bc187f4",
                        } satisfies TrustedContract);
                      },
                    ),
                  );
                }
              }

              beforeEach(() => {
                setupEnvironment();
              });

              afterEach(() => {
                mockServer.resetHandlers();
              });

              describe("vp_token validation", () => {
                beforeEach(() => {
                  // Empty verifiable credential before each test to allow each test to add its own verifiable credential
                  vpPayload.verifiableCredential = [];
                  vpPayload["id"] = `urn:uuid:${randomUUID()}`; // VP ID is used as JWT JTI.
                });

                it("should return an error when the audience is not the service", async () => {
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
                      credentialIssuer.keys.ES256,
                      ebsiEnvConfig,
                      {
                        skipValidation: true,
                      },
                    );

                    vpPayload.verifiableCredential = [vcJwt];
                  }

                  const now = Math.floor(Date.now() / 1000);
                  const vpJwt = await createVerifiablePresentationJwt(
                    vpPayload,
                    credentialSubject.keys.ES256K,
                    "authentication-service-v3",
                    ebsiEnvConfig,
                    {
                      exp: now + 60, // Expire in 60 seconds (less than the 5 minutes limit)
                      nbf: now,
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
                    error_description: `Invalid Verifiable Presentation: JWT "aud" property MUST match the expected audience "${domain}/authorisation/v4"`,
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
                      credentialIssuer.keys.ES256,
                      ebsiEnvConfig,
                      {
                        skipValidation: true,
                      },
                    );

                    vpPayload.verifiableCredential = [vcJwt];
                  }

                  const now = Math.floor(Date.now() / 1000);
                  const vpJwt = await createVerifiablePresentationJwt(
                    vpPayload,
                    credentialSubject.keys.ES256K,
                    serviceEndpoint,
                    ebsiEnvConfig,
                    {
                      exp: now + 60, // Expire in 60 seconds (less than the 5 minutes limit)
                      nbf: now,
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
                      kid: credentialIssuer.keys.ES256.kid,
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
                    error_description: `Invalid Verifiable Presentation: JWT "sub" property MUST match the VP holder "${credentialSubject.did}"`,
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
                      credentialIssuer.keys.ES256,
                      ebsiEnvConfig,
                      {
                        skipValidation: true,
                      },
                    );

                    vpPayload.verifiableCredential = [vcJwt];
                  }

                  const vpJwt = await createVerifiablePresentationJwt(
                    vpPayload,
                    credentialSubject.keys.ES256K,
                    serviceEndpoint,
                    ebsiEnvConfig,
                    {
                      // Override "exp" and "nbf"
                      exp: Math.floor(Date.now() / 1000) - 100,
                      nbf: Math.floor(Date.now() / 1000) - 1000,
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
                      credentialIssuer.keys.ES256,
                      ebsiEnvConfig,
                      {
                        skipValidation: true,
                      },
                    );

                    vpPayload.verifiableCredential = [vcJwt];
                  }

                  const now = Math.floor(Date.now() / 1000);
                  const vpJwt = await createVerifiablePresentationJwt(
                    vpPayload,
                    credentialSubject.keys.ES256K,
                    serviceEndpoint,
                    ebsiEnvConfig,
                    {
                      // Override "exp" and "nbf"
                      exp: now + 120,
                      nbf: now + 100,
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
                      credentialIssuer.keys.ES256,
                      ebsiEnvConfig,
                      {
                        skipValidation: true,
                      },
                    );

                    vpPayload.verifiableCredential = [vcJwt];
                  }

                  const now = Math.floor(Date.now() / 1000);
                  const vpJwt = await createVerifiablePresentationJwt(
                    vpPayload,
                    credentialSubject.keys.ES256K,
                    serviceEndpoint,
                    ebsiEnvConfig,
                    {
                      exp: now + 60, // Expire in 60 seconds (less than the 5 minutes limit)
                      // We don't add any nonce
                      nbf: now,
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
                      TIR_INVITE_SCOPE,
                      TNT_AUTHORISE_PRESENTATION_DEFINITION,
                    ].includes(customScope)
                  ) {
                    const vcJwt = await createVerifiableCredentialJwt(
                      vcPayload,
                      credentialIssuer.keys.ES256,
                      ebsiEnvConfig,
                      {
                        skipValidation: true,
                      },
                    );

                    vpPayload.verifiableCredential = [vcJwt];
                  }

                  // Create VP JWT manually
                  const now = Math.floor(Date.now() / 1000);
                  const vpJwt = createJWT(
                    {
                      aud: serviceEndpoint,
                      exp: now + 60, // 1 minute expiration
                      iat: now,
                      iss: credentialIssuer.did,
                      nbf: now,
                      nonce: randomUUID(),
                      sub: credentialIssuer.did,
                      vp: vpPayload,
                    },
                    {
                      signer: credentialIssuer.keys.ES256.signer,
                    },
                    {
                      alg: credentialIssuer.keys.ES256.alg,
                      kid: credentialIssuer.keys.ES256.kid,
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
                  expect(
                    (response.headers as Record<string, unknown>)[
                      "content-type"
                    ],
                  ).toBe("application/json; charset=utf-8");
                });

                // Fix: EBSIINT-6065
                // require at least 1 verifiable credential
                it("should return error when the number of verifiable credentials is not correct", async () => {
                  if (
                    [
                      DIDR_WRITE_SCOPE,
                      TIMESTAMP_WRITE_SCOPE,
                      TIR_WRITE_SCOPE,
                      TNT_CREATE_SCOPE,
                      TNT_WRITE_SCOPE,
                      TPR_WRITE_SCOPE,
                      TSR_WRITE_SCOPE,
                    ].includes(customScope)
                  ) {
                    // Skip test
                    expect.assertions(0);
                    return;
                  }

                  const now = Math.floor(Date.now() / 1000);
                  const vpJwt = await createVerifiablePresentationJwt(
                    vpPayload,
                    credentialSubject.keys.ES256K,
                    serviceEndpoint,
                    ebsiEnvConfig,
                    {
                      exp: now + 60, // Expire in 60 seconds (less than the 5 minutes limit)
                      nbf: now,
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
                      "Invalid Presentation Submission: VP needs to have at least one verifiable credential at this point",
                  });
                  expect(response.status).toBe(400);
                  expect(
                    (response.headers as Record<string, unknown>)[
                      "content-type"
                    ],
                  ).toBe("application/json; charset=utf-8");
                });
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
                    credentialIssuer.keys.ES256,
                    ebsiEnvConfig,
                    {
                      skipValidation: true,
                    },
                  );

                  vpPayload.verifiableCredential = [vcJwt];
                }

                const nonce = randomUUID();
                const now = Math.floor(Date.now() / 1000);

                const vpJwt = await createVerifiablePresentationJwt(
                  vpPayload,
                  credentialSubject.keys.ES256K,
                  serviceEndpoint,
                  ebsiEnvConfig,
                  {
                    exp: now + 60, // Expire in 60 seconds (less than the 5 minutes limit)
                    nbf: now,
                    nonce,
                    skipValidation: true,
                  },
                );

                let response = await request(server)
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
                  (response.headers as Record<string, unknown>)["content-type"],
                ).toBe("application/json; charset=utf-8");

                response = await request(server)
                  .post("/token")
                  .unset("Content-Type")
                  .send();

                expect(response.body).toStrictEqual({
                  error: "invalid_request",
                  error_description:
                    "Content-type must be application/x-www-form-urlencoded",
                });
                expect(response.status).toBe(400);
                expect(
                  (response.headers as Record<string, unknown>)["content-type"],
                ).toBe("application/json; charset=utf-8");
              });

              it("should return an error if the presentation submission is not a JSON string", async () => {
                presentationSubmission = {
                  definition_id: "openid_presentation",
                  descriptor_map: [
                    {
                      format: vpFormat,
                      id: "same-device-in-time-credential",
                      path: "$",
                      path_nested: {
                        format: vcFormat,
                        id: `urn:uuid:${randomUUID()}`,
                        path: "$vp.verifiableCredential[0]", // wrong path
                      },
                    },
                  ],
                  id: `urn:uuid:${randomUUID()}`,
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
                    credentialIssuer.keys.ES256,
                    ebsiEnvConfig,
                    {
                      skipValidation: true,
                    },
                  );

                  vpPayload.verifiableCredential = [vcJwt];
                }

                const now = Math.floor(Date.now() / 1000);

                const vpJwt = await createVerifiablePresentationJwt(
                  vpPayload,
                  credentialSubject.keys.ES256K,
                  serviceEndpoint,
                  ebsiEnvConfig,
                  {
                    exp: now + 60, // Expire in 60 seconds (less than the 5 minutes limit)
                    nbf: now,
                    nonce: randomUUID(),
                    skipValidation: true,
                  },
                );

                const response = await request(server)
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
                        id: `urn:uuid:${randomUUID()}`,
                        path: "$vp.verifiableCredential[0]", // wrong path
                      },
                    },
                  ],
                  id: `urn:uuid:${randomUUID()}`,
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
                    credentialIssuer.keys.ES256,
                    ebsiEnvConfig,
                    {
                      skipValidation: true,
                    },
                  );

                  vpPayload.verifiableCredential = [vcJwt];
                }

                const now = Math.floor(Date.now() / 1000);
                let vpJwt = await createVerifiablePresentationJwt(
                  vpPayload,
                  credentialSubject.keys.ES256K,
                  serviceEndpoint,
                  ebsiEnvConfig,
                  {
                    exp: now + 60, // Expire in 60 seconds (less than the 5 minutes limit)
                    nbf: now,
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
                  (response.headers as Record<string, unknown>)["content-type"],
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
                        id: `urn:uuid:${randomUUID()}`,
                        path: "$.vp.verifiableCredential[1]", // no credential at this index
                      },
                    },
                  ],
                  id: `urn:uuid:${randomUUID()}`,
                };

                vpJwt = await createVerifiablePresentationJwt(
                  vpPayload,
                  credentialSubject.keys.ES256K,
                  serviceEndpoint,
                  ebsiEnvConfig,
                  {
                    exp: now + 60, // Expire in 60 seconds (less than the 5 minutes limit)
                    nbf: now,
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
                  (response.headers as Record<string, unknown>)["content-type"],
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
                        id: `urn:uuid:${randomUUID()}`,
                        path: "$.vc.verifiableCredential[0]", // wrong path
                      },
                    },
                  ],
                  id: `urn:uuid:${randomUUID()}`,
                };

                vpJwt = await createVerifiablePresentationJwt(
                  vpPayload,
                  credentialSubject.keys.ES256K,
                  serviceEndpoint,
                  ebsiEnvConfig,
                  {
                    exp: now + 60, // Expire in 60 seconds (less than the 5 minutes limit)
                    nbf: now,
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
                  (response.headers as Record<string, unknown>)["content-type"],
                ).toBe("application/json; charset=utf-8");

                vpJwt = await createVerifiablePresentationJwt(
                  vpPayload,
                  credentialSubject.keys.ES256K,
                  serviceEndpoint,
                  ebsiEnvConfig,
                  {
                    exp: now + 60, // Expire in 60 seconds (less than the 5 minutes limit)
                    nbf: now,
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
                  (response.headers as Record<string, unknown>)["content-type"],
                ).toBe("application/json; charset=utf-8");

                vpJwt = await createVerifiablePresentationJwt(
                  vpPayload,
                  credentialSubject.keys.ES256K,
                  serviceEndpoint,
                  ebsiEnvConfig,
                  {
                    exp: now + 60, // Expire in 60 seconds (less than the 5 minutes limit)
                    nbf: now,
                    nonce: randomUUID(),
                    skipValidation: true,
                  },
                );

                const invalidPresentationSubmission =
                  createPresentationSubmission(
                    TIR_WRITE_SCOPE,
                    vpFormat,
                    vcFormat,
                  );
                invalidPresentationSubmission.definition_id = "invalid_def_id";
                response = await request(server)
                  .post("/token")
                  .set("Content-Type", "application/x-www-form-urlencoded")
                  .send(
                    new URLSearchParams({
                      grant_type: "vp_token",
                      presentation_submission: JSON.stringify(
                        invalidPresentationSubmission,
                      ),
                      scope,
                      vp_token: vpJwt,
                    } satisfies CreateAccessTokenDto).toString(),
                  );

                expect(response.body).toStrictEqual({
                  error: "invalid_request",
                  error_description:
                    "Invalid Presentation Submission: definition_id doesn't match the expected Presentation Definition ID for the requested scope",
                });
                expect(response.status).toBe(400);
                expect(
                  (response.headers as Record<string, unknown>)["content-type"],
                ).toBe("application/json; charset=utf-8");

                vpJwt = await createVerifiablePresentationJwt(
                  vpPayload,
                  credentialSubject.keys.ES256K,
                  serviceEndpoint,
                  ebsiEnvConfig,
                  {
                    exp: now + 600, // Expire in 10 minutes (more than the 5 minutes limit)
                    nbf: now,
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
                  error_description:
                    "The vp_token must not have an expiration time of more than 5 minutes in the future.",
                });
                expect(response.status).toBe(400);
                expect(
                  (response.headers as Record<string, unknown>)["content-type"],
                ).toBe("application/json; charset=utf-8");
              });

              it("should return an error if the conditions specific to the scope are not met", async () => {
                let expectedError = {
                  error: "",
                  error_description: "",
                };
                let vpSigner: EbsiIssuer;

                const testCases: {
                  setup: () => Promise<void> | void;
                }[] = [];

                switch (customScope) {
                  case DIDR_INVITE_SCOPE: {
                    testCases.push(
                      // Present a VC without VerifiableAuthorisationToOnboard
                      {
                        setup() {
                          vcPayload.type = [
                            "VerifiableCredential",
                            "VerifiableAttestation",
                          ];

                          vpSigner = credentialSubject.keys.ES256K;

                          expectedError = {
                            error: "invalid_request",
                            error_description:
                              "Invalid Presentation Submission:\nFilterEvaluation tag: Input candidate failed filter evaluation: submission.descriptor_map[0]: presentation $ with nested credential $.vp.verifiableCredential[0];,MarkForSubmissionEvaluation tag: The input candidate is not eligible for submission: submission.descriptor_map[0]: presentation $ with nested credential $.vp.verifiableCredential[0];",
                          };
                        },
                      },
                    );

                    break;
                  }
                  case DIDR_WRITE_SCOPE: {
                    testCases.push(
                      // VP Signer is not registered in the DIDR
                      {
                        async setup() {
                          const legalEntity = await createLegalEntity([
                            "ES256K",
                          ]);
                          vpSigner = legalEntity.keys.ES256K;
                          vpPayload.holder = vpSigner.did;

                          mockServer.use(
                            http.get(
                              escapeDid(
                                `${domain}/did-registry/v5/identifiers/${vpSigner.did}`,
                              ),
                              ({ request }) => {
                                const url = new URL(request.url);
                                const validAt =
                                  url.searchParams.get("valid-at");

                                // Only return the document if the valid-at parameter is present
                                if (!validAt) {
                                  return HttpResponse.json(
                                    "Invalid request (missing valid-at parameter)",
                                    { status: 404 },
                                  );
                                }

                                // Make sure the request has the x-request-id header
                                if (!request.headers.has("x-request-id")) {
                                  return HttpResponse.json(
                                    "Invalid request (missing x-request-id header)",
                                    { status: 400 },
                                  );
                                }

                                return HttpResponse.text("Not found", {
                                  status: 404,
                                });
                              },
                            ),
                          );

                          expectedError = {
                            error: "invalid_request",
                            error_description: `Invalid Verifiable Presentation: Unable to resolve ${vpSigner.did}. Error: notFound. Not Found | Registry used: ${domain}/did-registry/v5/identifiers`,
                          };
                        },
                      },
                      // DIDR API returns an internal error
                      {
                        async setup() {
                          const legalEntity = await createLegalEntity([
                            "ES256K",
                          ]);
                          vpSigner = legalEntity.keys.ES256K;
                          vpPayload.holder = vpSigner.did;

                          mockServer.use(
                            http.get(
                              escapeDid(
                                `${domain}/did-registry/v5/identifiers/${vpSigner.did}`,
                              ),
                              ({ request }) => {
                                const url = new URL(request.url);
                                const validAt =
                                  url.searchParams.get("valid-at");

                                // Only return the document if the valid-at parameter is present
                                if (!validAt) {
                                  return HttpResponse.json(
                                    "Invalid request (missing valid-at parameter)",
                                    { status: 404 },
                                  );
                                }

                                // Make sure the request has the x-request-id header
                                if (!request.headers.has("x-request-id")) {
                                  return HttpResponse.json(
                                    "Invalid request (missing x-request-id header)",
                                    { status: 400 },
                                  );
                                }

                                return HttpResponse.text(
                                  "Internal Server Error",
                                  {
                                    status: 500,
                                  },
                                );
                              },
                            ),
                          );

                          expectedError = {
                            error: "server_error",
                            error_description: `Unable to resolve ${vpSigner.did}. Error: internalServerError. Internal Server Error | Registry used: ${domain}/did-registry/v5/identifiers`,
                          };
                        },
                      },
                    );
                    break;
                  }
                  case LEDGER_INVOKE_SCOPE: {
                    testCases.push(
                      // VP Signer is not registered in the DIDR
                      {
                        async setup() {
                          const legalEntity = await createLegalEntity([
                            "ES256K",
                          ]);
                          vpSigner = legalEntity.keys.ES256K;
                          vpPayload.holder = vpSigner.did;

                          mockServer.use(
                            http.get(
                              escapeDid(
                                `${domain}/did-registry/v5/identifiers/${vpSigner.did}`,
                              ),
                              ({ request }) => {
                                const url = new URL(request.url);
                                const validAt =
                                  url.searchParams.get("valid-at");

                                // Only return the document if the valid-at parameter is present
                                if (!validAt) {
                                  return HttpResponse.json(
                                    "Invalid request (missing valid-at parameter)",
                                    { status: 404 },
                                  );
                                }

                                // Make sure the request has the x-request-id header
                                if (!request.headers.has("x-request-id")) {
                                  return HttpResponse.json(
                                    "Invalid request (missing x-request-id header)",
                                    { status: 400 },
                                  );
                                }

                                return HttpResponse.text("Not found", {
                                  status: 404,
                                });
                              },
                            ),
                          );

                          expectedError = {
                            error: "invalid_request",
                            error_description: `Invalid Verifiable Presentation: Unable to resolve ${vpSigner.did}. Error: notFound. Not Found | Registry used: ${domain}/did-registry/v5/identifiers`,
                          };
                        },
                      },
                      // DIDR API returns an internal error
                      {
                        async setup() {
                          const legalEntity = await createLegalEntity([
                            "ES256K",
                          ]);
                          vpSigner = legalEntity.keys.ES256K;
                          vpPayload.holder = vpSigner.did;

                          mockServer.use(
                            http.get(
                              escapeDid(
                                `${domain}/did-registry/v5/identifiers/${vpSigner.did}`,
                              ),
                              ({ request }) => {
                                const url = new URL(request.url);
                                const validAt =
                                  url.searchParams.get("valid-at");

                                // Only return the document if the valid-at parameter is present
                                if (!validAt) {
                                  return HttpResponse.json(
                                    "Invalid request (missing valid-at parameter)",
                                    { status: 404 },
                                  );
                                }

                                // Make sure the request has the x-request-id header
                                if (!request.headers.has("x-request-id")) {
                                  return HttpResponse.json(
                                    "Invalid request (missing x-request-id header)",
                                    { status: 400 },
                                  );
                                }

                                return HttpResponse.text(
                                  "Internal Server Error",
                                  {
                                    status: 500,
                                  },
                                );
                              },
                            ),
                          );

                          expectedError = {
                            error: "server_error",
                            error_description: `Unable to resolve ${vpSigner.did}. Error: internalServerError. Internal Server Error | Registry used: ${domain}/did-registry/v5/identifiers`,
                          };
                        },
                      },
                    );
                    break;
                  }
                  case TIMESTAMP_WRITE_SCOPE:
                  case TPR_WRITE_SCOPE:
                  case TSR_WRITE_SCOPE: {
                    testCases.push(
                      // VP Signer is not registered in the DIDR
                      {
                        async setup() {
                          const legalEntity = await createLegalEntity([
                            "ES256",
                          ]);
                          vpSigner = legalEntity.keys.ES256;
                          vpPayload.holder = vpSigner.did;

                          mockServer.use(
                            http.get(
                              escapeDid(
                                `${domain}/did-registry/v5/identifiers/${vpSigner.did}`,
                              ),
                              ({ request }) => {
                                const url = new URL(request.url);
                                const validAt =
                                  url.searchParams.get("valid-at");

                                // Only return the document if the valid-at parameter is present
                                if (!validAt) {
                                  return HttpResponse.json(
                                    "Invalid request (missing valid-at parameter)",
                                    { status: 404 },
                                  );
                                }

                                // Make sure the request has the x-request-id header
                                if (!request.headers.has("x-request-id")) {
                                  return HttpResponse.json(
                                    "Invalid request (missing x-request-id header)",
                                    { status: 400 },
                                  );
                                }

                                return HttpResponse.text("Not found", {
                                  status: 404,
                                });
                              },
                            ),
                          );

                          expectedError = {
                            error: "invalid_request",
                            error_description: `Invalid Verifiable Presentation: Unable to resolve ${vpSigner.did}. Error: notFound. Not Found | Registry used: ${domain}/did-registry/v5/identifiers`,
                          };
                        },
                      },
                      // DIDR API returns an internal error
                      {
                        async setup() {
                          const legalEntity = await createLegalEntity([
                            "ES256",
                          ]);
                          vpSigner = legalEntity.keys.ES256;
                          vpPayload.holder = vpSigner.did;

                          mockServer.use(
                            http.get(
                              escapeDid(
                                `${domain}/did-registry/v5/identifiers/${vpSigner.did}`,
                              ),
                              ({ request }) => {
                                const url = new URL(request.url);
                                const validAt =
                                  url.searchParams.get("valid-at");

                                // Only return the document if the valid-at parameter is present
                                if (!validAt) {
                                  return HttpResponse.json(
                                    "Invalid request (missing valid-at parameter)",
                                    { status: 404 },
                                  );
                                }

                                // Make sure the request has the x-request-id header
                                if (!request.headers.has("x-request-id")) {
                                  return HttpResponse.json(
                                    "Invalid request (missing x-request-id header)",
                                    { status: 400 },
                                  );
                                }

                                return HttpResponse.text(
                                  "Internal Server Error",
                                  {
                                    status: 500,
                                  },
                                );
                              },
                            ),
                          );

                          expectedError = {
                            error: "server_error",
                            error_description: `Unable to resolve ${vpSigner.did}. Error: internalServerError. Internal Server Error | Registry used: ${domain}/did-registry/v5/identifiers`,
                          };
                        },
                      },
                    );
                    break;
                  }
                  case TIR_INVITE_SCOPE: {
                    testCases.push(
                      // Present a VC without any of VerifiableAuthorisationForTrustChain, VerifiableAccreditationToAttest or VerifiableAccreditationToAccredit
                      {
                        setup() {
                          vcPayload.type = [
                            "VerifiableCredential",
                            "VerifiableAttestation",
                          ];

                          expectedError = {
                            error: "invalid_request",
                            error_description:
                              "Invalid Presentation Submission:\nFilterEvaluation tag: Input candidate failed filter evaluation: submission.descriptor_map[0]: presentation $ with nested credential $.vp.verifiableCredential[0];,MarkForSubmissionEvaluation tag: The input candidate is not eligible for submission: submission.descriptor_map[0]: presentation $ with nested credential $.vp.verifiableCredential[0];",
                          };
                        },
                      },
                      // For an unknown reason, the response from TIR is not as expected
                      {
                        setup() {
                          mockServer.use(
                            http.get(
                              escapeDid(
                                `${domain}/trusted-issuers-registry/v5/issuers/${vpSigner.did}`,
                              ),
                              ({ request }) => {
                                // Make sure the request has the x-request-id header
                                if (!request.headers.has("x-request-id")) {
                                  return HttpResponse.json(
                                    "Invalid request (missing x-request-id header)",
                                    { status: 400 },
                                  );
                                }

                                return HttpResponse.json({
                                  // Invalid body
                                });
                              },
                            ),
                          );

                          expectedError = {
                            error: "server_error",
                            error_description:
                              "Trusted Issuers Registry sent an invalid response",
                          };
                        },
                      },
                      // Issuer already has attributes
                      {
                        setup() {
                          mockServer.use(
                            http.get(
                              escapeDid(
                                `${domain}/trusted-issuers-registry/v5/issuers/${vpSigner.did}`,
                              ),
                              ({ request }) => {
                                // Make sure the request has the x-request-id header
                                if (!request.headers.has("x-request-id")) {
                                  return HttpResponse.json(
                                    "Invalid request (missing x-request-id header)",
                                    { status: 400 },
                                  );
                                }

                                return HttpResponse.json({
                                  attributes: `${domain}/trusted-issuers-registry/v5/issuers/${vpSigner.did}/attributes`,
                                  did: credentialSubject.did,
                                  hasAttributes: true,
                                });
                              },
                            ),
                          );

                          expectedError = {
                            error: "invalid_request",
                            error_description: `Invalid Verifiable Presentation: Trusted Issuer ${vpSigner.did} already has accreditations. Request an access token with scope "tir_write"`,
                          };
                        },
                      },
                    );
                    break;
                  }
                  case TIR_WRITE_SCOPE: {
                    testCases.push(
                      // Issuer can't be found
                      {
                        async setup() {
                          // VP Signer is not registered in the TIR
                          const legalEntity = await createLegalEntity([
                            "ES256",
                          ]);
                          vpSigner = legalEntity.keys.ES256;
                          vpPayload.holder = vpSigner.did;

                          mockServer.use(
                            http.get(
                              escapeDid(
                                `${domain}/did-registry/v5/identifiers/${vpSigner.did}`,
                              ),
                              ({ request }) => {
                                const url = new URL(request.url);
                                const validAt =
                                  url.searchParams.get("valid-at");

                                // Only return the document if the valid-at parameter is present
                                if (!validAt) {
                                  return HttpResponse.json(
                                    "Invalid request (missing valid-at parameter)",
                                    { status: 404 },
                                  );
                                }

                                // Make sure the request has the x-request-id header
                                if (!request.headers.has("x-request-id")) {
                                  return HttpResponse.json(
                                    "Invalid request (missing x-request-id header)",
                                    { status: 400 },
                                  );
                                }

                                return HttpResponse.json(
                                  legalEntity.didDocument,
                                );
                              },
                            ),
                            http.get(
                              escapeDid(
                                `${domain}/trusted-issuers-registry/v5/issuers/${vpSigner.did}`,
                              ),
                              ({ request }) => {
                                // Make sure the request has the x-request-id header
                                if (!request.headers.has("x-request-id")) {
                                  return HttpResponse.json(
                                    "Invalid request (missing x-request-id header)",
                                    { status: 400 },
                                  );
                                }

                                return HttpResponse.text("Not found", {
                                  status: 404,
                                });
                              },
                            ),
                          );

                          expectedError = {
                            error: "invalid_request",
                            error_description: `Invalid Verifiable Presentation: DID ${vpSigner.did} is not registered in the Trusted Issuers Registry`,
                          };
                        },
                      },
                      // TIR API returns an internal error
                      {
                        async setup() {
                          const legalEntity = await createLegalEntity([
                            "ES256",
                          ]);
                          vpSigner = legalEntity.keys.ES256;
                          vpPayload.holder = vpSigner.did;

                          mockServer.use(
                            http.get(
                              escapeDid(
                                `${domain}/did-registry/v5/identifiers/${vpSigner.did}`,
                              ),
                              ({ request }) => {
                                const url = new URL(request.url);
                                const validAt =
                                  url.searchParams.get("valid-at");

                                // Only return the document if the valid-at parameter is present
                                if (!validAt) {
                                  return HttpResponse.json(
                                    "Invalid request (missing valid-at parameter)",
                                    { status: 404 },
                                  );
                                }

                                // Make sure the request has the x-request-id header
                                if (!request.headers.has("x-request-id")) {
                                  return HttpResponse.json(
                                    "Invalid request (missing x-request-id header)",
                                    { status: 400 },
                                  );
                                }

                                return HttpResponse.json(
                                  legalEntity.didDocument,
                                );
                              },
                            ),
                            http.get(
                              escapeDid(
                                `${domain}/trusted-issuers-registry/v5/issuers/${vpSigner.did}`,
                              ),
                              ({ request }) => {
                                // Make sure the request has the x-request-id header
                                if (!request.headers.has("x-request-id")) {
                                  return HttpResponse.json(
                                    "Invalid request (missing x-request-id header)",
                                    { status: 400 },
                                  );
                                }

                                return HttpResponse.text(
                                  "Internal Server Error",
                                  {
                                    status: 500,
                                  },
                                );
                              },
                            ),
                          );

                          expectedError = {
                            error: "server_error",
                            error_description:
                              "Trusted Issuers Registry responded with an internal error",
                          };
                        },
                      },
                      // Issuer doesn't have any attribute
                      {
                        async setup() {
                          const legalEntity = await createLegalEntity([
                            "ES256",
                          ]);
                          vpSigner = legalEntity.keys.ES256;
                          vpPayload.holder = vpSigner.did;

                          mockServer.use(
                            http.get(
                              escapeDid(
                                `${domain}/did-registry/v5/identifiers/${vpSigner.did}`,
                              ),
                              ({ request }) => {
                                const url = new URL(request.url);
                                const validAt =
                                  url.searchParams.get("valid-at");

                                // Only return the document if the valid-at parameter is present
                                if (!validAt) {
                                  return HttpResponse.json(
                                    "Invalid request (missing valid-at parameter)",
                                    { status: 404 },
                                  );
                                }

                                // Make sure the request has the x-request-id header
                                if (!request.headers.has("x-request-id")) {
                                  return HttpResponse.json(
                                    "Invalid request (missing x-request-id header)",
                                    { status: 400 },
                                  );
                                }

                                return HttpResponse.json(
                                  legalEntity.didDocument,
                                );
                              },
                            ),
                            http.get(
                              escapeDid(
                                `${domain}/trusted-issuers-registry/v5/issuers/${vpSigner.did}`,
                              ),
                              ({ request }) => {
                                // Make sure the request has the x-request-id header
                                if (!request.headers.has("x-request-id")) {
                                  return HttpResponse.json(
                                    "Invalid request (missing x-request-id header)",
                                    { status: 400 },
                                  );
                                }

                                return HttpResponse.json({
                                  attributes: `${domain}/trusted-issuers-registry/v5/issuers/${vpSigner.did}/attributes`,
                                  did: credentialSubject.did,
                                  hasAttributes: false,
                                });
                              },
                            ),
                          );

                          expectedError = {
                            error: "invalid_request",
                            error_description: `Invalid Verifiable Presentation: Trusted Issuer ${vpSigner.did} doesn't have accreditations. Request an access token with scope "tir_invite"`,
                          };
                        },
                      },
                    );
                    break;
                  }
                  case TNT_AUTHORISE_SCOPE: {
                    testCases.push(
                      // Present a VC without VerifiableAuthorisationToOnboard
                      {
                        setup() {
                          vcPayload.type = [
                            "VerifiableCredential",
                            "VerifiableAttestation",
                          ];

                          expectedError = {
                            error: "invalid_request",
                            error_description: [
                              "Invalid Presentation Submission:",
                              "FilterEvaluation tag: Input candidate failed filter evaluation: submission.descriptor_map[0]: presentation $ with nested credential $.vp.verifiableCredential[0];,MarkForSubmissionEvaluation tag: The input candidate is not eligible for submission: submission.descriptor_map[0]: presentation $ with nested credential $.vp.verifiableCredential[0];",
                            ].join("\n"),
                          };
                        },
                      },
                      // TPR API returns an internal error
                      {
                        setup() {
                          mockServer.use(
                            http.get(
                              `${domain}/trusted-policies-registry/v3/users/${credentialSubject.address}`,
                              ({ request }) => {
                                // Make sure the request has the x-request-id header
                                if (!request.headers.has("x-request-id")) {
                                  return HttpResponse.json(
                                    "Invalid request (missing x-request-id header)",
                                    { status: 400 },
                                  );
                                }

                                return HttpResponse.text(
                                  "Internal Server Error",
                                  {
                                    status: 500,
                                  },
                                );
                              },
                            ),
                          );

                          expectedError = {
                            error: "server_error",
                            error_description: `Trusted Policies Registry API responded with an internal error`,
                          };
                        },
                      },
                    );
                    break;
                  }
                  case TNT_CREATE_SCOPE: {
                    testCases.push(
                      {
                        setup() {
                          mockServer.use(
                            ...["track-and-trace", "estat"].map((service) =>
                              http.head(
                                `${domain}/${service}/v1/accesses`,
                                ({ request: req }) => {
                                  const creator = new URL(
                                    req.url,
                                  ).searchParams.get("creator");

                                  if (creator === vpSigner.did) {
                                    return new HttpResponse(undefined, {
                                      status: 404,
                                    });
                                  }

                                  throw new Error(
                                    `Unexpected TnT Document creator: ${creator}`,
                                  );
                                },
                              ),
                            ),
                          );

                          expectedError = {
                            error: "invalid_request",
                            error_description: `Invalid Verifiable Presentation: DID ${vpSigner.did} is not allowlisted as a TnT Document creator`,
                          };
                        },
                      },
                      // TNT API returns an internal error
                      {
                        setup() {
                          mockServer.use(
                            ...["track-and-trace", "estat"].map((service) =>
                              http.head(
                                `${domain}/${service}/v1/accesses`,
                                ({ request: req }) => {
                                  const creator = new URL(
                                    req.url,
                                  ).searchParams.get("creator");

                                  if (creator === vpSigner.did) {
                                    return new HttpResponse(undefined, {
                                      status: 500,
                                    });
                                  }

                                  throw new Error(
                                    `Unexpected TnT Document creator: ${creator}`,
                                  );
                                },
                              ),
                            ),
                          );

                          expectedError = {
                            error: "server_error",
                            error_description:
                              "Track And Trace API responded with an internal error",
                          };
                        },
                      },
                    );
                    break;
                  }
                  case TNT_WRITE_SCOPE: {
                    testCases.push(
                      // Subject has no access
                      {
                        setup() {
                          mockServer.use(
                            ...["track-and-trace", "estat"].map((service) =>
                              http.get(
                                `${domain}/${service}/v1/accesses`,
                                ({ request: req }) => {
                                  // Make sure the request has the x-request-id header
                                  if (!req.headers.has("x-request-id")) {
                                    return HttpResponse.json(
                                      "Invalid request (missing x-request-id header)",
                                      { status: 400 },
                                    );
                                  }

                                  const subject = new URL(
                                    req.url,
                                  ).searchParams.get("subject");

                                  if (subject === vpSigner.did) {
                                    return HttpResponse.json(
                                      {
                                        items: [],
                                        links: {
                                          first: "",
                                          last: "",
                                          next: "",
                                          prev: "",
                                        },
                                        self: "",
                                        total: 0,
                                      } satisfies PaginatedList<Access>,
                                      { status: 200 },
                                    );
                                  }

                                  throw new Error(
                                    `Unexpected TnT subject: ${subject}`,
                                  );
                                },
                              ),
                            ),
                          );

                          expectedError = {
                            error: "invalid_request",
                            error_description: `Invalid Verifiable Presentation: DID ${vpSigner.did} doesn't have write or delegate permission in TnT`,
                          };
                        },
                      },
                      // TNT API returns an internal error
                      {
                        setup() {
                          mockServer.use(
                            ...["track-and-trace", "estat"].map((service) =>
                              http.get(
                                `${domain}/${service}/v1/accesses`,
                                ({ request }) => {
                                  // Make sure the request has the x-request-id header
                                  if (!request.headers.has("x-request-id")) {
                                    return HttpResponse.json(
                                      "Invalid request (missing x-request-id header)",
                                      { status: 400 },
                                    );
                                  }

                                  return HttpResponse.text(
                                    "Internal Server Error",
                                    {
                                      status: 500,
                                    },
                                  );
                                },
                              ),
                            ),
                          );

                          expectedError = {
                            error: "server_error",
                            error_description:
                              "Track And Trace API responded with an internal error",
                          };
                        },
                      },
                    );
                    break;
                  }
                  default: {
                    throw new Error("Unexpected case");
                  }
                }

                for (const testCase of testCases) {
                  setupEnvironment();
                  vpSigner = credentialSubject.keys.ES256;
                  await testCase.setup();

                  // Execute test
                  try {
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
                        credentialIssuer.keys.ES256,
                        ebsiEnvConfig,
                        {
                          skipValidation: true,
                        },
                      );

                      vpPayload.verifiableCredential = [vcJwt];
                    }

                    const nonce = randomUUID();
                    const now = Math.floor(Date.now() / 1000);

                    const vpJwt = await createVerifiablePresentationJwt(
                      vpPayload,
                      vpSigner,
                      serviceEndpoint,
                      ebsiEnvConfig,
                      {
                        exp: now + 60, // Expire in 60 seconds (less than the 5 minutes limit)
                        nbf: now,
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

                    expect(response.body).toStrictEqual(expectedError);
                    expect(response.status).toBe(400);
                    expect(
                      (response.headers as Record<string, unknown>)[
                        "content-type"
                      ],
                    ).toBe("application/json; charset=utf-8");
                  } finally {
                    // Teardown
                    mockServer.resetHandlers();
                  }
                }
              });

              it("should return an error when the VP JWT is not signed with the expected algorithm (validateCredentialsAlgos)", async () => {
                const vpSigner = credentialSubject.keys.EdDSA; // No presentation definition supports EdDSA

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
                    credentialIssuer.keys.ES256,
                    ebsiEnvConfig,
                    {
                      skipValidation: true,
                    },
                  );

                  vpPayload.verifiableCredential = [vcJwt];
                }

                if (customScope === TNT_CREATE_SCOPE) {
                  mockServer.use(
                    ...["track-and-trace", "estat"].map((service) =>
                      http.head(
                        `${domain}/${service}/v1/accesses`,
                        ({ request: req }) => {
                          const creator = new URL(req.url).searchParams.get(
                            "creator",
                          );

                          if (creator === vpPayload.holder) {
                            return new HttpResponse(undefined, {
                              status: 204,
                            });
                          }

                          throw new Error(
                            `Unexpected TnT Document creator: ${creator}`,
                          );
                        },
                      ),
                    ),
                  );
                }

                if (customScope === TNT_WRITE_SCOPE) {
                  mockServer.use(
                    ...["track-and-trace", "estat"].map((service) =>
                      http.get(
                        `${domain}/${service}/v1/accesses`,
                        ({ request: req }) => {
                          // Make sure the request has the x-request-id header
                          if (!req.headers.has("x-request-id")) {
                            return HttpResponse.json(
                              "Invalid request (missing x-request-id header)",
                              { status: 400 },
                            );
                          }

                          const subject = new URL(req.url).searchParams.get(
                            "subject",
                          );

                          if (subject === vpPayload.holder) {
                            return HttpResponse.json(
                              {
                                items: [
                                  {
                                    documentId: "0x00",
                                    grantedBy: "did:ebsi:1234",
                                    permission: "write",
                                    subject,
                                  },
                                ],
                                links: {
                                  first: "",
                                  last: "",
                                  next: "",
                                  prev: "",
                                },
                                self: "",
                                total: 1,
                              } satisfies PaginatedList<Access>,
                              { status: 200 },
                            );
                          }

                          throw new Error(`Unexpected TnT subject: ${subject}`);
                        },
                      ),
                    ),
                  );
                }

                const nonce = randomUUID();
                const now = Math.floor(Date.now() / 1000);

                const vpJwt = await createVerifiablePresentationJwt(
                  vpPayload,
                  vpSigner,
                  serviceEndpoint,
                  ebsiEnvConfig,
                  {
                    exp: now + 60, // Expire in 60 seconds (less than the 5 minutes limit)
                    nbf: now,
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
                  error: "invalid_request",
                  error_description:
                    "Invalid Verifiable Presentation: the algorithm 'EdDSA' is not supported",
                });

                expect(response.status).toBe(400);
              });

              it("should return an error when descriptor_map[0].path is invalid", async () => {
                if (
                  [
                    DIDR_WRITE_SCOPE,
                    TIMESTAMP_WRITE_SCOPE,
                    TIR_WRITE_SCOPE,
                    TNT_CREATE_SCOPE,
                    TNT_WRITE_SCOPE,
                    TPR_WRITE_SCOPE,
                    TSR_WRITE_SCOPE,
                  ].includes(customScope)
                ) {
                  expect.assertions(0);
                  return;
                }

                presentationSubmission.descriptor_map[0]!.path = "$[0]"; // should be "$"

                const vpSigner =
                  customScope === DIDR_INVITE_SCOPE
                    ? credentialSubject.keys.ES256K
                    : credentialSubject.keys.ES256;

                const vcJwt = await createVerifiableCredentialJwt(
                  vcPayload,
                  credentialIssuer.keys.ES256,
                  ebsiEnvConfig,
                  {
                    skipValidation: true,
                  },
                );

                vpPayload.verifiableCredential = [vcJwt];

                const nonce = randomUUID();
                const now = Math.floor(Date.now() / 1000);

                const vpJwt = await createVerifiablePresentationJwt(
                  vpPayload,
                  vpSigner,
                  serviceEndpoint,
                  ebsiEnvConfig,
                  {
                    exp: now + 60, // Expire in 60 seconds (less than the 5 minutes limit)
                    nbf: now,
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
                  error: "invalid_request",
                  error_description:
                    "Invalid Presentation Submission:\nSubmissionPathNotFound tag: Unable to extract path $[0] for submission.descriptor_path[0] from presentation(s);",
                });

                expect(response.status).toBe(400);
              });

              it("should return an error when descriptor_map[0].format is invalid", async () => {
                if (
                  [
                    DIDR_WRITE_SCOPE,
                    TIMESTAMP_WRITE_SCOPE,
                    TIR_WRITE_SCOPE,
                    TNT_CREATE_SCOPE,
                    TNT_WRITE_SCOPE,
                    TPR_WRITE_SCOPE,
                    TSR_WRITE_SCOPE,
                  ].includes(customScope)
                ) {
                  expect.assertions(0);
                  return;
                }

                presentationSubmission.descriptor_map[0]!.format = "jwt"; // should be "jwt_vp" or "jwt_vp_json"

                const vpSigner =
                  customScope === DIDR_INVITE_SCOPE
                    ? credentialSubject.keys.ES256K
                    : credentialSubject.keys.ES256;

                const vcJwt = await createVerifiableCredentialJwt(
                  vcPayload,
                  credentialIssuer.keys.ES256,
                  ebsiEnvConfig,
                  {
                    skipValidation: true,
                  },
                );

                vpPayload.verifiableCredential = [vcJwt];

                const nonce = randomUUID();
                const now = Math.floor(Date.now() / 1000);

                const vpJwt = await createVerifiablePresentationJwt(
                  vpPayload,
                  vpSigner,
                  serviceEndpoint,
                  ebsiEnvConfig,
                  {
                    exp: now + 60, // Expire in 60 seconds (less than the 5 minutes limit)
                    nbf: now,
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
                  error: "invalid_request",
                  error_description:
                    "Invalid Presentation Submission:\nSubmissionFormatNoMatch tag: VP at path $ has format jwt_vp, while submission.descriptor_path[0] has format jwt;",
                });

                expect(response.status).toBe(400);
              });

              it("should return an error when the credentials are signed with an unsupported algorithm (validateCredentialsAlgos)", async () => {
                if (
                  [
                    DIDR_WRITE_SCOPE,
                    TIMESTAMP_WRITE_SCOPE,
                    TIR_WRITE_SCOPE,
                    TNT_CREATE_SCOPE,
                    TNT_WRITE_SCOPE,
                    TPR_WRITE_SCOPE,
                    TSR_WRITE_SCOPE,
                  ].includes(customScope)
                ) {
                  expect.assertions(0);
                  return;
                }

                const vpSigner =
                  customScope === DIDR_INVITE_SCOPE
                    ? credentialSubject.keys.ES256K
                    : credentialSubject.keys.ES256;

                const vcJwt = await createVerifiableCredentialJwt(
                  vcPayload,
                  credentialIssuer.keys.EdDSA,
                  ebsiEnvConfig,
                  {
                    skipValidation: true,
                  },
                );

                vpPayload.verifiableCredential = [vcJwt];

                const nonce = randomUUID();
                const now = Math.floor(Date.now() / 1000);

                const vpJwt = await createVerifiablePresentationJwt(
                  vpPayload,
                  vpSigner,
                  serviceEndpoint,
                  ebsiEnvConfig,
                  {
                    exp: now + 60, // Expire in 60 seconds (less than the 5 minutes limit)
                    nbf: now,
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
                  error: "invalid_request",
                  error_description:
                    "Invalid Verifiable Credential: the algorithm 'EdDSA' is not supported",
                });

                expect(response.status).toBe(400);
              });

              it("should return an error when descriptor_map[0].path_nested.format is invalid (validateCredentialsAlgos)", async () => {
                if (
                  [
                    DIDR_WRITE_SCOPE,
                    TIMESTAMP_WRITE_SCOPE,
                    TIR_WRITE_SCOPE,
                    TNT_CREATE_SCOPE,
                    TNT_WRITE_SCOPE,
                    TPR_WRITE_SCOPE,
                    TSR_WRITE_SCOPE,
                  ].includes(customScope)
                ) {
                  expect.assertions(0);
                  return;
                }

                presentationSubmission.descriptor_map[0]!.path_nested!.format =
                  "jwt"; // should be "jwt_vc" or "jwt_vc_json"

                const vpSigner =
                  customScope === DIDR_INVITE_SCOPE
                    ? credentialSubject.keys.ES256K
                    : credentialSubject.keys.ES256;

                const vcJwt = await createVerifiableCredentialJwt(
                  vcPayload,
                  credentialIssuer.keys.ES256,
                  ebsiEnvConfig,
                  {
                    skipValidation: true,
                  },
                );

                vpPayload.verifiableCredential = [vcJwt];

                const nonce = randomUUID();
                const now = Math.floor(Date.now() / 1000);

                const vpJwt = await createVerifiablePresentationJwt(
                  vpPayload,
                  vpSigner,
                  serviceEndpoint,
                  ebsiEnvConfig,
                  {
                    exp: now + 60, // Expire in 60 seconds (less than the 5 minutes limit)
                    nbf: now,
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
                  error: "invalid_request",
                  error_description:
                    "Invalid Verifiable Presentation submission: format 'jwt' is not supported in 'descriptor_map[0].path_nested.format'",
                });

                expect(response.status).toBe(400);
              });

              it("should return an error when descriptor_map[0].path_nested.path is invalid", async () => {
                if (
                  [
                    DIDR_WRITE_SCOPE,
                    TIMESTAMP_WRITE_SCOPE,
                    TIR_WRITE_SCOPE,
                    TNT_CREATE_SCOPE,
                    TNT_WRITE_SCOPE,
                    TPR_WRITE_SCOPE,
                    TSR_WRITE_SCOPE,
                  ].includes(customScope)
                ) {
                  expect.assertions(0);
                  return;
                }

                presentationSubmission.descriptor_map[0]!.path_nested!.path =
                  "$.vp.verifiableCredential"; // Doesn't pass the regex /^\$\.vp\.verifiableCredential\[(\d*)\]/

                const vpSigner =
                  customScope === DIDR_INVITE_SCOPE
                    ? credentialSubject.keys.ES256K
                    : credentialSubject.keys.ES256;

                const vcJwt = await createVerifiableCredentialJwt(
                  vcPayload,
                  credentialIssuer.keys.ES256,
                  ebsiEnvConfig,
                  {
                    skipValidation: true,
                  },
                );

                vpPayload.verifiableCredential = [vcJwt];

                const nonce = randomUUID();
                const now = Math.floor(Date.now() / 1000);

                const vpJwt = await createVerifiablePresentationJwt(
                  vpPayload,
                  vpSigner,
                  serviceEndpoint,
                  ebsiEnvConfig,
                  {
                    exp: now + 60, // Expire in 60 seconds (less than the 5 minutes limit)
                    nbf: now,
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
                  error: "invalid_request",
                  error_description:
                    "Invalid Presentation Submission:\nSubmissionPathNotFound tag: Unable to find wrapped vc;",
                });

                expect(response.status).toBe(400);
              });

              it("should return an error when descriptor_map[0].path_nested.path doesn't match any credential", async () => {
                if (
                  [
                    DIDR_WRITE_SCOPE,
                    TIMESTAMP_WRITE_SCOPE,
                    TIR_WRITE_SCOPE,
                    TNT_CREATE_SCOPE,
                    TNT_WRITE_SCOPE,
                    TPR_WRITE_SCOPE,
                    TSR_WRITE_SCOPE,
                  ].includes(customScope)
                ) {
                  expect.assertions(0);
                  return;
                }

                presentationSubmission.descriptor_map[0]!.path_nested!.path =
                  "$.vp.verifiableCredential[1]"; // Doesn't match any credential

                const vpSigner =
                  customScope === DIDR_INVITE_SCOPE
                    ? credentialSubject.keys.ES256K
                    : credentialSubject.keys.ES256;

                const vcJwt = await createVerifiableCredentialJwt(
                  vcPayload,
                  credentialIssuer.keys.ES256,
                  ebsiEnvConfig,
                  {
                    skipValidation: true,
                  },
                );

                vpPayload.verifiableCredential = [vcJwt];

                const nonce = randomUUID();
                const now = Math.floor(Date.now() / 1000);

                const vpJwt = await createVerifiablePresentationJwt(
                  vpPayload,
                  vpSigner,
                  serviceEndpoint,
                  ebsiEnvConfig,
                  {
                    exp: now + 60, // Expire in 60 seconds (less than the 5 minutes limit)
                    nbf: now,
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
                  error: "invalid_request",
                  error_description:
                    "Invalid Presentation Submission:\nSubmissionPathNotFound tag: Unable to extract path_nested.path $.vp.verifiableCredential[1] for submission.descriptor_path[0] from verifiable presentation;",
                });

                expect(response.status).toBe(400);
              });

              it("should return an access token and an ID token when the presentation is valid", async () => {
                const vpSigner = [DIDR_INVITE_SCOPE, DIDR_WRITE_SCOPE].includes(
                  customScope,
                )
                  ? credentialSubject.keys.ES256K
                  : credentialSubject.keys.ES256;

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
                    credentialIssuer.keys.ES256,
                    ebsiEnvConfig,
                    {
                      skipValidation: true,
                    },
                  );

                  vpPayload.verifiableCredential = [vcJwt];
                }

                if (customScope === TNT_CREATE_SCOPE) {
                  mockServer.use(
                    ...["track-and-trace", "estat"].map((service) =>
                      http.head(
                        `${domain}/${service}/v1/accesses`,
                        ({ request: req }) => {
                          const creator = new URL(req.url).searchParams.get(
                            "creator",
                          );

                          if (creator === vpPayload.holder) {
                            return new HttpResponse(undefined, {
                              status: 204,
                            });
                          }

                          throw new Error(
                            `Unexpected TnT Document creator: ${creator}`,
                          );
                        },
                      ),
                    ),
                  );
                }

                if (customScope === TNT_WRITE_SCOPE) {
                  mockServer.use(
                    ...["track-and-trace", "estat"].map((service) =>
                      http.get(
                        `${domain}/${service}/v1/accesses`,
                        ({ request: req }) => {
                          // Make sure the request has the x-request-id header
                          if (!req.headers.has("x-request-id")) {
                            return HttpResponse.json(
                              "Invalid request (missing x-request-id header)",
                              { status: 400 },
                            );
                          }

                          const subject = new URL(req.url).searchParams.get(
                            "subject",
                          );

                          if (subject === vpPayload.holder) {
                            return HttpResponse.json(
                              {
                                items: [
                                  {
                                    documentId: "0x00",
                                    grantedBy: "did:ebsi:1234",
                                    permission: "write",
                                    subject,
                                  },
                                ],
                                links: {
                                  first: "",
                                  last: "",
                                  next: "",
                                  prev: "",
                                },
                                self: "",
                                total: 1,
                              } satisfies PaginatedList<Access>,
                              { status: 200 },
                            );
                          }

                          throw new Error(`Unexpected TnT subject: ${subject}`);
                        },
                      ),
                    ),
                  );
                }

                const nonce = randomUUID();
                const now = Math.floor(Date.now() / 1000);

                const vpJwt = await createVerifiablePresentationJwt(
                  vpPayload,
                  vpSigner,
                  serviceEndpoint,
                  ebsiEnvConfig,
                  {
                    exp: now + 60, // Expire in 60 seconds (less than the 5 minutes limit)
                    nbf: now,
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
                  aud: `${domain}/authorisation/v4`,
                  exp: expect.any(Number),
                  iat: expect.any(Number),
                  iss: `${domain}/authorisation/v4`,
                  jti: expect.any(String),
                  scp: scope,
                  sub: credentialSubject.did,
                  ...(customScope === LEDGER_INVOKE_SCOPE && {
                    authorization_details: {
                      addresses: ["0x61c36a8d610163660E21a8b7359e1Cac0C9133e1"],
                    },
                  }),
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
                  aud: credentialSubject.did,
                  exp: expect.any(Number),
                  iat: expect.any(Number),
                  iss: `${domain}/authorisation/v4`,
                  jti: expect.any(String),
                  nonce,
                  sub: credentialSubject.did,
                });

                await expect(
                  jwtVerify(idToken, apiPublicKey),
                ).resolves.not.toThrow();
              });
            },
          );

          it("with scope 'openid tnt_authorise' should return an error if the verification method is not in 'capabilityInvocation'", async () => {
            expect.assertions(2);

            const scope = "openid tnt_authorise";
            const issuanceDate = new Date(Date.now() - 5000); // issue 5 seconds ago
            // JWT access token must have 2 hours expiration time and there are no Refresh Tokens.
            const expirationDate = new Date(
              issuanceDate.getTime() + 2 * 60 * 60 * 1000,
            );
            const vcPayload = {
              "@context": ["https://www.w3.org/2018/credentials/v1"],
              credentialSchema: [
                {
                  id:
                    uriType === "EBSI URI"
                      ? fromUrl(attestationSchema, ebsiEnvConfig)
                      : attestationSchema,
                  type: "FullJsonSchemaValidator2021",
                },
                {
                  id:
                    uriType === "EBSI URI"
                      ? fromUrl(issuanceCertificateSchema, ebsiEnvConfig)
                      : issuanceCertificateSchema,
                  type: "FullJsonSchemaValidator2021",
                },
              ],
              credentialSubject: {
                id: credentialSubject.did,
              },
              expirationDate: `${expirationDate.toISOString().slice(0, -5)}Z`,
              id: `urn:uuid:${randomUUID()}`,
              issuanceDate: `${issuanceDate.toISOString().slice(0, -5)}Z`,
              issued: `${issuanceDate.toISOString().slice(0, -5)}Z`,
              issuer: credentialIssuer.did,
              termsOfUse: {
                id:
                  uriType === "EBSI URI"
                    ? fromUrl(credentialIssuerAccreditationUrl, ebsiEnvConfig)
                    : credentialIssuerAccreditationUrl,
                type: "IssuanceCertificate",
              },
              type: [
                "VerifiableCredential",
                "VerifiableAttestation",
                "VerifiableAuthorisationToOnboard",
              ],
              validFrom: `${issuanceDate.toISOString().slice(0, -5)}Z`,
            } satisfies Schemas["Attestation"] &
              TypeExtensions["termsOfUse"]["IssuanceCertificate"];

            const vcJwt = await createVerifiableCredentialJwt(
              vcPayload as Schemas["Attestation"],
              credentialIssuer.keys.ES256,
              ebsiEnvConfig,
              {
                skipValidation: true,
              },
            );

            const vpPayload = {
              "@context": ["https://www.w3.org/2018/credentials/v1"],
              holder: credentialSubject.did,
              id: `urn:uuid:${randomUUID()}`,
              type: ["VerifiablePresentation"],
              verifiableCredential: [vcJwt],
            } satisfies Schemas["Presentation"];

            // Reset to valid presentation submission before each test
            const presentationSubmission = createPresentationSubmission(
              TNT_AUTHORISE_SCOPE,
              vpFormat,
              vcFormat,
            );

            const didDocument = createDidDocument(
              credentialSubject.did,
              credentialSubject.keys,
            );

            // Remove capabilityInvocation, which is required in order to get an access token with tnt_authorise scope
            didDocument.capabilityInvocation = [];

            mockServer.use(
              http.get(
                escapeDid(
                  `${domain}/did-registry/v5/identifiers/${credentialSubject.did}`,
                ),
                ({ request }) => {
                  // Make sure the request has the x-request-id header
                  if (!request.headers.has("x-request-id")) {
                    return HttpResponse.json(
                      "Invalid request (missing x-request-id header)",
                      { status: 400 },
                    );
                  }

                  return HttpResponse.json(didDocument);
                },
              ),
            );

            const nonce = randomUUID();
            const now = Math.floor(Date.now() / 1000);

            const vpJwt = await createVerifiablePresentationJwt(
              vpPayload as Schemas["Presentation"],
              credentialSubject.keys.ES256K,
              serviceEndpoint,
              ebsiEnvConfig,
              {
                exp: now + 60, // Expire in 60 seconds (less than the 5 minutes limit)
                nbf: now,
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
              error: "invalid_request",
              error_description: `Invalid Verifiable Presentation: Could not find a verification method related to "${credentialSubject.keys.ES256K.kid}" for the proof purpose "capabilityInvocation" and algorithm "ES256K"`,
            });

            expect(response.status).toBe(400);

            mockServer.resetHandlers();
          });

          it("with scope 'openid tnt_authorise' should return an error if the user is not registered in the Trusted Policies Registry", async () => {
            expect.assertions(6);

            const scope = "openid tnt_authorise";
            const issuanceDate = new Date(Date.now() - 5000); // issue 5 seconds ago
            // JWT access token must have 2 hours expiration time and there are no Refresh Tokens.
            const expirationDate = new Date(
              issuanceDate.getTime() + 2 * 60 * 60 * 1000,
            );
            const vcPayload = {
              "@context": ["https://www.w3.org/2018/credentials/v1"],
              credentialSchema: [
                {
                  id:
                    uriType === "EBSI URI"
                      ? fromUrl(attestationSchema, ebsiEnvConfig)
                      : attestationSchema,
                  type: "FullJsonSchemaValidator2021",
                },
                {
                  id:
                    uriType === "EBSI URI"
                      ? fromUrl(issuanceCertificateSchema, ebsiEnvConfig)
                      : issuanceCertificateSchema,
                  type: "FullJsonSchemaValidator2021",
                },
              ],
              credentialSubject: {
                id: credentialSubject.did,
              },
              expirationDate: `${expirationDate.toISOString().slice(0, -5)}Z`,
              id: `urn:uuid:${randomUUID()}`,
              issuanceDate: `${issuanceDate.toISOString().slice(0, -5)}Z`,
              issued: `${issuanceDate.toISOString().slice(0, -5)}Z`,
              issuer: credentialIssuer.did,
              termsOfUse: {
                id:
                  uriType === "EBSI URI"
                    ? fromUrl(credentialIssuerAccreditationUrl, ebsiEnvConfig)
                    : credentialIssuerAccreditationUrl,
                type: "IssuanceCertificate",
              },
              type: [
                "VerifiableCredential",
                "VerifiableAttestation",
                "VerifiableAuthorisationToOnboard",
              ],
              validFrom: `${issuanceDate.toISOString().slice(0, -5)}Z`,
            } satisfies Schemas["Attestation"] &
              TypeExtensions["termsOfUse"]["IssuanceCertificate"];

            const vcJwt = await createVerifiableCredentialJwt(
              vcPayload as Schemas["Attestation"],
              credentialIssuer.keys.ES256,
              ebsiEnvConfig,
              {
                skipValidation: true,
              },
            );

            const vpPayload = {
              "@context": ["https://www.w3.org/2018/credentials/v1"],
              holder: credentialSubject.did,
              id: `urn:uuid:${randomUUID()}`,
              type: ["VerifiablePresentation"],
              verifiableCredential: [vcJwt],
            } satisfies Schemas["Presentation"];

            // Reset to valid presentation submission before each test
            const presentationSubmission = createPresentationSubmission(
              TNT_AUTHORISE_SCOPE,
              vpFormat,
              vcFormat,
            );

            const didDocument = createDidDocument(
              credentialSubject.did,
              credentialSubject.keys,
            );

            mockServer.use(
              http.get(
                escapeDid(
                  `${domain}/did-registry/v5/identifiers/${credentialSubject.did}`,
                ),
                ({ request }) => {
                  // Make sure the request has the x-request-id header
                  if (!request.headers.has("x-request-id")) {
                    return HttpResponse.json(
                      "Invalid request (missing x-request-id header)",
                      { status: 400 },
                    );
                  }

                  return HttpResponse.json(didDocument);
                },
              ),
              // Network error with TPR
              http.get(
                `${domain}/trusted-policies-registry/v3/users/${credentialSubject.address}`,
                ({ request }) => {
                  // Make sure the request has the x-request-id header
                  if (!request.headers.has("x-request-id")) {
                    return HttpResponse.json(
                      "Invalid request (missing x-request-id header)",
                      { status: 400 },
                    );
                  }

                  return HttpResponse.error();
                },
              ),
            );

            let nonce = randomUUID();

            const now = Math.floor(Date.now() / 1000);
            let vpJwt = await createVerifiablePresentationJwt(
              vpPayload as Schemas["Presentation"],
              credentialSubject.keys.ES256K,
              serviceEndpoint,
              ebsiEnvConfig,
              {
                exp: now + 60, // Expire in 60 seconds (less than the 5 minutes limit)
                nbf: now,
                nonce,
                skipValidation: true,
              },
            );

            // Connection error with TPR - there is no TPR mock
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
              error_description: `Invalid Verifiable Presentation: DID ${credentialSubject.did} is not authorised for ${TNT_AUTHORISE_SCOPE} access. Errors: Error from Trusted Policies Registry: Network error`,
            });

            expect(response.status).toBe(400);

            nonce = randomUUID();

            vpJwt = await createVerifiablePresentationJwt(
              vpPayload as Schemas["Presentation"],
              credentialSubject.keys.ES256K,
              serviceEndpoint,
              ebsiEnvConfig,
              {
                exp: now + 60, // Expire in 60 seconds (less than the 5 minutes limit)
                nbf: now,
                nonce,
                skipValidation: true,
              },
            );

            // The user is not registered in TPR
            mockServer.use(
              http.get(
                `${domain}/trusted-policies-registry/v3/users/${credentialSubject.address}`,
                ({ request }) => {
                  // Make sure the request has the x-request-id header
                  if (!request.headers.has("x-request-id")) {
                    return HttpResponse.json(
                      "Invalid request (missing x-request-id header)",
                      { status: 400 },
                    );
                  }

                  return HttpResponse.text("Not found", { status: 404 });
                },
              ),
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
              error_description: `Invalid Verifiable Presentation: DID ${credentialSubject.did} is not authorised for ${TNT_AUTHORISE_SCOPE} access. Errors: address ${credentialSubject.address} not in Trusted Policies Registry`,
            });

            expect(response.status).toBe(400);

            nonce = randomUUID();

            vpJwt = await createVerifiablePresentationJwt(
              vpPayload as Schemas["Presentation"],
              credentialSubject.keys.ES256K,
              serviceEndpoint,
              ebsiEnvConfig,
              {
                exp: now + 60, // Expire in 60 seconds (less than the 5 minutes limit)
                nbf: now,
                nonce,
                skipValidation: true,
              },
            );

            // User registered in TPR but without the correct attribute
            mockServer.use(
              http.get(
                `${domain}/trusted-policies-registry/v3/users/${credentialSubject.address}`,
                ({ request }) => {
                  // Make sure the request has the x-request-id header
                  if (!request.headers.has("x-request-id")) {
                    return HttpResponse.json(
                      "Invalid request (missing x-request-id header)",
                      { status: 400 },
                    );
                  }

                  return HttpResponse.json({
                    attributes: ["not TNT attribute"],
                    user: credentialSubject.address,
                  });
                },
              ),
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
              error_description: `Invalid Verifiable Presentation: DID ${credentialSubject.did} is not authorised for ${TNT_AUTHORISE_SCOPE} access. Errors: address ${credentialSubject.address} doesn't have the attribute TNT:authoriseDid in Trusted Policies Registry`,
            });

            expect(response.status).toBe(400);

            mockServer.resetHandlers();
          });

          it("with scope 'openid ledger_invoke' should return an error if the VC issuer is not the contract deployer", async () => {
            expect.assertions(8);

            const scope = "openid ledger_invoke";
            const issuanceDate = new Date(Date.now() - 5000); // issue 5 seconds ago
            // JWT access token must have 2 hours expiration time and there are no Refresh Tokens.
            const expirationDate = new Date(
              issuanceDate.getTime() + 2 * 60 * 60 * 1000,
            );
            const vcPayload = {
              "@context": ["https://www.w3.org/2018/credentials/v1"],
              credentialSchema: [
                {
                  id:
                    uriType === "EBSI URI"
                      ? fromUrl(attestationSchema, ebsiEnvConfig)
                      : attestationSchema,
                  type: "FullJsonSchemaValidator2021",
                },
                {
                  id:
                    uriType === "EBSI URI"
                      ? fromUrl(issuanceCertificateSchema, ebsiEnvConfig)
                      : issuanceCertificateSchema,
                  type: "FullJsonSchemaValidator2021",
                },
              ],
              credentialSubject: {
                id: credentialSubject.did,
                // Missing "contractAddress"
              },
              expirationDate: `${expirationDate.toISOString().slice(0, -5)}Z`,
              id: `urn:uuid:${randomUUID()}`,
              issuanceDate: `${issuanceDate.toISOString().slice(0, -5)}Z`,
              issued: `${issuanceDate.toISOString().slice(0, -5)}Z`,
              issuer: credentialIssuer.did,
              termsOfUse: {
                id:
                  uriType === "EBSI URI"
                    ? fromUrl(credentialIssuerAccreditationUrl, ebsiEnvConfig)
                    : credentialIssuerAccreditationUrl,
                type: "IssuanceCertificate",
              },
              type: [
                "VerifiableCredential",
                "VerifiableAttestation",
                "VerifiableAuthorisationToInvoke",
              ],
              validFrom: `${issuanceDate.toISOString().slice(0, -5)}Z`,
            } satisfies Schemas["Attestation"] &
              TypeExtensions["termsOfUse"]["IssuanceCertificate"];

            let vcJwt = await createVerifiableCredentialJwt(
              vcPayload as Schemas["Attestation"],
              credentialIssuer.keys.ES256,
              ebsiEnvConfig,
              {
                skipValidation: true,
              },
            );

            const vpPayload = {
              "@context": ["https://www.w3.org/2018/credentials/v1"],
              holder: credentialSubject.did,
              id: `urn:uuid:${randomUUID()}`,
              type: ["VerifiablePresentation"],
              verifiableCredential: [vcJwt],
            } satisfies Schemas["Presentation"];

            // Reset to valid presentation submission before each test
            const presentationSubmission = createPresentationSubmission(
              LEDGER_INVOKE_SCOPE,
              vpFormat,
              vcFormat,
            );

            const didDocument = createDidDocument(
              credentialSubject.did,
              credentialSubject.keys,
            );

            mockServer.use(
              http.get(
                escapeDid(
                  `${domain}/did-registry/v5/identifiers/${credentialSubject.did}`,
                ),
                ({ request }) => {
                  // Make sure the request has the x-request-id header
                  if (!request.headers.has("x-request-id")) {
                    return HttpResponse.json(
                      "Invalid request (missing x-request-id header)",
                      { status: 400 },
                    );
                  }

                  return HttpResponse.json(didDocument);
                },
              ),
            );

            let nonce = randomUUID();

            const now = Math.floor(Date.now() / 1000);
            let vpJwt = await createVerifiablePresentationJwt(
              vpPayload as Schemas["Presentation"],
              credentialSubject.keys.ES256K,
              serviceEndpoint,
              ebsiEnvConfig,
              {
                exp: now + 60, // Expire in 60 seconds (less than the 5 minutes limit)
                nbf: now,
                nonce,
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
              error_description:
                "Invalid Verifiable Presentation: VC credential subject is missing contractAddress",
            });

            expect(response.status).toBe(400);

            nonce = randomUUID();

            vcPayload.credentialSubject = {
              ...vcPayload.credentialSubject,
              // @ts-expect-error Add missing property
              contractAddress: "0x61c36a8d610163660E21a8b7359e1Cac0C9133e1",
            };

            vcJwt = await createVerifiableCredentialJwt(
              vcPayload as Schemas["Attestation"],
              credentialIssuer.keys.ES256,
              ebsiEnvConfig,
              {
                skipValidation: true,
              },
            );

            vpPayload.verifiableCredential = [vcJwt];

            vpJwt = await createVerifiablePresentationJwt(
              vpPayload as Schemas["Presentation"],
              credentialSubject.keys.ES256K,
              serviceEndpoint,
              ebsiEnvConfig,
              {
                exp: now + 60, // Expire in 60 seconds (less than the 5 minutes limit)
                nbf: now,
                nonce,
                skipValidation: true,
              },
            );

            // The contract doesn't exist
            mockServer.use(
              http.get(
                `${domain}/trusted-contracts-registry/v1/contracts/0x61c36a8d610163660E21a8b7359e1Cac0C9133e1`,
                ({ request }) => {
                  // Make sure the request has the x-request-id header
                  if (!request.headers.has("x-request-id")) {
                    return HttpResponse.json(
                      "Invalid request (missing x-request-id header)",
                      { status: 400 },
                    );
                  }

                  return HttpResponse.text("Not found", { status: 404 });
                },
              ),
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
              error_description:
                "Invalid Verifiable Credential: contract 0x61c36a8d610163660E21a8b7359e1Cac0C9133e1 does not exist",
            });

            expect(response.status).toBe(400);

            nonce = randomUUID();

            vpJwt = await createVerifiablePresentationJwt(
              vpPayload as Schemas["Presentation"],
              credentialSubject.keys.ES256K,
              serviceEndpoint,
              ebsiEnvConfig,
              {
                exp: now + 60, // Expire in 60 seconds (less than the 5 minutes limit)
                nbf: now,
                nonce,
                skipValidation: true,
              },
            );

            // The contract deployerDID is different from the VC issuer
            mockServer.use(
              http.get(
                `${domain}/trusted-contracts-registry/v1/contracts/0x61c36a8d610163660E21a8b7359e1Cac0C9133e1`,
                ({ request }) => {
                  // Make sure the request has the x-request-id header
                  if (!request.headers.has("x-request-id")) {
                    return HttpResponse.json(
                      "Invalid request (missing x-request-id header)",
                      { status: 400 },
                    );
                  }

                  return HttpResponse.json({
                    address: "0x61c36a8d610163660E21a8b7359e1Cac0C9133e1",
                    deployer: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
                    deployerDID: "did:ebsi:zqz4ibiG9bWhPBiebPeeGVB",
                    deploymentTimestamp: 1_760_600_272,
                    isActive: true,
                    templateId:
                      "0x957cef8a6ccfa45ea37ec9976fa2cdeb916d96039d6dac5bd68e37284bc187f4",
                  });
                },
              ),
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
              error_description: `Invalid Verifiable Presentation: VC issuer is not the smart contract deployer`,
            });

            expect(response.status).toBe(400);

            nonce = randomUUID();

            vpJwt = await createVerifiablePresentationJwt(
              vpPayload as Schemas["Presentation"],
              credentialSubject.keys.ES256K,
              serviceEndpoint,
              ebsiEnvConfig,
              {
                exp: now + 60, // Expire in 60 seconds (less than the 5 minutes limit)
                nbf: now,
                nonce,
                skipValidation: true,
              },
            );

            // The contract is not active
            mockServer.use(
              http.get(
                `${domain}/trusted-contracts-registry/v1/contracts/0x61c36a8d610163660E21a8b7359e1Cac0C9133e1`,
                ({ request }) => {
                  // Make sure the request has the x-request-id header
                  if (!request.headers.has("x-request-id")) {
                    return HttpResponse.json(
                      "Invalid request (missing x-request-id header)",
                      { status: 400 },
                    );
                  }

                  return HttpResponse.json({
                    address: "0x61c36a8d610163660E21a8b7359e1Cac0C9133e1",
                    deployer: credentialIssuer.address,
                    deployerDID: credentialIssuer.did,
                    deploymentTimestamp: 1_760_600_272,
                    isActive: false,
                    templateId:
                      "0x957cef8a6ccfa45ea37ec9976fa2cdeb916d96039d6dac5bd68e37284bc187f4",
                  });
                },
              ),
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
              error_description:
                "Invalid Verifiable Credential: contract 0x61c36a8d610163660E21a8b7359e1Cac0C9133e1 is not active",
            });

            expect(response.status).toBe(400);

            mockServer.resetHandlers();
          });
        },
      );

      // Bug fix: EBSIINT-5937
      // Fix Axios error handling (was returning "Unexpected error")
      it("Fix EBSIINT-5937 (VP format: %s, VC format: %s)", async () => {
        const vpFormat = "jwt_vp";
        const vcFormat = "jwt_vc";
        const customScope = TIR_INVITE_SCOPE;

        const scope: Scope = `openid ${customScope}`;

        const issuanceDate = new Date(Date.now() - 5000); // issue 5 seconds ago
        // JWT access token must have 2 hours expiration time and there are no Refresh Tokens.
        const expirationDate = new Date(
          issuanceDate.getTime() + 2 * 60 * 60 * 1000,
        );
        const vcPayload = {
          "@context": ["https://www.w3.org/2018/credentials/v1"],
          credentialSchema: [
            {
              id:
                uriType === "EBSI URI"
                  ? fromUrl(attestationSchema, ebsiEnvConfig)
                  : attestationSchema,
              type: "FullJsonSchemaValidator2021",
            },
            {
              id:
                uriType === "EBSI URI"
                  ? fromUrl(issuanceCertificateSchema, ebsiEnvConfig)
                  : issuanceCertificateSchema,
              type: "FullJsonSchemaValidator2021",
            },
          ],
          credentialSubject: {
            id: credentialSubject.did,
          },
          expirationDate: `${expirationDate.toISOString().slice(0, -5)}Z`,
          id: `urn:uuid:${randomUUID()}`,
          issuanceDate: `${issuanceDate.toISOString().slice(0, -5)}Z`,
          issued: `${issuanceDate.toISOString().slice(0, -5)}Z`,
          issuer: credentialIssuer.did,
          termsOfUse: {
            id:
              uriType === "EBSI URI"
                ? fromUrl(credentialIssuerAccreditationUrl, ebsiEnvConfig)
                : credentialIssuerAccreditationUrl,
            type: "IssuanceCertificate",
          },
          type: ["VerifiableCredential", "VerifiableAttestation"],
          validFrom: `${issuanceDate.toISOString().slice(0, -5)}Z`,
        } satisfies Schemas["Attestation"] &
          TypeExtensions["termsOfUse"]["IssuanceCertificate"];
        if (customScope === TIR_INVITE_SCOPE) {
          vcPayload.type.push("VerifiableAccreditationToAccredit");
        } else if (
          customScope === DIDR_INVITE_SCOPE ||
          customScope === TNT_AUTHORISE_SCOPE
        ) {
          vcPayload.type.push("VerifiableAuthorisationToOnboard");
        }

        const vpPayload = {
          "@context": ["https://www.w3.org/2018/credentials/v1"],
          holder: credentialSubject.did,
          id: `urn:uuid:${randomUUID()}`,
          type: ["VerifiablePresentation"],
          verifiableCredential: [] as string[],
        } satisfies Schemas["Presentation"];

        // Reset to valid presentation submission before each test
        const presentationSubmission = createPresentationSubmission(
          customScope,
          vpFormat,
          vcFormat,
        );

        // VP Signer is not registered in the TIR
        const vpSigner = [DIDR_INVITE_SCOPE, DIDR_WRITE_SCOPE].includes(
          customScope,
        )
          ? await createLegalEntity(["ES256K"])
          : await createLegalEntity(["ES256"]);
        vpPayload.holder = vpSigner.did;

        if (
          [DIDR_INVITE_SCOPE, TIR_INVITE_SCOPE, TNT_AUTHORISE_SCOPE].includes(
            customScope,
          )
        ) {
          vcPayload.credentialSubject.id = vpPayload.holder;
          const vcJwt = await createVerifiableCredentialJwt(
            vcPayload as Schemas["Attestation"],
            credentialIssuer.keys.ES256,
            ebsiEnvConfig,
            {
              skipValidation: true,
            },
          );

          vpPayload.verifiableCredential = [vcJwt];
        }

        mockServer.use(
          http.get(
            escapeDid(`${domain}/did-registry/v5/identifiers/${vpSigner.did}`),
            ({ request }) => {
              const url = new URL(request.url);
              const validAt = url.searchParams.get("valid-at");

              // Only return the document if the valid-at parameter is present
              if (!validAt) {
                return HttpResponse.json(
                  "Invalid request (missing valid-at parameter)",
                  { status: 404 },
                );
              }

              // Make sure the request has the x-request-id header
              if (!request.headers.has("x-request-id")) {
                return HttpResponse.json(
                  "Invalid request (missing x-request-id header)",
                  { status: 400 },
                );
              }

              return HttpResponse.json(vpSigner.didDocument);
            },
          ),
          http.get(
            escapeDid(
              `${domain}/trusted-issuers-registry/v5/issuers/${vpSigner.did}`,
            ),
            ({ request }) => {
              // Make sure the request has the x-request-id header
              if (!request.headers.has("x-request-id")) {
                return HttpResponse.json(
                  "Invalid request (missing x-request-id header)",
                  { status: 400 },
                );
              }

              return HttpResponse.text("Not found", { status: 404 });
            },
          ),
        );

        const expectedErrorMessage = `Invalid Verifiable Presentation: DID ${vpSigner.did} is not registered in the Trusted Issuers Registry`;

        const nonce = randomUUID();
        const now = Math.floor(Date.now() / 1000);

        const vpJwt = await createVerifiablePresentationJwt(
          vpPayload as Schemas["Presentation"],
          "ES256K" in vpSigner.keys
            ? vpSigner.keys.ES256K
            : vpSigner.keys.ES256,
          serviceEndpoint,
          ebsiEnvConfig,
          {
            exp: now + 60, // Expire in 60 seconds (less than the 5 minutes limit)
            nbf: now,
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
              presentation_submission: JSON.stringify(presentationSubmission),
              scope,
              vp_token: vpJwt,
            } satisfies CreateAccessTokenDto).toString(),
          );

        expect(response.body).toStrictEqual({
          error: "invalid_request",
          error_description: expectedErrorMessage,
        });
        expect(response.status).toBe(400);
        expect(
          (response.headers as Record<string, unknown>)["content-type"],
        ).toBe("application/json; charset=utf-8");
      });
    },
  );
});
