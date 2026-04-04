import type { JsonWebKey } from "node:crypto";

import {
  CUSTOM_SCOPES,
  OPENID_SCOPE,
  SUPPORTED_SCOPES,
} from "./authorisation.constants.ts";

export interface Access {
  /**
   * Document ID
   */
  documentId: string;

  /**
   * The `did:ebsi` or `did:key` DID of the granter of the permission.
   * "creator" shall have itself as "grantedBy".
   */
  grantedBy: string;

  /**
   * Permission granted: "write", "delegate" or "creator".
   */
  permission: "creator" | "delegate" | "write";

  /**
   * A `did:ebsi` or `did:key` DID.
   */
  subject: string;
}

/**
 * JWK Set
 *
 * Specs:
 * - https://www.rfc-editor.org/rfc/rfc7517.html#section-5
 */
export interface JsonWebKeySet {
  keys: JsonWebKey[];
}

/**
 * OpenID Provider (OP) Metadata
 *
 * Specs:
 * - https://openid.net/specs/openid-connect-discovery-1_0.html#ProviderMetadata
 * - https://www.ietf.org/archive/id/draft-ietf-oauth-par-03.html#section-5
 * - https://openid.net/specs/openid-4-verifiable-presentations-1_0-14.html#section-8.1
 * - https://openid.net/specs/openid-connect-self-issued-v2-1_0-12.html#section-9.2.3
 * - https://openid.net/specs/openid-connect-federation-1_0-25.html#section-4.4
 * - https://ec.europa.eu/digital-building-blocks/wikis/display/BLOCKCHAININT/OpenAPI+specification+-+Onboarding+and+accreditations+for+EBSI+Authentication+service
 * - https://ec.europa.eu/digital-building-blocks/wikis/display/BLOCKCHAININT/RFC+-+EBSI+Platform+Identity+and+Access+Management#RFCEBSIPlatformIdentityandAccessManagement-PresentationDefinition
 */
export interface OPMetadata {
  /**
   * URL of the OP's OAuth 2.0 Authorization Endpoint.
   */
  authorization_endpoint: string;

  /**
   * JSON array containing a list of the OAuth 2.0 Grant Type values that this OP supports.
   * Dynamic OpenID Providers MUST support the authorization_code and implicit Grant Type values
   * and MAY support other Grant Types. If omitted, the default value is `["authorization_code", "implicit"]`.
   */
  grant_types_supported: string[];

  /**
   * JSON array containing a list of the JWS signing algorithms (alg values) supported by the OP
   * for the ID Token to encode the Claims in a JWT [JWT]. The algorithm `RS256` MUST be included.
   * The value `none` MAY be supported, but MUST NOT be used unless the Response Type used returns
   * no ID Token from the Authorization Endpoint (such as when using the Authorization Code Flow).
   */
  id_token_signing_alg_values_supported: string[];

  /**
   * A JSON array of strings containing the list of ID Token types supported by the OP, the default
   * value is `attester_signed_id_token`. The ID Token types defined in this specification are:
   * - `subject_signed_id_token`: Self-Issued ID Token, i.e. the id token is signed with key material
   * under the end-user's control.
   * - `attester_signed_id_token`: the id token is issued by the party operating the OP, i.e. this
   * is the classical id token as defined in [OpenID.Core].
   *
   * MUST be subject_signed_id_token
   */
  id_token_types_supported: string[];

  /**
   * URL using the `https` scheme with no query or fragment component that the OP asserts as its
   * Issuer Identifier. If Issuer discovery is supported, this value MUST be identical to the
   * issuer value returned by WebFinger. This also MUST be identical to the `iss` Claim value in ID
   * Tokens issued from this Issuer.
   */
  issuer: string;

  /**
   * URL of the OP's JSON Web Key Set document. This contains the signing key(s) the RP uses to
   * validate signatures from the OP. The JWK Set MAY also contain the Server's encryption key(s),
   * which are used by RPs to encrypt requests to the Server. When both signing and encryption keys
   * are made available, a `use` (Key Use) parameter value is REQUIRED for all keys in the
   * referenced JWK Set to indicate each key's intended usage. Although some algorithms allow the
   * same key to be used for both signatures and encryption, doing so is NOT RECOMMENDED, as it is
   * less secure. The JWK x5c parameter MAY be used to provide X.509 representations of keys
   * provided. When used, the bare key values MUST still be present and MUST match those in the
   * certificate.
   */
  jwks_uri: string;

  /**
   * The URL of the presentation definition endpoint at which the client can get the presentation
   * definition requirements.
   */
  presentation_definition_endpoint: string;

  /**
   * JSON array containing a list of the OAuth 2.0 `response_type` values that this OP supports.
   * Dynamic OpenID Providers MUST support the `code`, `id_token`, and the `token id_token`
   * Response Type values.
   */
  response_types_supported: string[];

  /**
   * JSON array containing a list of the OAuth 2.0 scope values that this server supports. The
   * server MUST support the `openid` scope value. Servers MAY choose not to advertise some
   * supported scope values even when this parameter is used, although those defined in OpenID.Core
   * SHOULD be listed, if supported.
   */
  scopes_supported: typeof SUPPORTED_SCOPES;

  /**
   * A JSON array of strings representing URI scheme identifiers and optionally method
   * names of supported Subject Syntax Types. When Subject Syntax Type is JWK Thumbprint, valid
   * value is `urn:ietf:params:oauth:jwk-thumbprint` defined in RFC9278. When Subject Syntax Type
   * is Decentralized Identifier, valid values MUST be a `did:` prefix followed by a supported DID
   * method without a `:` suffix. For example, support for the DID method with a method-name
   * "example" would be represented by `did:example`. Support for all DID methods is indicated by
   * sending did without any method-name.
   */
  subject_syntax_types_supported: string[];

  /**
   * A JSON array of supported trust frameworks.
   */
  subject_trust_frameworks_supported: string[];

  /**
   * JSON array containing a list of the Subject Identifier types that this OP supports.
   * Valid types include `pairwise` and `public`.
   */
  subject_types_supported: ("pairwise" | "public")[];

  /**
   * URL of the OP's OAuth 2.0 Token Endpoint. This is REQUIRED unless only the Implicit Flow is
   * used.
   */
  token_endpoint: string;

  /**
   * JSON array containing a list of Client Authentication methods supported by this Token Endpoint.
   */
  token_endpoint_auth_methods_supported: string[];

  /**
   * An object containing a list of key value pairs, where the key is a string identifying a
   * credential format supported by the AS.
   */
  vp_formats_supported: Partial<
    Record<
      "jwt_vc" | "jwt_vc_json" | "jwt_vp" | "jwt_vp_json",
      {
        /**
         * An object where the value is an array of case sensitive strings that identify the
         * cryptographic suites that are supported. Cryptosuites for Credentials in jwt_vc format
         * should use algorithm names defined in [IANA JOSE Algorithms Registry](https://www.iana.org/assignments/jose/jose.xhtml#web-signature-encryption-algorithms).
         */
        alg_values_supported: string[];
      }
    >
  >;
}

export type Scope = `${typeof OPENID_SCOPE} ${(typeof CUSTOM_SCOPES)[number]}`;

export interface TokenResponse {
  access_token: string;
  expires_in: number;
  id_token: string;
  scope: string;
  token_type: string;
}

// Response from Trusted Contracts Registry API v1's `/contracts/${address}` endpoint
export interface TrustedContract {
  address: string;
  deployer: string;
  deployerDID: string;
  deploymentTimestamp: number;
  isActive: boolean;
  templateId: string;
}
