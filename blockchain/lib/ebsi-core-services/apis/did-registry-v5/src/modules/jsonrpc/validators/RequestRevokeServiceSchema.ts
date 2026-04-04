import { isDidV1 } from "@ebsiint-api/shared";
import { z } from "zod";

import { baseParamSchema } from "./BaseParamSchema.ts";
import { jsonRpcSchema } from "./JsonRpcSchema.ts";

export const revokeServiceSchema = baseParamSchema.merge(
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
    serviceId: z.string(),
  }),
);

export type RevokeServiceSchema = z.infer<typeof revokeServiceSchema>;

export const requestRevokeServiceDtoSchema = jsonRpcSchema.merge(
  z.object({
    method: z.literal("revokeService"),
    params: z.array(revokeServiceSchema).min(1).max(1),
  }),
);
