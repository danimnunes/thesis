import { isBigNumberish, isDidV1 } from "@ebsiint-api/shared";
import { ethers } from "ethers";
import validator from "validator";
import { z } from "zod";

import { baseParamSchema } from "./BaseParamSchema.ts";
import { jsonRpcSchema } from "./JsonRpcSchema.ts";

const { isHexadecimal } = validator.default;

export const setAttributeMetadataSchema = baseParamSchema.merge(
  z.object({
    attributeIdTao: z
      .string()
      .startsWith("0x", "Must be prefixed with 0x")
      .length(66) // 2 -> "0x" + 64 -> sha256
      .refine(isHexadecimal, { message: "Must be hexadecimal" }),

    did: z.string().superRefine((val, ctx) => {
      const didValidation = isDidV1(val);
      if (!didValidation.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: didValidation.error,
        });
      }
    }),

    /**
     * 0: Undefined
     * 1: RootTAO
     * 2: TAO
     * 3: TI
     * 4: Revoked
     */
    issuerType: z
      .custom<ethers.BigNumberish>((val) => isBigNumberish(val))
      .refine(
        (val) => {
          const v = ethers.getBigInt(val);
          return [0n, 1n, 2n, 3n, 4n].includes(v);
        },
        {
          message:
            "issuerType must be equal to 0 (Undefined), 1 (RootTAO), 2 (TAO), 3 (TI) or 4 (Revoked)",
        },
      ),

    revisionId: z
      .string()
      .startsWith("0x", "Must be prefixed with 0x")
      .length(66) // 2 -> "0x" + 64 -> sha256
      .refine(isHexadecimal, { message: "Must be hexadecimal" }),

    taoDid: z.string().superRefine((val, ctx) => {
      const didValidation = isDidV1(val);
      if (!didValidation.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: didValidation.error,
        });
      }
    }),
  }),
);

export type SetAttributeMetadataSchema = z.infer<
  typeof setAttributeMetadataSchema
>;

export const requestSetAttributeMetadataSchema = jsonRpcSchema.merge(
  z.object({
    method: z.literal("setAttributeMetadata"),
    params: z.array(setAttributeMetadataSchema).min(1).max(1),
  }),
);
