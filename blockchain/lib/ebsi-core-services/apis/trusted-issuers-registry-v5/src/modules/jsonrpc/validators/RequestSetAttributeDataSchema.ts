import type { Tir } from "@ebsiint-sc/trusted-issuers-registry-v5";

import { isDidV1 } from "@ebsiint-api/shared";
import validator from "validator";
import { z } from "zod";

import { baseParamSchema } from "./BaseParamSchema.ts";
import { jsonRpcSchema } from "./JsonRpcSchema.ts";

const { isHexadecimal } = validator.default;

export const setAttributeDataSchema = (tir: Tir) =>
  baseParamSchema
    .merge(
      z.object({
        attributeData: z
          .string()
          .startsWith("0x", "Must be prefixed with 0x")
          .refine(isHexadecimal, { message: "Must be hexadecimal" }),

        attributeId: z
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
      }),
    )
    .superRefine(async ({ attributeId, did }, ctx) => {
      try {
        await tir.getLatestRevisionAttribute(did, attributeId);
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Attribute ${attributeId} does not exist`,
          path: ["attributeId"],
        });
      }
    });

export type SetAttributeDataSchema = z.infer<
  ReturnType<typeof setAttributeDataSchema>
>;

export const requestSetAttributeDataSchema = (tir: Tir) =>
  jsonRpcSchema.merge(
    z.object({
      method: z.literal("setAttributeData"),
      params: z.array(setAttributeDataSchema(tir)).min(1).max(1),
    }),
  );
