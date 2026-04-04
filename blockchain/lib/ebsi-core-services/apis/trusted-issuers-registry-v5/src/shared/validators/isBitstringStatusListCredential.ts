import type { EbsiEnvConfiguration } from "@europeum-ebsi/verifiable-credential";
import type { VerifyCredentialOptions as VerifyVcdm11CredentialOptions } from "@europeum-ebsi/verifiable-credential/vcdm11.js";
import type { VerifyCredentialOptions as VerifyVcdm20CredentialOptions } from "@europeum-ebsi/verifiable-credential/vcdm20.js";

import { verifyCredentialJwt as verifyVcdm11CredentialJwt } from "@europeum-ebsi/verifiable-credential/vcdm11.js";
import { verifyCredentialJwt as verifyVcdm20CredentialJwt } from "@europeum-ebsi/verifiable-credential/vcdm20.js";
import Joi from "joi";

export const vcdm11BitstringStatusListCredentialSchema = Joi.object({
  "@context": Joi.array()
    .ordered(
      Joi.string().valid("https://www.w3.org/2018/credentials/v1").required(),
    )
    .items(Joi.string().uri())
    .required(),
  credentialSubject: Joi.object({
    encodedList: Joi.string().required(),
    id: Joi.string().uri().required(),
    statusPurpose: Joi.string()
      .valid("refresh", "revocation", "suspension", "message")
      .required(),
    ttl: Joi.number().optional(),
    type: Joi.string().valid("BitstringStatusList").required(),
  })
    .unknown(true)
    .required(),
  type: Joi.array()
    .ordered(
      // First item must be "VerifiableCredential"
      Joi.string().valid("VerifiableCredential").required(),
    )
    .items(
      // "BitstringStatusListCredential" must be present
      Joi.string().valid("BitstringStatusListCredential").required(),
      Joi.string(),
    )
    .required(),
})
  // Allow additional properties
  .unknown(true);

export const vcdm20BitstringStatusListCredentialSchema = Joi.object({
  "@context": Joi.array()
    .ordered(
      Joi.string().valid("https://www.w3.org/ns/credentials/v2").required(),
    )
    .items(Joi.string().uri())
    .required(),
  credentialSubject: Joi.object({
    encodedList: Joi.string().required(),
    id: Joi.string().uri().required(),
    statusPurpose: Joi.string()
      .valid("refresh", "revocation", "suspension", "message")
      .required(),
    ttl: Joi.number().optional(),
    type: Joi.string().valid("BitstringStatusList").required(),
  })
    .unknown(true)
    .required(),
  type: Joi.array()
    .ordered(
      // First item must be "VerifiableCredential"
      Joi.string().valid("VerifiableCredential").required(),
    )
    .items(
      // "BitstringStatusListCredential" must be present
      Joi.string().valid("BitstringStatusListCredential").required(),
      Joi.string(),
    )
    .required(),
})
  // Allow additional properties
  .unknown(true);

export async function checkVcdm11BitstringStatusListCredential(
  credentialJwt: unknown,
  ebsiEnvConfig: EbsiEnvConfiguration,
  reqId: string,
  options?: VerifyVcdm11CredentialOptions,
): Promise<{ error: string; success: false } | { success: true }> {
  // Note: we only support VC JWT for now -> the BitstringStatusListCredential must be a JWT
  if (!credentialJwt || typeof credentialJwt !== "string") {
    return {
      error: "JWT is not a string",
      success: false,
    };
  }

  try {
    // Verify credential and its signature
    const credential = await verifyVcdm11CredentialJwt(
      credentialJwt,
      ebsiEnvConfig,
      {
        ...options,
        axiosHeaders: { "x-request-id": reqId },
        skipAccreditationsValidation: true, // No need to check the accreditation
      },
    );

    Joi.assert(credential, vcdm11BitstringStatusListCredentialSchema);
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

export async function checkVcdm20BitstringStatusListCredential(
  credentialJwt: unknown,
  ebsiEnvConfig: EbsiEnvConfiguration,
  reqId: string,
  options?: VerifyVcdm20CredentialOptions,
): Promise<{ error: string; success: false } | { success: true }> {
  // Note: we only support VC JWT for now -> the BitstringStatusListCredential must be a JWT
  if (!credentialJwt || typeof credentialJwt !== "string") {
    return {
      error: "JWT is not a string",
      success: false,
    };
  }

  try {
    // Verify credential and its signature
    const credential = await verifyVcdm20CredentialJwt(
      credentialJwt,
      ebsiEnvConfig,
      {
        ...options,
        axiosHeaders: { "x-request-id": reqId },
        skipAccreditationsValidation: true, // No need to check the accreditation
      },
    );

    Joi.assert(credential, vcdm20BitstringStatusListCredentialSchema);
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
