import { isBigNumberish } from "@ebsiint-api/shared";
import { ethers } from "ethers";
import { z } from "zod";

import { baseParamSchema } from "./BaseParamSchema.ts";
import { jsonRpcSchema } from "./JsonRpcSchema.ts";
import { refinements } from "./utils.ts";

const { isHexadecimal, isSender } = refinements;

export const revokeAccessSchema = baseParamSchema.merge(
  z.object({
    documentHash: z.string().superRefine(isHexadecimal),
    permission: z
      .custom<ethers.BigNumberish>((val) => isBigNumberish(val))
      .refine(
        (val) => ethers.getBigInt(val) === 0n || ethers.getBigInt(val) === 1n,
        {
          message: "Number must be 0 (delegate) or 1 (write)",
        },
      ),
    revokedByAccount: z.string().superRefine(isSender),
    subjectAccount: z.string().superRefine(isSender),
  }),
);

export type RevokeAccessSchema = z.infer<typeof revokeAccessSchema>;

export const requestRevokeAccessDtoSchema = jsonRpcSchema.merge(
  z.object({
    method: z.literal("revokeAccess"),
    params: z.array(revokeAccessSchema).min(1).max(1),
  }),
);
