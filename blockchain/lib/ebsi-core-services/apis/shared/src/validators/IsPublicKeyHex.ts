import { importJWK } from "jose";
import { KeyObject } from "node:crypto";
import validator from "validator";
import { z } from "zod";

import type { ValidationResult } from "./types.ts";

import { encode } from "../utils/encode.utils.ts";
import { getErrorMessage } from "../utils/getErrorMessages.utils.ts";

const validators = validator.default;

function isBase64url(value: string): boolean {
  return validators.isBase64(value, { urlSafe: true });
}

/**
 * Public key JWK schema
 *
 * Warning: Only the required properties are accepted. Additional properties will throw an error.
 * This ensures that a user doesn't try to register a private key for instance.
 *
 * Note: the validation is quite basic at the moment. Further improvements could include:
 * - validating the length (in bytes) of the "x" and "y" parameters based on the curve
 *
 * @see https://www.rfc-editor.org/rfc/rfc7517
 */
const jwkSchema = z
  .discriminatedUnion("kty", [
    /**
     * Elliptic Curve keys
     *
     * @see https://www.rfc-editor.org/rfc/rfc7518#section-6.2
     */
    z
      .object({
        /**
         * "crv" (Curve) Parameter
         *
         * The "crv" (curve) parameter identifies the cryptographic curve used with the key.
         *
         * @see https://www.rfc-editor.org/rfc/rfc7518#section-6.2.1.1
         * @see https://www.rfc-editor.org/rfc/rfc8812#section-3
         */
        crv: z.union([
          z.literal("P-256"),
          z.literal("P-384"),
          z.literal("P-521"),
          z.literal("secp256k1"),
        ]),

        /**
         * "kty" (Key Type) Parameter
         *
         * The "kty" (key type) parameter identifies the cryptographic algorithm family used with the
         * key.
         *
         * @see https://www.rfc-editor.org/rfc/rfc7517#section-4.1
         * @see https://www.rfc-editor.org/rfc/rfc7518#section-6.1
         */
        kty: z.literal("EC"),

        /**
         * "x" (X Coordinate) Parameter
         *
         * The "x" (x coordinate) parameter contains the x coordinate for the Elliptic Curve point. It
         * is represented as the base64url encoding of the octet string representation of the
         * coordinate.  The length of this octet string MUST be the full size of a coordinate for the
         * curve specified in the "crv" parameter.  For example, if the value of "crv" is "P-521", the
         * octet string must be 66 octets long.
         *
         * @see https://www.rfc-editor.org/rfc/rfc7518#section-6.2.1.2
         */
        x: z.string().refine(isBase64url),

        /**
         * "y" (Y Coordinate) Parameter
         *
         * @see https://www.rfc-editor.org/rfc/rfc7518#section-6.2.1.3
         */
        y: z.string().refine(isBase64url),
      })
      .passthrough(), // Allow extra properties

    /**
     * RSA keys
     *
     * @see https://www.rfc-editor.org/rfc/rfc7518#section-6.3
     */
    z
      .object({
        /**
         * "e" (Exponent) Parameter
         *
         * The "e" (exponent) parameter contains the exponent value for the RSA public key. It is
         * represented as a Base64urlUInt-encoded value.
         *
         * @see https://www.rfc-editor.org/rfc/rfc7518#section-6.3.1.2
         */
        e: z.string().refine(isBase64url),

        /**
         * "kty" (Key Type) Parameter
         *
         * The "kty" (key type) parameter identifies the cryptographic algorithm family used with the
         * key.
         *
         * @see https://www.rfc-editor.org/rfc/rfc7517#section-4.1
         * @see https://www.rfc-editor.org/rfc/rfc7518#section-6.1
         */
        kty: z.literal("RSA"),

        /**
         * "n" (Modulus) Parameter
         *
         * The "n" (modulus) parameter contains the modulus value for the RSA public key. It is
         * represented as a Base64urlUInt-encoded value.
         *
         * @see https://www.rfc-editor.org/rfc/rfc7518#section-6.3.1.1
         */
        n: z.string().refine(isBase64url),
      })
      .passthrough(), // Allow extra properties

    /**
     * EdDSA keys
     *
     * @see https://www.rfc-editor.org/rfc/rfc8032.html
     * @see https://www.rfc-editor.org/rfc/rfc8037#section-2
     */
    z
      .object({
        /**
         * "crv" (Curve) Parameter
         *
         * The "crv" (curve) parameter identifies the cryptographic curve used with the key.
         *
         * @see https://www.rfc-editor.org/rfc/rfc8037#section-3.1
         * @see https://www.rfc-editor.org/rfc/rfc8037#section-3.2
         */
        crv: z.union([
          z.literal("Ed25519"),
          z.literal("Ed448"),
          z.literal("X25519"),
          z.literal("X448"),
        ]),

        /**
         * "kty" (Key Type) Parameter
         *
         * The "kty" (key type) parameter identifies the cryptographic algorithm family used with the
         * key.
         *
         * @see https://www.rfc-editor.org/rfc/rfc7517#section-4.1
         * @see https://www.rfc-editor.org/rfc/rfc7518#section-6.1
         * @see https://www.rfc-editor.org/rfc/rfc8037#section-2
         */
        kty: z.literal("OKP"),

        /**
         * "x" (Public Key) Parameter
         *
         * The parameter "x" MUST be present and contain the public key encoded using the base64url
         * encoding.
         *
         * @see https://www.rfc-editor.org/rfc/rfc8037#section-2
         */
        x: z.string().refine(isBase64url),
      })
      .passthrough(), // Allow extra properties
  ])
  .superRefine((key, ctx) => {
    if (key.kty === "EC" && "d" in key) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        fatal: true,
        message: "ECC Private Key 'd' is not allowed",
      });
    } else if (key.kty === "RSA" && "d" in key) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        fatal: true,
        message: "Private Exponent 'd' is not allowed",
      });
    } else if (key.kty === "OKP" && "d" in key) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        fatal: true,
        message: "EdDSA Private Key 'd' is not allowed",
      });
    }
  });

