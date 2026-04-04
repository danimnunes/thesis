import type {
  EbsiEnvConfiguration,
  EbsiIssuer,
} from "@europeum-ebsi/verifiable-credential";

import { getPublicKeyJwk, getSigner } from "@ebsiint-api/shared";
import { createJWT, hexToBytes } from "@europeum-ebsi/did-jwt";
import { createVerifiablePresentationJwt } from "@europeum-ebsi/verifiable-presentation/vcdm11.js";
import axios from "axios";
import { randomUUID } from "node:crypto";
import { URLSearchParams } from "node:url";

/**
 * Sign a "didr_invite" access token as the Authorisation API.
 * Useful for bypassing the whole onboarding process (which relies on Conformance API v3).
 */
export async function getDidrInviteAccessToken(
  did: string,
  authApiV3ES256PrivateKey: string,
) {
  const authApiPrivateKey = hexToBytes(authApiV3ES256PrivateKey);
  const { kid: authApiKid } = await getPublicKeyJwk(authApiPrivateKey, "ES256");

  const newUserAccessToken = createJWT(
    {
      iss: authApiKid,
      scp: "openid didr_invite",
      sub: did,
    },
    {
      signer: getSigner(authApiPrivateKey, "ES256"),
    },
    {
      alg: "ES256",
      kid: authApiKid,
      typ: "JWT",
    },
  );

  return newUserAccessToken;
}

/**
 * Get an actual "didr_write" access token from Authorisation API v3.
 */
export async function getDidrWriteAccessToken(
  authorisationApiUrl: string,
  issuer: EbsiIssuer,
  ebsiEnvConfig: EbsiEnvConfiguration,
) {
  const nonce = randomUUID();
  const vpPayload = {
    "@context": ["https://www.w3.org/2018/credentials/v1"],
    holder: issuer.did,
    type: ["VerifiablePresentation"],
    verifiableCredential: [],
  };

  const vpJwt = await createVerifiablePresentationJwt(
    vpPayload,
    issuer,
    authorisationApiUrl,
    ebsiEnvConfig,
    {
      // Manually add "exp" and "nbf" to the VP JWT because there's no VC to extract from
      exp: Math.floor(Date.now() / 1000) + 100,
      nbf: Math.floor(Date.now() / 1000) - 100,
      nonce,
      skipValidation: true,
    },
  );

  const presentationSubmission = {
    definition_id: "didr_write_presentation",
    descriptor_map: [],
    id: randomUUID(),
  };

  const response = await axios.post(
    `${authorisationApiUrl}/token`,
    new URLSearchParams({
      grant_type: "vp_token",
      presentation_submission: JSON.stringify(presentationSubmission),
      scope: "openid didr_write",
      vp_token: vpJwt,
    }).toString(),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    },
  );

  // Decode access token
  const { access_token: accessToken } = response.data as {
    access_token: string;
  };

  return accessToken;
}
