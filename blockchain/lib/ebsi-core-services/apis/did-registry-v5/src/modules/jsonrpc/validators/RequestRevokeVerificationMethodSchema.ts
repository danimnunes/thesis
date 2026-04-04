import { isBigNumberish, isDidV1 } from "@ebsiint-api/shared";
import { ethers } from "ethers";
import { z } from "zod";

import { baseParamSchema } from "./BaseParamSchema.ts";
import { jsonRpcSchema } from "./JsonRpcSchema.ts";

export const revokeVerificationMethodSchema = baseParamSchema.merge(
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
    notAfter: z
      .custom<ethers.BigNumberish>((val) => isBigNumberish(val))
      .refine((val) => ethers.getBigInt(val) >= 0n, {
        message: "Number must be greater than or equal to 0",
      }),
    vMethodId: z.string(),
  }),
);

export type RevokeVerificationMethodSchema = z.infer<
  typeof revokeVerificationMethodSchema
>;

export const requestRevokeVerificationMethodDtoSchema = jsonRpcSchema.merge(
  z.object({
    method: z.literal("revokeVerificationMethod"),
    params: z.array(revokeVerificationMethodSchema).min(1).max(1),
  }),
);