export async function isPublicKeyHex(
  value: unknown,
  isSecp256k1: boolean,
): Promise<ValidationResult> {
  let jwk: ReturnType<typeof getPublicKeyJwk>;
  try {
    jwk = getPublicKeyJwk(value, isSecp256k1);
  } catch (error) {
    return {
      error: getErrorMessage(error),
      success: false,
    };
  }

  if (isSecp256k1) {
    // No need to validate the JWK in case of secp256k1
    return { success: true };
  }

  let key;
  try {
    key = await importJWK(jwk);
  } catch (error) {
    return {
      error: getErrorMessage(error, "The public key is not a valid JWK"),
      success: false,
    };
  }

  if (!(key instanceof KeyObject)) {
    return {
      error: "The public key is not a valid JWK",
      success: false,
    };
  }

  if (key.type !== "public") {
    return {
      error: "The key is not a public key",
      success: false,
    };
  }

  return { success: true };
}

function getPublicKeyJwk(value: unknown, isSecp256k1: boolean) {
  if (typeof value !== "string") {
    throw new TypeError("The public key must be a string");
  }

  if (!/^0x[0-9A-F]+$/i.test(value)) {
    throw new Error(
      "The public key must be an hexadecimal string prefixed with 0x",
    );
  }

  const publicKey = value.replace("0x", "");

  if (publicKey.length % 2 !== 0) {
    throw new Error("The public key must be an even number of bytes");
  }

  if (isSecp256k1) {
    // The key must either be 64 bytes or 65 bytes with "04" prefix
    if (
      publicKey.length === 128 ||
      (publicKey.startsWith("04") && publicKey.length === 130)
    ) {
      return encode.publicKey.fromHexToJWK(publicKey);
    }

    throw new Error(
      "The public key must be secp256k1 uncompressed (64 bytes or 65 bytes with 0x04 prefix)",
    );
  }

  let parsedObject: unknown;

  try {
    parsedObject = JSON.parse(Buffer.from(publicKey, "hex").toString());
  } catch {
    throw new Error("The public key must be valid JSON object");
  }

  if (typeof parsedObject !== "object" || parsedObject === null) {
    throw new Error("The public key must be an object");
  }

  const parsingResult = jwkSchema.safeParse(parsedObject);
  if (!parsingResult.success) {
    throw parsingResult.error;
  }

  const jwk = parsingResult.data;

  return jwk;
}
