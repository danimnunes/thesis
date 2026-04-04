import type { PaginatedList } from "@ebsiint-api/shared";
import type { JWTHeader, JWTPayload } from "@europeum-ebsi/did-jwt";
import type {
  EbsiEnvConfiguration,
  ProofPurposeTypes,
} from "@europeum-ebsi/verifiable-presentation";
import type {
  Schemas,
  VpJwtPayload,
} from "@europeum-ebsi/verifiable-presentation/vcdm11.js";
import type { Checked } from "@sphereon/pex";
import type {
  PresentationDefinitionV2,
  PresentationSubmission,
} from "@sphereon/pex-models";
import type { AxiosResponse } from "axios";
import type { Cache } from "cache-manager";
import type { DIDDocument } from "did-resolver";

import { encode, getPublicKeyJwk, logAxiosError } from "@ebsiint-api/shared";
import {
  createJWT,
  decodeJWT,
  ES256Signer,
  hexToBytes,
} from "@europeum-ebsi/did-jwt";
import { verifyPresentationJwt } from "@europeum-ebsi/verifiable-presentation/vcdm11.js";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PEXv2 } from "@sphereon/pex";
import axios, { isAxiosError } from "axios";
import { ethers } from "ethers";
import { decodeJwt } from "jose";
import { randomUUID } from "node:crypto";

import type { ApiConfig } from "../../config/configuration.ts";
import type {
  Access,
  JsonWebKeySet,
  OPMetadata,
  TokenResponse,
  TrustedContract,
} from "./authorisation.interfaces.ts";

import {
  CUSTOM_SCOPES,
  DIDR_INVITE_SCOPE,
  LEDGER_INVOKE_SCOPE,
  PRESENTATION_DEFINITIONS,
  SUPPORTED_SCOPES,
  TIR_INVITE_SCOPE,
  TIR_WRITE_SCOPE,
  TNT_AUTHORISE_SCOPE,
  TNT_CREATE_SCOPE,
  TNT_WRITE_SCOPE,
} from "./authorisation.constants.ts";
import { parseDto } from "./authorisation.utils.ts";
import { CreateAccessTokenDto } from "./dto/index.ts";
import { ClassValidatorError, OAuth2TokenError } from "./errors/index.ts";
import {
  issuerSchema,
  presentationSubmissionSchema,
} from "./validators/index.ts";

@Injectable()
export class AuthorisationService {
  private readonly apiES256PrivateKey: Uint8Array;

  private readonly cacheManager: Cache;

  private readonly didRegistry: string;

  private readonly ebsiEnvConfig: EbsiEnvConfiguration;

  private readonly estatAccessesEndpoint: string | undefined;

  private readonly issuer: string;

  private readonly logger = new Logger(AuthorisationService.name);

  private publicKeyJwk?: Awaited<ReturnType<typeof getPublicKeyJwk>>;

  private readonly requestTimeout: number;

  private readonly trackAndTraceAccessesEndpoint: string;

  private readonly trustedContractsRegistry: string;

  private readonly trustedIssuersRegistry: string;

  private readonly trustedPoliciesRegistry: string;

  constructor(
    configService: ConfigService<ApiConfig, true>,
    @Inject(CACHE_MANAGER) cacheManager: Cache,
  ) {
    this.cacheManager = cacheManager;
    const domain = configService.get("domain", { infer: true });
    const apiUrlPrefix = configService.get("apiUrlPrefix", { infer: true });
    this.issuer = `${domain}${apiUrlPrefix}`;
    this.ebsiEnvConfig = configService.get("ebsiEnvConfig", { infer: true });
    this.didRegistry = configService.get("didRegistry", { infer: true });
    this.trustedContractsRegistry = configService.get(
      "trustedContractsRegistry",
      { infer: true },
    );
    this.trustedIssuersRegistry = configService.get("trustedIssuersRegistry", {
      infer: true,
    });
    this.trustedPoliciesRegistry = configService.get(
      "trustedPoliciesRegistry",
      {
        infer: true,
      },
    );
    this.trackAndTraceAccessesEndpoint = configService.get(
      "trackAndTraceAccessesEndpoint",
      {
        infer: true,
      },
    );
    this.estatAccessesEndpoint = configService.get("estatAccessesEndpoint", {
      infer: true,
    });
    this.apiES256PrivateKey = hexToBytes(
      configService.get("apiES256PrivateKey", { infer: true }),
    );
    this.requestTimeout = configService.get("requestTimeout", { infer: true });
  }

