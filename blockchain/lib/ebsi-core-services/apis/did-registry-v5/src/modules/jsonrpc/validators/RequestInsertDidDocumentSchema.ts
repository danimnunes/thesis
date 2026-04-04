import {
  isBaseDocument,
  isBigNumberish,
  isDidV1,
  isPublicKeyHex,
} from "@ebsiint-api/shared";
import { ethers } from "ethers";
import { z } from "zod";

import { baseParamSchema } from "./BaseParamSchema.ts";
import { jsonRpcSchema } from "./JsonRpcSchema.ts";

export const insertDidDocumentSchema = baseParamSchema
  .merge(
    z.object({
      baseDocument: z.string().superRefine((val, ctx) => {
        const baseDocumentValidation = isBaseDocument(val);
        if (!baseDocumentValidation.success) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: baseDocumentValidation.error,
          });
        }
      }),
      did: z.string().superRefine((val, ctx) => {
        const didValidation = isDidV1(val);
        if (!didValidation.success) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: didValidation.error,
          });
        }
      }),
      isSecp256k1: z.literal(true),
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
      publicKey: z.string(),
      vMethodId: z.string(),
    }),
  )
  .superRefine(async (val, ctx) => {
    const { publicKey } = val;

    const publicKeyHexValidation = await isPublicKeyHex(publicKey, true);
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

export type InsertDidDocumentSchema = z.infer<typeof insertDidDocumentSchema>;

export const requestInsertDidDocumentDtoSchema = jsonRpcSchema.merge(
  z.object({
    method: z.literal("insertDidDocument"),
    params: z.array(insertDidDocumentSchema).min(1).max(1),
  }),
);
