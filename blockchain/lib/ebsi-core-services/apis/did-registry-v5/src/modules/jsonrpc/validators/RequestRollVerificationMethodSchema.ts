import { isBigNumberish, isDidV1, isPublicKeyHex } from "@ebsiint-api/shared";
import { ethers } from "ethers";
import { z } from "zod";

import { baseParamSchema } from "./BaseParamSchema.ts";
import { jsonRpcSchema } from "./JsonRpcSchema.ts";

export const rollVerificationMethodSchema = baseParamSchema.merge(
  z.object({
    args: z
      .object({
        did: z.string().superRefine((val, ctx) => {
          const didValidation = isDidV1(val);
          if (!didValidation.success) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: didValidation.error,
            });
          }
        }),
        duration: z
          .custom<ethers.BigNumberish>((val) => isBigNumberish(val))
          .refine((val) => ethers.getBigInt(val) >= 0n, {
            message: "Number must be greater than or equal to 0",
          }),
        isSecp256k1: z.boolean(),
        notAfter: z
          .custom<ethers.BigNumberish>((val) => isBigNumberish(val))
          .refine((val) => ethers.getBigInt(val) >= 0n, {
            message: "Number must be greater than or equal to 0",
          }),
        notBefore: z
          .custom<ethers.BigNumberish>((val) => isBigNumberish(val))
          .refine((val) => ethers.getBigInt(val) >= 0n, {
            message: "Number must be greater than or equal to 0",
          }),
        oldVMethodId: z.string(),
        publicKey: z.string(),
        vMethodId: z.string(),
      })
      .superRefine(async (val, ctx) => {
        const { isSecp256k1, publicKey } = val;

        const publicKeyHexValidation = await isPublicKeyHex(
          publicKey,
          isSecp256k1,
        );
        if (!publicKeyHexValidation.success) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            fatal: true,
            message: publicKeyHexValidation.error,
            path: ["publicKey"],
          });
        }

        return z.NEVER;
      }),
  }),
);

export type RollVerificationMethodSchema = z.infer<
  typeof rollVerificationMethodSchema
>;

export const requestRollVerificationMethodDtoSchema = jsonRpcSchema.merge(
  z.object({
    method: z.literal("rollVerificationMethod"),
    params: z.array(rollVerificationMethodSchema).min(1).max(1),
  }),
);
