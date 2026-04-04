import { isBigNumberish } from "@ebsiint-api/shared";
import { ethers } from "ethers";
import { z } from "zod";

import { baseParamSchema } from "./BaseParamSchema.ts";
import { jsonRpcSchema } from "./JsonRpcSchema.ts";

export const activatePolicySchema = baseParamSchema.merge(
  z.object({
    policyId: z.optional(
      z.custom<ethers.BigNumberish>((val) => isBigNumberish(val), {
        message: "Not an integer string",
      }),
    ),
    policyName: z.optional(z.string()),
  }),
);

export type ActivatePolicySchema = z.infer<typeof activatePolicySchema>;

export const requestActivatePolicyDtoSchema = jsonRpcSchema.merge(
  z.object({
    method: z.literal("activatePolicy"),
    params: z.array(activatePolicySchema).min(1).max(1),
  }),
);
