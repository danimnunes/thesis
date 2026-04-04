import { isBigNumberish } from "@ebsiint-api/shared";
import { ethers } from "ethers";
import { z } from "zod";

import { baseParamSchema } from "./BaseParamSchema.ts";
import { jsonRpcSchema } from "./JsonRpcSchema.ts";
import { refinements } from "./utils.ts";

const { isHexadecimal } = refinements;

export const insertRecordOwnerSchema = baseParamSchema.merge(
  z.object({
    notAfter: z
      .custom<ethers.BigNumberish>((val) => isBigNumberish(val))
      .refine((val) => ethers.getBigInt(val) >= 0n, {
        message: "Number must be greater than or equal to 0",
      }),
    notBefore: z
      .custom<ethers.BigNumberish>((val) => isBigNumberish(val))
      .refine((val) => ethers.getBigInt(val) >= 0n, {
        message: "Number must be greater than or equal to 0",
      }),
    ownerId: z.string(),
    recordId: z.string().superRefine(isHexadecimal),
  }),
);

export type InsertRecordOwnerSchema = z.infer<typeof insertRecordOwnerSchema>;

export const requestInsertRecordOwnerDtoSchema = jsonRpcSchema.merge(
  z.object({
    method: z.literal("insertRecordOwner"),
    params: z.array(insertRecordOwnerSchema).min(1).max(1),
  }),
);
