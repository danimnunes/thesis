import { isBigNumberish } from "@ebsiint-api/shared";
import { ethers } from "ethers";
import { z } from "zod";

import { baseParamSchema } from "./BaseParamSchema.ts";
import { jsonRpcSchema } from "./JsonRpcSchema.ts";

export const updatePolicySchema = baseParamSchema.merge(
  z.object({
    description: z.string(),
    policyId: z.optional(
      z.custom<ethers.BigNumberish>((val) => isBigNumberish(val), {
        message: "Not an integer string",
      }),
    ),
    policyName: z.optional(z.string()),
  }),
);

export type UpdatePolicySchema = z.infer<typeof updatePolicySchema>;

export const requestUpdatePolicyDtoSchema = jsonRpcSchema.merge(
  z.object({
    method: z.literal("updatePolicy"),
    params: z.array(updatePolicySchema).min(1).max(1),
  }),
);
