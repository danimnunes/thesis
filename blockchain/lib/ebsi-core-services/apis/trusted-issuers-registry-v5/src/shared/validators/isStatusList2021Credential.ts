import type { EbsiEnvConfiguration } from "@europeum-ebsi/verifiable-credential";
import type {
  Schemas,
  VerifyCredentialOptions,
} from "@europeum-ebsi/verifiable-credential/vcdm11.js";

import { verifyCredentialJwt } from "@europeum-ebsi/verifiable-credential/vcdm11.js";
import Joi from "joi";

export type StatusList2021Credential = Schemas["StatusList2021Credential"];

export const statusList2021CredentialSchema = Joi.object({
  "@context": Joi.array()
    .ordered(
      Joi.string().valid("https://www.w3.org/2018/credentials/v1").required(),
      Joi.string().valid("https://w3id.org/vc/status-list/2021/v1").required(),
    )
    .items(Joi.string().uri())
    .required(),
  credentialSubject: Joi.object({
    encodedList: Joi.string().required(),
    id: Joi.string().uri().required(),
    statusPurpose: Joi.string().valid("revocation", "suspension").required(),
    type: Joi.string().valid("StatusList2021").required(),
  })
    .unknown(true)
    .required(),
  type: Joi.array()
    .ordered(
      // First item must be "VerifiableCredential"
      Joi.string().valid("VerifiableCredential").required(),
    )
    .items(
      // "StatusList2021Credential" must be present
      Joi.string().valid("StatusList2021Credential").required(),
      Joi.string(),
    )
    .required(),
})
  // Allow additional properties
  .unknown(true);

export async function checkStatusList2021Credential(
  credentialJwt: unknown,
  ebsiEnvConfig: EbsiEnvConfiguration,
  reqId: string,
  options?: VerifyCredentialOptions,
): Promise<{ error: string; success: false } | { success: true }> {
  // Note: we only support VC JWT for now -> the StatusList2021Credential must be a JWT
  if (!credentialJwt || typeof credentialJwt !== "string") {
    return {
      error: "JWT is not a string",
      success: false,
    };
  }

  try {
    // Verify credential and its signature
    const credential = await verifyCredentialJwt(credentialJwt, ebsiEnvConfig, {
      ...options,
      axiosHeaders: { "x-request-id": reqId },
      skipAccreditationsValidation: true, // No need to check the accreditation
    });

    Joi.assert(credential, statusList2021CredentialSchema);
  } catch (error) {
    let errorMessage = "Unknown error";
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return {
      error: errorMessage,
      success: false,
    };
  }

  return { success: true };
}
