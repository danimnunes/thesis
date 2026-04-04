import { z } from "zod";

import { baseParamSchema } from "./BaseParamSchema.ts";
import { jsonRpcSchema } from "./JsonRpcSchema.ts";
import { refinements } from "./utils.ts";

const { isHexadecimal } = refinements;
export const revokeRecordOwnerSchema = baseParamSchema.merge(
  z.object({
    ownerId: z.string(),
    recordId: z.string().superRefine(isHexadecimal),
  }),
);

export type RevokeRecordOwnerSchema = z.infer<typeof revokeRecordOwnerSchema>;

export const requestRevokeRecordOwnerDtoSchema = jsonRpcSchema.merge(
  z.object({
    method: z.literal("revokeRecordOwner"),
    params: z.array(revokeRecordOwnerSchema).min(1).max(1),
  }),
);
