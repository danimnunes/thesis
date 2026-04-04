import { isBigNumberish } from "@ebsiint-api/shared";
import { ethers } from "ethers";
import { z } from "zod";

import { baseParamSchema } from "./BaseParamSchema.ts";
import { jsonRpcSchema } from "./JsonRpcSchema.ts";

export const deactivatePolicySchema = baseParamSchema.merge(
  z.object({
    policyId: z.optional(
      z.custom<ethers.BigNumberish>((val) => isBigNumberish(val), {
        message: "Not an integer string",
      }),
    ),
    policyName: z.optional(z.string()),
  }),
);

export type DeactivatePolicySchema = z.infer<typeof deactivatePolicySchema>;

export const requestDeactivatePolicyDtoSchema = jsonRpcSchema.merge(
  z.object({
    method: z.literal("deactivatePolicy"),
    params: z.array(deactivatePolicySchema).min(1).max(1),
  }),
);
