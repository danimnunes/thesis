import { isDidV1 } from "@ebsiint-api/shared";
import validator from "validator";
import { z } from "zod";

import { baseParamSchema } from "./BaseParamSchema.ts";
import { jsonRpcSchema } from "./JsonRpcSchema.ts";

const { isHexadecimal } = validator.default;

export const removeIssuerProxySchema = baseParamSchema.merge(
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

    proxyId: z
      .string()
      .startsWith("0x", "Must be prefixed with 0x")
      .length(66) // 2 -> "0x" + 64 -> sha256
      .refine(isHexadecimal, { message: "Must be hexadecimal" }),
  }),
);

export type RemoveIssuerProxySchema = z.infer<typeof removeIssuerProxySchema>;

export const requestRemoveIssuerProxySchema = jsonRpcSchema.merge(
  z.object({
    method: z.literal("removeIssuerProxy"),
    params: z.array(removeIssuerProxySchema).min(1).max(1),
  }),
);
