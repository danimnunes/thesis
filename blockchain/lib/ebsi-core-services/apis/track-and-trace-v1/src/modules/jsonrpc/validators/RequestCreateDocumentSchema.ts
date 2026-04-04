import { isBigNumberish, isDidV1 } from "@ebsiint-api/shared";
import { ethers } from "ethers";
import { z } from "zod";

import { baseParamSchema } from "./BaseParamSchema.ts";
import { jsonRpcSchema } from "./JsonRpcSchema.ts";
import { refinements } from "./utils.ts";

const { isHexadecimal } = refinements;

export const createDocumentSchema = baseParamSchema.merge(
  z.object({
    didEbsiCreator: z.string().superRefine((val, ctx) => {
      const didValidation = isDidV1(val);
      if (!didValidation.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: didValidation.error,
        });
      }
    }),
    documentHash: z.string().superRefine(isHexadecimal),
    documentMetadata: z.string(),
    timestamp: z.optional(
      z
        .custom<ethers.BigNumberish>((val) => isBigNumberish(val))
        .refine((val) => ethers.getBigInt(val) >= 0n, {
          message: "Number must be greater than 0",
        }),
    ),
    timestampProof: z.optional(z.string().superRefine(isHexadecimal)),
  }),
);

export type CreateDocumentSchema = z.infer<typeof createDocumentSchema>;

export const requestCreateDocumentDtoSchema = jsonRpcSchema.merge(
  z.object({
    method: z.literal("createDocument"),
    params: z.array(createDocumentSchema).min(1).max(1),
  }),
);
