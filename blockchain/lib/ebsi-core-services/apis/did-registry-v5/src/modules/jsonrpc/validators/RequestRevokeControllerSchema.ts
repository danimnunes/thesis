import { isDidV1 } from "@ebsiint-api/shared";
import { z } from "zod";

import { baseParamSchema } from "./BaseParamSchema.ts";
import { jsonRpcSchema } from "./JsonRpcSchema.ts";

export const revokeControllerSchema = baseParamSchema.merge(
  z.object({
    controller: z.string().superRefine((val, ctx) => {
      const controllerValidation = isDidV1(val);
      if (!controllerValidation.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: controllerValidation.error,
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

export type RevokeControllerSchema = z.infer<typeof revokeControllerSchema>;

export const requestRevokeControllerDtoSchema = jsonRpcSchema.merge(
  z.object({
    method: z.literal("revokeController"),
    params: z.array(revokeControllerSchema).min(1).max(1),
  }),
);
