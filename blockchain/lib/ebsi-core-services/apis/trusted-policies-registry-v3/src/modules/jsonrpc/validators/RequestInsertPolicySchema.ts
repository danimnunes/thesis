import { z } from "zod";

import { baseParamSchema } from "./BaseParamSchema.ts";
import { jsonRpcSchema } from "./JsonRpcSchema.ts";

export const insertPolicySchema = baseParamSchema.merge(
  z.object({
    description: z.string(),
    policyName: z.string(),
  }),
);

export type InsertPolicySchema = z.infer<typeof insertPolicySchema>;

export const requestInsertPolicyDtoSchema = jsonRpcSchema.merge(
  z.object({
    method: z.literal("insertPolicy"),
    params: z.array(insertPolicySchema).min(1).max(1),
  }),
);
