import type {
  EbsiEnvConfiguration,
  EbsiIssuer,
} from "@europeum-ebsi/verifiable-credential";

import { createVerifiablePresentationJwt } from "@europeum-ebsi/verifiable-presentation/vcdm11.js";
import axios, { isAxiosError } from "axios";
import { randomUUID } from "node:crypto";
import { URLSearchParams } from "node:url";

/**
 * Get an actual "tpr_write" access token from Authorisation API v4.
 */
export async function getTprWriteAccessToken(
  authorisationApiUrl: string,
  subject: EbsiIssuer,
  ebsiEnvConfig: EbsiEnvConfiguration,
) {
  const nonce = randomUUID();
  const vpPayload = {
    "@context": ["https://www.w3.org/2018/credentials/v1"],
    holder: subject.did,
    type: ["VerifiablePresentation"],
    verifiableCredential: [],
  };

  const vpJwt = await createVerifiablePresentationJwt(
    vpPayload,
    subject,
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
    definition_id: "tpr_write_presentation",
    descriptor_map: [],
    id: randomUUID(),
  };

  try {
    const response = await axios.post(
      `${authorisationApiUrl}/token`,
      new URLSearchParams({
        grant_type: "vp_token",
        presentation_submission: JSON.stringify(presentationSubmission),
        scope: "openid tpr_write",
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
  } catch (error) {
    if (isAxiosError(error)) {
      console.error(error.response?.data);
    } else {
      console.error(error);
    }
    throw new Error("Failed to get access token");
  }
}
