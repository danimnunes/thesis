import { isDidV1, isPublicKeyHex } from "@ebsiint-api/shared";
import { z } from "zod";

import { baseParamSchema } from "./BaseParamSchema.ts";
import { jsonRpcSchema } from "./JsonRpcSchema.ts";

export const addVerificationMethodSchema = baseParamSchema
  .merge(
    z.object({
      did: z.string().superRefine((val, ctx) => {
        const didValidation = isDidV1(val);
        if (!didValidation.success) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: didValidation.error,
          });
        }
      }),
      isSecp256k1: z.boolean(),
      publicKey: z.string(),
      vMethodId: z.string(),
    }),
  )
  .superRefine(async (val, ctx) => {
    const { isSecp256k1, publicKey } = val;

    const publicKeyHexValidation = await isPublicKeyHex(publicKey, isSecp256k1);
    if (!publicKeyHexValidation.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        fatal: true,
        message: publicKeyHexValidation.error,
        path: ["publicKey"],
      });
    }

    return z.NEVER;
  });

export type AddVerificationMethodSchema = z.infer<
  typeof addVerificationMethodSchema
>;

export const requestAddVerificationMethodDtoSchema = jsonRpcSchema.merge(
  z.object({
    method: z.literal("addVerificationMethod"),
    params: z.array(addVerificationMethodSchema).min(1).max(1),
  }),
);
