import { z } from "zod";

/**
 * JSON Web Key
 *
 * @see https://www.rfc-editor.org/rfc/rfc7517#section-4
 */
const jwkSchema = z
  .object({
    crv: z.optional(z.string()),
    kid: z.optional(z.string()),
    // Only validate that `kty` is present
    kty: z.string(),
  })
  .passthrough(); // Allow extra properties

/**
 * JSON Web Key Set
 * A JWK Set is a JSON object that represents a set of JWKs.
 *
 * @see https://www.rfc-editor.org/rfc/rfc7517#section-5
 */
export const jwksSchema = z.object({
  keys: z.array(jwkSchema).nonempty(),
});