  async createAccessToken(
    body: unknown,
    reqId: string,
  ): Promise<TokenResponse> {
    // Validate query params (full DTO)
    let parsedDto: CreateAccessTokenDto;
    try {
      parsedDto = await parseDto(body, CreateAccessTokenDto);
    } catch (error) {
      // Unknown error during validation
      if (!(error instanceof ClassValidatorError)) {
        throw new OAuth2TokenError("invalid_request", {
          errorDescription:
            error instanceof Error ? error.message : "Unknown error",
        });
      }

      // Return first error
      const { constraints } = error.validationError;

      if (!constraints) {
        throw new OAuth2TokenError("invalid_request", {
          errorDescription: "unknown error",
        });
      }

      const errorDescription = Object.values(constraints)[0]!;

      throw new OAuth2TokenError("invalid_request", {
        errorDescription,
      });
    }

    const {
      presentation_submission: presentationSubmissionString,
      scope,
      vp_token: vpToken,
    } = parsedDto;

    const unsafePresentationSubmission = JSON.parse(
      presentationSubmissionString,
    );

    const parsedPresentationSubmission = presentationSubmissionSchema.safeParse(
      unsafePresentationSubmission,
    );

    if (!parsedPresentationSubmission.success) {
      const errorDescription = `Invalid Presentation Submission:\n${parsedPresentationSubmission.error.issues
        .map(
          (issue) =>
            `- Validation error. Path: '${[
              "presentation_submission",
              ...issue.path,
            ]
              .filter(Boolean)
              .join(".")}'. Reason: ${issue.message}`,
        )
        .join("\n")}`;

      throw new OAuth2TokenError("invalid_request", {
        errorDescription,
      });
    }

    const presentationSubmission =
      parsedPresentationSubmission.data as PresentationSubmission;

    // Replace "jwt_vp_json" with "jwt_vp" as Sphereon SSI types library incorrectly handles "jwt_vp_json"
    presentationSubmission.descriptor_map =
      presentationSubmission.descriptor_map.map((desc) => ({
        ...desc,
        format: desc.format === "jwt_vp_json" ? "jwt_vp" : desc.format,
      }));

    let vpTokenDecoded: ReturnType<typeof decodeJWT>;
    try {
      vpTokenDecoded = decodeJWT(vpToken);
    } catch (error) {
      let message = "unknown error";

      if (error instanceof Error) {
        message = error.message;
      }

      throw new OAuth2TokenError("invalid_request", {
        errorDescription: `Invalid Verifiable Presentation: ${message}`,
      });
    }

    const vpTokenPayload = vpTokenDecoded.payload;

    await this.preventReplayAttack(vpTokenPayload);

    // Get Presentation Definition corresponding to the requested scope
    const customScope = scope.split(" ")[1] as (typeof CUSTOM_SCOPES)[number];
    const presentationDefinition = this.getPresentationDefinitions(customScope);

    // Verify presentation_submission object
    this.validatePresentationSubmissionObject(
      presentationSubmission,
      presentationDefinition,
    );

    // Now, we can assert that vpTokenPayload is a VpJwtPayload
    const { vp } = vpTokenPayload as VpJwtPayload;

    // Verify presentation exchange
    this.validatePresentationExchange(
      vpToken,
      presentationDefinition,
      presentationSubmission,
    );

    // Verify VP JWT
    const presentation = await this.validateVpJwt(
      vpToken,
      // skip DID resolution:
      customScope === DIDR_INVITE_SCOPE,
      reqId,
      // proofPurpose to be used:
      customScope === TNT_AUTHORISE_SCOPE ? "capabilityInvocation" : undefined,
    );

    // Verify algorithms
    this.validateCredentialsAlgos(
      vpTokenDecoded.header,
      presentation,
      presentationSubmission,
      presentationDefinition,
    );

    // Add extra claims if needed
    const extraClaims: Record<string, unknown> = {};

    // Additional verifications based on the requested scope

    // `didr_invite`: the client must present a VP containing a valid VerifiableAuthorisationToOnboard VC.
    // This is already done by the PEX library, based on the presentation definition.
    // Verify that the DID is not registered yet.
    if (
      customScope === DIDR_INVITE_SCOPE &&
      (await this.isDidRegistered(vp.holder, reqId))
    ) {
      throw new OAuth2TokenError("invalid_request", {
        errorDescription: `Invalid Verifiable Presentation: DID ${vp.holder} is already registered in the DID Registry`,
      });
    }

    // `didr_write`: the client needs to have entry in DIDR / can prove her signature.
    // This is already done in validateVpJwt.

    // `ledger_invoke`: the credential subject must contain the contract address and the VC issuer must be the smart contract deployer
    if (customScope === LEDGER_INVOKE_SCOPE) {
      const addresses = await this.validateTrustedContractDeployer(
        presentation,
        reqId,
      );
      extraClaims["authorization_details"] = { addresses };
    }

    // `tir_invite`: the client must present a VP containing a valid VerifiableAuthorisationForTrustChain, VerifiableAccreditationToAttest, or VerifiableAccreditationToAccredit.
    // This is already done by the PEX library, based on the presentation definition.
    if (customScope === TIR_INVITE_SCOPE) {
      await this.validateTrustedIssuer(vp.holder, true, reqId);
    }

    // `tir_write`: the client needs to be registered as a Trusted Issuer with accreditations.
    if (customScope === TIR_WRITE_SCOPE) {
      await this.validateTrustedIssuer(vp.holder, false, reqId);
    }

    // `timestamp_write`: the client needs to have entry in DIDR / can prove her signature.
    // This is already done in validateVpJwt.

    // `tnt_authorise`: the client must be have the TNT:authoriseDid attribute in Trusted Policies Registry.
    if (customScope === TNT_AUTHORISE_SCOPE) {
      await this.validateTntAdmin(vp.holder, reqId);
    }

    // `tnt_create`: the client must be an allowlisted TnT Document creator
    if (customScope === TNT_CREATE_SCOPE) {
      await this.validateTntCreator(vp.holder, reqId);
    }

    // `tnt_write`: the client must have granted access for write
    if (customScope === TNT_WRITE_SCOPE) {
      await this.validateTntWriter(vp.holder, reqId);
    }

    // Generate access token
    const expiresIn = 7200;
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + expiresIn;
    const jwk = await this.getPublicKeyJwk();
    const { kid } = jwk;
    const accessToken = createJWT(
      {
        aud: this.issuer, // aud: Must be equal to 'iss'
        exp,
        iat,
        iss: this.issuer, // iss: HTTPS URL of the Authorisation Server instance. Must equal to hosted domain + suffix.
        jti: randomUUID(), // jti: A unique random identifier
        scp: scope, // scp: string of space separated scopes that we granted
        sub: vpTokenPayload.sub!, // sub: Legal entity DID
        ...extraClaims,
      },
      {
        signer: ES256Signer(this.apiES256PrivateKey),
      },
      {
        alg: "ES256",
        kid,
        typ: "JWT",
      },
    );

    /**
     * @see https://openid.net/specs/openid-connect-core-1_0.html#IDToken
     */
    const idToken = createJWT(
      {
        /**
         * `aud`
         *
         * REQUIRED. Audience(s) that this ID Token is intended for.
         * It MUST contain the OAuth 2.0 client_id of the Relying Party as an audience value.
         * It MAY also contain identifiers for other audiences.
         * In the general case, the aud value is an array of case sensitive strings.
         * In the common special case when there is one audience, the aud value MAY be a single case sensitive string.
         */
        aud: vpTokenPayload.iss!,

        /**
         * `exp`
         *
         * REQUIRED. Expiration time on or after which the ID Token MUST NOT be accepted for processing.
         * The processing of this parameter requires that the current date/time MUST be before the expiration date/time listed in the value.
         * Implementers MAY provide for some small leeway, usually no more than a few minutes, to account for clock skew.
         * Its value is a JSON number representing the number of seconds from 1970-01-01T0:0:0Z as measured in UTC until the date/time.
         */
        exp,

        /**
         * `iat`
         *
         * REQUIRED. Time at which the JWT was issued.
         * Its value is a JSON number representing the number of seconds from 1970-01-01T0:0:0Z as measured in UTC until the date/time.
         */
        iat,

        /**
         * `iss`
         *
         * REQUIRED. Issuer Identifier for the Issuer of the response.
         * The iss value is a case sensitive URL using the https scheme that contains scheme, host, and optionally, port number and path components and no query or fragment components.
         */
        iss: this.issuer, // iss: HTTPS URL of the Authorisation Server instance. Must equal to hosted domain + suffix.

        /**
         * `jti`
         *
         * @see https://www.rfc-editor.org/rfc/rfc7519.html#section-4.1.7
         *
         * The "jti" (JWT ID) claim provides a unique identifier for the JWT.
         * The identifier value MUST be assigned in a manner that ensures that there is a negligible probability that the same value will be accidentally assigned to a different data object; if the application uses multiple issuers, collisions MUST be prevented among value produced by different issuers as well.
         * The "jti" claim can be used to prevent the JWT from being replayed.
         * The "jti" value is a case-sensitive string.
         */
        jti: randomUUID(), // jti: A unique random identifier

        /**
         * `nonce`
         *
         * String value used to associate a Client session with an ID Token, and to mitigate replay attacks.
         * The value is passed through unmodified from the Authentication Request to the ID Token.
         * If present in the ID Token, Clients MUST verify that the nonce Claim Value is equal to the value of the nonce parameter sent in the Authentication Request. If present in the Authentication Request, Authorization Servers MUST include a nonce Claim in the ID Token with the Claim Value being the nonce value sent in the Authentication Request.
         * Authorization Servers SHOULD perform no other processing on nonce values used. The nonce value is a case sensitive string.
         */
        ...(typeof vpTokenPayload["nonce"] === "string" && {
          nonce: vpTokenPayload["nonce"],
        }),

        /**
         * `sub`
         *
         * REQUIRED. Subject Identifier.
         * A locally unique and never reassigned identifier within the Issuer for the End-User, which is intended to be consumed by the Client, e.g., 24400320 or AItOawmwtWwcT0k51BayewNvutrJUqsvl6qs7A4.
         * It MUST NOT exceed 255 ASCII characters in length.
         * The sub value is a case sensitive string.
         */
        sub: vpTokenPayload.iss!,
      },
      {
        signer: ES256Signer(this.apiES256PrivateKey),
      },
      {
        alg: "ES256",
        kid,
        typ: "JWT",
      },
    );

    return {
      access_token: accessToken,
      expires_in: expiresIn,
      id_token: idToken,
      scope,
      token_type: "Bearer",
    };
  }

  async getControllerAddresses(
    did: string,
    reqId: string,
  ): Promise<{
    addresses: string[];
    didDocument: DIDDocument;
  }> {
    let didDocument: DIDDocument;
    try {
      const response = await axios.get<DIDDocument>(
        `${this.didRegistry}/${did}`,
        {
          headers: {
            accept: "application/did+ld+json",
            "x-request-id": reqId,
          },
        },
      );
      didDocument = response.data;
    } catch (error) {
      /* v8 ignore start */
      if (!isAxiosError(error)) {
        this.logger.error(error);
        throw new OAuth2TokenError("server_error", {
          errorDescription: "Unexpected error when querying DID Registry API",
        });
      }
      /* v8 ignore stop */

      logAxiosError(error, this.logger, 500);

      if (error.response?.status === 404) {
        throw new OAuth2TokenError("invalid_request", {
          errorDescription: `Invalid Verifiable Presentation: DID document ${did} cannot be resolved`,
        });
      }

      if (error.response?.status === 500) {
        throw new OAuth2TokenError("server_error", {
          errorDescription: "DID Registry API responded with an internal error",
        });
      }

      /* v8 ignore start */
      // Fallback (should not be triggered)
      throw new OAuth2TokenError("server_error", {
        errorDescription: "Unexpected error when querying DID Registry API",
      });
      /* v8 ignore stop */
    }

    if (!didDocument.capabilityInvocation) {
      throw new OAuth2TokenError("invalid_request", {
        errorDescription: `Invalid Verifiable Presentation: DID document ${did} doesn't have capabilityInvocation`,
      });
    }

    if (!didDocument.verificationMethod) {
      throw new OAuth2TokenError("invalid_request", {
        errorDescription: `Invalid Verifiable Presentation: DID document ${did} doesn't have verificationMethod`,
      });
    }

    const addresses = didDocument.verificationMethod
      .filter((vMethod) => {
        return (
          didDocument.capabilityInvocation!.includes(vMethod.id) &&
          vMethod.publicKeyJwk?.crv === "secp256k1"
        );
      })
      .map((vMethod) => {
        const publicKeyHex = encode.publicKey.fromJWKToHex(
          vMethod.publicKeyJwk!,
        );
        return ethers.computeAddress(`0x${publicKeyHex}`);
      });

    for (const rel of didDocument.capabilityInvocation) {
      if (typeof rel !== "string" && rel.publicKeyJwk?.crv === "secp256k1") {
        const publicKeyHex = encode.publicKey.fromJWKToHex(rel.publicKeyJwk);
        addresses.push(ethers.computeAddress(`0x${publicKeyHex}`));
      }
    }

    return { addresses, didDocument };
  }

  /**
   * Expose OP's public keys.
   *
   * @returns The OP's JWKS
   */
  async getJwks(): Promise<JsonWebKeySet> {
    const jwk = await this.getPublicKeyJwk();

    // Return JWKS
    return {
      keys: [jwk],
    };
  }

  getOPMetadata(): OPMetadata {
    return {
      authorization_endpoint: `${this.issuer}/authorize`,
      grant_types_supported: ["vp_token"],
      id_token_signing_alg_values_supported: ["none"],
      id_token_types_supported: ["subject_signed_id_token"],
      issuer: this.issuer,
      jwks_uri: `${this.issuer}/jwks`,
      presentation_definition_endpoint: `${this.issuer}/presentation-definitions`,
      response_types_supported: ["token"],
      scopes_supported: SUPPORTED_SCOPES,
      subject_syntax_types_supported: ["did:ebsi", "did:key"],
      subject_trust_frameworks_supported: ["ebsi"],
      subject_types_supported: ["public"],
      token_endpoint: `${this.issuer}/token`,
      token_endpoint_auth_methods_supported: ["private_key_jwt"],
      vp_formats_supported: {
        jwt_vc: { alg_values_supported: ["ES256"] },
        jwt_vc_json: { alg_values_supported: ["ES256"] },
        jwt_vp: { alg_values_supported: ["ES256"] },
        jwt_vp_json: { alg_values_supported: ["ES256"] },
      },
    };
  }

  /**
   * Return a Presentation Definition articulating what proofs the OP requires.
   *
   * Specs:
   * - https://identity.foundation/presentation-exchange/spec/v2.0.0/#presentation-definition
   * - https://ec.europa.eu/digital-building-blocks/wikis/pages/viewpage.action?spaceKey=BLOCKCHAININT&title=RFC+-+EBSI+Platform+Identity+and+Access+Management#RFCEBSIPlatformIdentityandAccessManagement-ServicetoService-TokenFlow
   *
   * @param scope Array of supported scopes ("openid", "didr_invite", "didr_write", "tir_invite", "tir_write", "timestamp_write", "tnt_authorise", "tnt_create", "tnt_write")
   * @returns A Presentation Definition.
   */
  getPresentationDefinitions(scope: (typeof CUSTOM_SCOPES)[number]) {
    if (!(scope in PRESENTATION_DEFINITIONS)) {
      throw new OAuth2TokenError("invalid_request", {
        errorDescription: `Unhandled scope "${scope as string}"`,
      });
    }

    return PRESENTATION_DEFINITIONS[scope];
  }

  /**
   * Checks if the given DID is registered in the DIDR.
   *
   * @param did - The issuer DID to verify.
   * @param reqId - The current request ID.
   * @returns True if the DID is registered, false otherwise.
   */
  async isDidRegistered(did: string, reqId: string): Promise<boolean> {
    try {
      await axios.get(`${this.didRegistry}/${did}`, {
        headers: {
          accept: "application/did+ld+json",
          "x-request-id": reqId,
        },
      });
    } catch (error) {
      if (isAxiosError(error)) {
        logAxiosError(error, this.logger, 500);
      } else {
        /* v8 ignore next 1 */
        this.logger.error(error);
      }

      return false;
    }

    return true;
  }

  async preventReplayAttack(payload: JWTPayload) {
    if (!payload.exp) {
      throw new OAuth2TokenError("invalid_request", {
        errorDescription: "The vp_token must contain an expiration time.",
      });
    }

    const now = Math.floor(Date.now() / 1000);

    if (payload.exp < now) {
      throw new OAuth2TokenError("invalid_request", {
        errorDescription: "The vp_token has expired.",
      });
    }

    if (payload.exp > now + 300) {
      throw new OAuth2TokenError("invalid_request", {
        errorDescription:
          "The vp_token must not have an expiration time of more than 5 minutes in the future.",
      });
    }

    if (!payload["nonce"]) {
      throw new OAuth2TokenError("invalid_request", {
        errorDescription:
          "The vp_token must contain a nonce in order to prevent replay attacks.",
      });
    }

    const cacheKey = payload["nonce"] as string;
    const nonceUsed = await this.cacheManager.get(cacheKey);
    if (nonceUsed) {
      throw new OAuth2TokenError("invalid_request", {
        errorDescription:
          "The vp_token contains a nonce which has already been used.",
      });
    }
    await this.cacheManager.set(cacheKey, cacheKey, 300_000); // 5 minutes (5 * 60 * 1000)
  }

  /**
   * Validate that the VP and VC(s) "alg" match the requirements of the given presentation definition.
   *
   * @param vpTokenHeader - The header of VP Token to validate.
   * @param presentation - The VP JWT payload.
   * @param presentationDefinition - The presentation definition to validate against.
   */
  validateCredentialsAlgos(
    vpTokenHeader: JWTHeader,
    presentation: Schemas["Presentation"],
    presentationSubmission: PresentationSubmission,
    presentationDefinition: PresentationDefinitionV2,
  ) {
    // Presentation without credentials
    if (presentationSubmission.descriptor_map.length === 0) {
      // Only check VP JWT alg
      if (!presentationDefinition.format) return; // Invalid presentation definition

      const supportedVpAlgos = [
        ...(presentationDefinition.format.jwt_vp?.alg ?? []),
        ...(presentationDefinition.format.jwt_vp_json?.alg ?? []),
      ];

      if (!supportedVpAlgos.includes(vpTokenHeader.alg)) {
        throw new OAuth2TokenError("invalid_request", {
          errorDescription: `Invalid Verifiable Presentation: the algorithm '${vpTokenHeader.alg}' is not supported`,
        });
      }

      return;
    }

    // Presentation with credentials
    for (const [
      index,
      descriptor,
    ] of presentationSubmission.descriptor_map.entries()) {
      if (!presentationDefinition.format) continue; // Invalid presentation definition

      const { format: vpFormat } = descriptor;

      if (
        !Object.keys(presentationDefinition.format).includes(vpFormat) ||
        (vpFormat !== "jwt_vp" && vpFormat !== "jwt_vp_json")
      ) {
        throw new OAuth2TokenError("invalid_request", {
          errorDescription: `Invalid Verifiable Presentation submission: format '${vpFormat}' is not supported in 'descriptor_map[${index}].format'`,
        });
      }

      const supportedVpAlgos =
        presentationDefinition.format[vpFormat]?.alg ?? [];

      if (!supportedVpAlgos.includes(vpTokenHeader.alg)) {
        throw new OAuth2TokenError("invalid_request", {
          errorDescription: `Invalid Verifiable Presentation: the algorithm '${vpTokenHeader.alg}' is not supported`,
        });
      }

      const matchingInputDescriptor =
        presentationDefinition.input_descriptors.find(
          (inputDescriptor) => inputDescriptor.id === descriptor.id,
        );

      if (!matchingInputDescriptor) {
        throw new OAuth2TokenError("invalid_request", {
          errorDescription: `The presentation definition doesn't contain any input descriptor with the ID ${descriptor.id}`,
        });
      }

      // Check if the VC format is supported
      if (!descriptor.path_nested) continue;

      const { format: vcFormat } = descriptor.path_nested;

      if (!matchingInputDescriptor.format) continue; // Invalid presentation definition

      if (
        !Object.keys(matchingInputDescriptor.format).includes(vcFormat) ||
        (vcFormat !== "jwt_vc" && vcFormat !== "jwt_vc_json")
      ) {
        throw new OAuth2TokenError("invalid_request", {
          errorDescription: `Invalid Verifiable Presentation submission: format '${vcFormat}' is not supported in 'descriptor_map[${index}].path_nested.format'`,
        });
      }

      // Get corresponding VC
      const matches = /^\$\.vp\.verifiableCredential\[(\d*)\]/m.exec(
        descriptor.path_nested.path,
      );

      if (!matches) {
        throw new OAuth2TokenError("invalid_request", {
          errorDescription: `Invalid Verifiable Presentation submission: path_nested.path '${descriptor.path_nested.path}' is not valid`,
        });
      }

      const vcIndex = Number.parseInt(matches[1]!, 10);

      const vcJwt = presentation.verifiableCredential[vcIndex];

      if (!vcJwt || typeof vcJwt !== "string") {
        throw new OAuth2TokenError("invalid_request", {
          errorDescription: `Invalid Verifiable Presentation submission: $.vp.verifiableCredential[${vcIndex}] not found`,
        });
      }

      if (!matchingInputDescriptor.format) continue;

      const supportedVcAlgos =
        matchingInputDescriptor.format[vcFormat]?.alg ?? [];

      let header: JWTHeader;
      try {
        header = decodeJWT(vcJwt).header;
      } catch {
        throw new OAuth2TokenError("invalid_request", {
          errorDescription: `Invalid Verifiable Presentation submission: credential ${vcIndex} is not a valid JWT: ${vcJwt}`,
        });
      }

      if (!supportedVcAlgos.includes(header.alg)) {
        throw new OAuth2TokenError("invalid_request", {
          errorDescription: `Invalid Verifiable Credential: the algorithm '${header.alg}' is not supported`,
        });
      }
    }
  }

  /**
   * Validates that the Presentation Exchange is correct, i.e. the submitted VP and its associated
   * presentation_submission match the requirements of the given presentation_definition.
   *
   * @param vp - The Verifiable Presentation extracted from the VP Token.
   * @param presentationDefinition - The Presentation Definition that articulates the proof requirements.
   * @param presentationSubmission - The Presentation Submission that describes the proofs submitted.
   */
  validatePresentationExchange(
    vpJwt: string,
    presentationDefinition: PresentationDefinitionV2,
    presentationSubmission: PresentationSubmission,
  ) {
    // Only evaluate the presentation if the presentation definition requires some VCs
    // Otherwise, https://github.com/Sphereon-Opensource/SSI-SDK/blob/8d0ea61f25e33ef614e9579e727ba319cce5bcc0/packages/ssi-types/src/mapper/credential-mapper.ts#L184 will throw an error
    if (presentationDefinition.input_descriptors.length === 0) {
      return;
    }

    const pex = new PEXv2();
    let errors: Checked[] = [];

    try {
      const res = pex.evaluatePresentation(presentationDefinition, vpJwt, {
        // Pass presentation submission as an option (although it's not declared in PEXv2.ts)
        // https://github.com/Sphereon-Opensource/PEX/blob/develop/lib/PEXv2.ts#L34
        // https://github.com/Sphereon-Opensource/PEX/blob/develop/lib/PEX.ts#L79C7-L79C29
        // @ts-expect-error This property is not declared, but it exists
        presentationSubmission,
      });

      if (res.errors) {
        errors = res.errors;
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new OAuth2TokenError("invalid_request", {
          errorDescription: `Invalid Presentation Submission: ${error.message}`,
        });
      }

      // Unhandled error
      /* v8 ignore next 1 */
      throw error;
    }

    if (errors.length > 0) {
      throw new OAuth2TokenError("invalid_request", {
        errorDescription: `Invalid Presentation Submission:\n${errors
          .map(
            (error) => `${error.tag} tag: ${error.message ?? "Unknown error"};`,
          )
          .join(",")}`,
      });
    }
  }

  /**
   * Ensures that the given presentation_submission object is a valid Presentation Submission object.
   *
   * @param presentationSubmission - The Presentation Submission object to validate.
   * @param definitionId - The Presentation Definition ID that the presentation_submission.definition_id must match.
   */
  validatePresentationSubmissionObject(
    presentationSubmission: PresentationSubmission,
    presentationDefinition: PresentationDefinitionV2,
  ) {
    const validationResult = PEXv2.validateSubmission(presentationSubmission);

    const checkedArray = Array.isArray(validationResult)
      ? validationResult
      : [validationResult];

    const errors = checkedArray
      .map((checked) => {
        if (checked.message === "descriptor_map should be a non-empty list") {
          // Accept presentation submissions with empty descriptor map (e.g. for didr_write and tir_write)
          return false;
        }

        if (checked.status === "error") {
          return checked;
        }

        return false;
      })
      .filter(Boolean);

    if (errors.length > 0) {
      throw new OAuth2TokenError("invalid_request", {
        errorDescription: `Invalid Presentation Submission:\n${errors
          .map((err) => `- [${err.tag}] ${err.message ?? "Unknown error"}`)
          .join("\n")}`,
      });
    }

    /**
     * The presentation_submission object MUST contain a definition_id property.
     * The value of this property MUST be the id value of a valid Presentation Definition.
     *
     * @see https://identity.foundation/presentation-exchange/#presentation-submission
     */
    if (presentationSubmission.definition_id !== presentationDefinition.id) {
      throw new OAuth2TokenError("invalid_request", {
        errorDescription:
          "Invalid Presentation Submission: definition_id doesn't match the expected Presentation Definition ID for the requested scope",
      });
    }

    /**
     * Make sure every descriptor_map[x].id of the Presentation Submission
     * matches an existing input_descriptors[x].id of the Presentation Definition
     */
    for (const descriptor of presentationSubmission.descriptor_map || []) {
      const matchingDescriptor = presentationDefinition.input_descriptors.find(
        (inputDescriptor) => inputDescriptor.id === descriptor.id,
      );

      if (!matchingDescriptor) {
        throw new OAuth2TokenError("invalid_request", {
          errorDescription: `The presentation definition doesn't contain any input descriptor with the ID ${descriptor.id}`,
        });
      }
    }

    /**
     * Make sure every input_descriptors[x] of the Presentation Definition is
     * satisfied, i.e. there's at least 1 descriptor_map[x] with the same id.
     */
    for (const inputDescriptor of presentationDefinition.input_descriptors) {
      const matchingDescriptor = (
        presentationSubmission.descriptor_map || []
      ).find((descriptor) => descriptor.id === inputDescriptor.id);

      if (!matchingDescriptor) {
        throw new OAuth2TokenError("invalid_request", {
          errorDescription: `Input descriptor ${inputDescriptor.id} is missing`,
        });
      }
    }
  }

  async validateTntAdmin(did: string, reqId: string): Promise<void> {
    const { addresses, didDocument } = await this.getControllerAddresses(
      did,
      reqId,
    );
    if (didDocument.controller && Array.isArray(didDocument.controller)) {
      await Promise.all(
        didDocument.controller
          .filter((controller) => controller !== did)
          .map(async (controller) => {
            const { addresses: controllerAddresses } =
              await this.getControllerAddresses(controller, reqId);
            addresses.push(...controllerAddresses);
          }),
      );
    }

    const resultAddresses = await Promise.all(
      addresses.map(
        async (
          address: string,
        ): Promise<{
          error?: string;
          valid: boolean;
        }> => {
          try {
            const response = await axios.get<{
              attributes: string[];
              user: string;
            }>(`${this.trustedPoliciesRegistry}/${address}`, {
              headers: {
                "x-request-id": reqId,
              },
            });
            if (!response.data.attributes.includes("TNT:authoriseDid")) {
              return {
                error: `address ${address} doesn't have the attribute TNT:authoriseDid in Trusted Policies Registry`,
                valid: false,
              };
            }
            return {
              valid: true,
            };
          } catch (error) {
            /* v8 ignore start */
            if (!isAxiosError(error)) {
              this.logger.error(error);

              throw new OAuth2TokenError("server_error", {
                errorDescription:
                  "Unexpected error when querying Trusted Policies Registry API",
              });
            }
            /* v8 ignore stop */

            logAxiosError(error, this.logger, 500);

            if (error.response?.status === 404) {
              return {
                error: `address ${address} not in Trusted Policies Registry`,
                valid: false,
              };
            }

            if (error.response?.status === 500) {
              throw new OAuth2TokenError("server_error", {
                errorDescription:
                  "Trusted Policies Registry API responded with an internal error",
              });
            }

            return {
              error: `Error from Trusted Policies Registry: ${error.message}`,
              valid: false,
            };
          }
        },
      ),
    );

    if (resultAddresses.every((result) => !result.valid)) {
      throw new OAuth2TokenError("invalid_request", {
        errorDescription: `Invalid Verifiable Presentation: DID ${did} is not authorised for ${TNT_AUTHORISE_SCOPE} access. Errors: ${resultAddresses.map((result) => result.error!).join(", ")}`,
      });
    }
  }

  async validateTntCreator(did: string, reqId: string): Promise<void> {
    try {
      try {
        await axios.head<unknown>(
          `${this.trackAndTraceAccessesEndpoint}?${new URLSearchParams({
            creator: did,
          }).toString()}`,
          {
            headers: {
              "x-request-id": reqId,
            },
          },
        );
      } catch (error) {
        // Check ESTAT API (Test + Pilot only)
        if (!this.estatAccessesEndpoint) throw error;

        await axios.head<unknown>(
          `${this.estatAccessesEndpoint}?${new URLSearchParams({
            creator: did,
          }).toString()}`,
          {
            headers: {
              "x-request-id": reqId,
            },
          },
        );
      }
    } catch (error) {
      /* v8 ignore start */
      if (!isAxiosError(error)) {
        this.logger.error(error);

        throw new OAuth2TokenError("server_error", {
          errorDescription:
            "Unexpected error when querying Track And Trace API",
        });
      }
      /* v8 ignore stop */

      logAxiosError(error, this.logger, 500);

      if (error.response?.status === 404) {
        throw new OAuth2TokenError("invalid_request", {
          errorDescription: `Invalid Verifiable Presentation: DID ${did} is not allowlisted as a TnT Document creator`,
        });
      }

      if (error.response?.status === 500) {
        throw new OAuth2TokenError("server_error", {
          errorDescription:
            "Track And Trace API responded with an internal error",
        });
      }

      /* v8 ignore start */
      // Fallback (should not be triggered)
      throw new OAuth2TokenError("server_error", {
        errorDescription: "Unexpected error when querying Track And Trace API",
      });
      /* v8 ignore stop */
    }
  }

  async validateTntWriter(did: string, reqId: string): Promise<void> {
    let accesses: Access[];
    try {
      try {
        const { data } = await axios.get<PaginatedList<Access>>(
          `${this.trackAndTraceAccessesEndpoint}?${new URLSearchParams({
            subject: did,
          }).toString()}`,
          {
            headers: {
              "x-request-id": reqId,
            },
          },
        );
        accesses = data.items;

        if (
          (!accesses || accesses.length === 0) &&
          this.estatAccessesEndpoint
        ) {
          throw new Error(
            "Accesses not found in Track And Trace API, trying with ESTAT API",
          );
        }
      } catch (error) {
        // Check ESTAT API (Test + Pilot only)
        if (!this.estatAccessesEndpoint) throw error;

        const { data } = await axios.get<PaginatedList<Access>>(
          `${this.estatAccessesEndpoint}?${new URLSearchParams({
            subject: did,
          }).toString()}`,
          {
            headers: {
              "x-request-id": reqId,
            },
          },
        );
        accesses = data.items;
      }
    } catch (error) {
      /* v8 ignore start */
      if (!isAxiosError(error)) {
        this.logger.error(error);

        throw new OAuth2TokenError("server_error", {
          errorDescription:
            "Unexpected error when querying Track And Trace API",
        });
      }
      /* v8 ignore stop */

      logAxiosError(error, this.logger, 500);

      if (error.response?.status === 500) {
        throw new OAuth2TokenError("server_error", {
          errorDescription:
            "Track And Trace API responded with an internal error",
        });
      }

      /* v8 ignore start */
      // Fallback (should not be triggered)
      throw new OAuth2TokenError("server_error", {
        errorDescription: "Unexpected error when querying Track And Trace API",
      });
      /* v8 ignore stop */
    }

    if (!accesses || accesses.length === 0) {
      throw new OAuth2TokenError("invalid_request", {
        errorDescription: `Invalid Verifiable Presentation: DID ${did} doesn't have write or delegate permission in TnT`,
      });
    }
  }

  /**
   * Validates that the credential subject contains the contract address and the VC issuer is the smart contract deployer
   * @param presentation Schemas["Presentation"]
   * @param reqId
   */
  async validateTrustedContractDeployer(
    presentation: Schemas["Presentation"],
    reqId: string,
  ): Promise<string[]> {
    const vcJwt = presentation.verifiableCredential[0];

    if (!vcJwt) {
      throw new OAuth2TokenError("invalid_request", {
        errorDescription: "Invalid Verifiable Presentation: No VC found",
      });
    }

    if (typeof vcJwt !== "string") {
      throw new OAuth2TokenError("invalid_request", {
        errorDescription: "Invalid Verifiable Presentation: VC is not a string",
      });
    }

    const vc = decodeJwt(vcJwt)["vc"] as Schemas["Attestation"];

    const { issuer } = vc;

    const credentialSubjects = Array.isArray(vc.credentialSubject)
      ? vc.credentialSubject
      : [vc.credentialSubject];

    const addresses: string[] = [];
    for (const credentialSubject of credentialSubjects) {
      const address = credentialSubject["contractAddress"];
      if (!address) {
        throw new OAuth2TokenError("invalid_request", {
          errorDescription:
            "Invalid Verifiable Presentation: VC credential subject is missing contractAddress",
        });
      }

      if (typeof address !== "string") {
        throw new OAuth2TokenError("invalid_request", {
          errorDescription:
            "Invalid Verifiable Presentation: VC credential subject contractAddress is not a string",
        });
      }

      let deployerDid: string;
      let isActive: boolean;
      try {
        const { data } = await axios.get<TrustedContract>(
          `${this.trustedContractsRegistry}/${address}`,
          { headers: { "x-request-id": reqId } },
        );

        deployerDid = data.deployerDID;
        isActive = data.isActive;
      } catch (error) {
        /* v8 ignore start */
        if (!isAxiosError(error)) {
          this.logger.error(error);

          throw new OAuth2TokenError("server_error", {
            errorDescription:
              "Unexpected error when querying Trusted Contracts Registry API",
          });
        }
        /* v8 ignore stop */

        logAxiosError(error, this.logger, 500);

        if (error.response?.status === 404) {
          throw new OAuth2TokenError("invalid_request", {
            errorDescription: `Invalid Verifiable Credential: contract ${address} does not exist`,
          });
        }

        throw new OAuth2TokenError("invalid_request", {
          errorDescription: `Invalid Verifiable Credential: contract ${address} is not a valid contract`,
        });
      }

      if (deployerDid !== issuer) {
        throw new OAuth2TokenError("invalid_request", {
          errorDescription:
            "Invalid Verifiable Presentation: VC issuer is not the smart contract deployer",
        });
      }

      if (!isActive) {
        throw new OAuth2TokenError("invalid_request", {
          errorDescription: `Invalid Verifiable Credential: contract ${address} is not active`,
        });
      }

      addresses.push(address);
    }

    return addresses;
  }

  async validateTrustedIssuer(
    did: string,
    requireNewUser: boolean,
    reqId: string,
  ): Promise<void> {
    // Check if the issuer has accreditations
    let issuerRequest: AxiosResponse<unknown>;

    // Request TI attributes
    try {
      issuerRequest = await axios.get<unknown>(
        `${this.trustedIssuersRegistry}/${did}`,
        {
          headers: {
            "x-request-id": reqId,
          },
        },
      );
    } catch (error) {
      /* v8 ignore start */
      if (!isAxiosError(error)) {
        this.logger.error(error);

        throw new OAuth2TokenError("server_error", {
          errorDescription:
            "Unexpected error when querying Trusted Issuers Registry API",
        });
      }
      /* v8 ignore stop */

      logAxiosError(error, this.logger, 500);

      if (error.response?.status === 404) {
        throw new OAuth2TokenError("invalid_request", {
          errorDescription: `Invalid Verifiable Presentation: DID ${did} is not registered in the Trusted Issuers Registry`,
        });
      }

      if (error.response?.status === 500) {
        throw new OAuth2TokenError("server_error", {
          errorDescription:
            "Trusted Issuers Registry responded with an internal error",
        });
      }

      /* v8 ignore start */
      // Fallback (should not be triggered)
      throw new OAuth2TokenError("server_error", {
        errorDescription:
          "Unexpected error when querying Trusted Issuers Registry API",
      });
      /* v8 ignore stop */
    }

    // Parse response
    const parsedIssuer = issuerSchema.safeParse(issuerRequest.data);
    if (!parsedIssuer.success) {
      throw new OAuth2TokenError("server_error", {
        errorDescription: "Trusted Issuers Registry sent an invalid response",
      });
    }

    // new users (tir_invite scope) should not have accreditations
    const hasAccreditations = parsedIssuer.data.hasAttributes;
    if (requireNewUser && hasAccreditations) {
      throw new OAuth2TokenError("invalid_request", {
        errorDescription: `Invalid Verifiable Presentation: Trusted Issuer ${did} already has accreditations. Request an access token with scope "tir_write"`,
      });
    }

    // existing users (tir_write scope) should have accreditations
    if (!requireNewUser && !hasAccreditations) {
      throw new OAuth2TokenError("invalid_request", {
        errorDescription: `Invalid Verifiable Presentation: Trusted Issuer ${did} doesn't have accreditations. Request an access token with scope "tir_invite"`,
      });
    }
  }

  /**
   * Validate VP Token.
   *
   * @param vpToken - The VP Token to validate.
   * @param isDidUnresolvable - If the holder DID is unresolvable, the signature validation is skipped.
   * @param reqId - The request ID
   */
  async validateVpJwt(
    vpToken: string,
    isDidUnresolvable: boolean,
    reqId: string,
    proofPurpose?: ProofPurposeTypes,
  ) {
    try {
      const audience = this.issuer;
      const now = Math.floor(Date.now() / 1000);

      return await verifyPresentationJwt(
        vpToken,
        audience,
        this.ebsiEnvConfig,
        {
          axiosHeaders: { "x-request-id": reqId },
          skipHolderDidResolutionValidation: isDidUnresolvable,
          skipSignatureValidation: isDidUnresolvable,
          timeout: this.requestTimeout,
          validAt: now, // The JWT VC(s) must be valid now
          verifyCredentialOptions: {
            skipAccreditationWithoutTermsOfUseValidation: false, // The VC must contain terms of use (or be self-accredited)
          },
          ...(proofPurpose && { proofPurpose }),
        },
      );
    } catch (error) {
      this.logger.error(
        error,
        error instanceof Error ? error.stack : undefined,
      );

      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      if (errorMessage.includes("Error: internalServerError")) {
        throw new OAuth2TokenError("server_error", {
          errorDescription: errorMessage,
        });
      }

      throw new OAuth2TokenError("invalid_request", {
        errorDescription: `Invalid Verifiable Presentation: ${errorMessage}`,
      });
    }
  }

  /**
   * Load OP's ES256 signing key from environment and return it as JWK.
   * Note: in the future, the keys will be dynamically generated and rolled every X minutes.
   *
   * @returns The public key JWK (including "kid")
   */
  private async getPublicKeyJwk() {
    this.publicKeyJwk ??= await getPublicKeyJwk(
      this.apiES256PrivateKey,
      "ES256",
    );

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    return this.publicKeyJwk!;
  }
}
