import { isBaseDocument, isDidV1 } from "@ebsiint-api/shared";
import { z } from "zod";

import { baseParamSchema } from "./BaseParamSchema.ts";
import { jsonRpcSchema } from "./JsonRpcSchema.ts";

export const updateBaseDocumentSchema = baseParamSchema.merge(
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
  }),
);

export type UpdateBaseDocumentSchema = z.infer<typeof updateBaseDocumentSchema>;

export const requestUpdateBaseDocumentDtoSchema = jsonRpcSchema.merge(
  z.object({
    method: z.literal("updateBaseDocument"),
    params: z.array(updateBaseDocumentSchema).min(1).max(1),
  }),
);
