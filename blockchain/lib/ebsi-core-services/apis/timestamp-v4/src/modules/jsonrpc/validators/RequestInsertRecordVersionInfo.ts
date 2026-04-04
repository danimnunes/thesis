import { isBigNumberish } from "@ebsiint-api/shared";
import { ethers } from "ethers";
import { z } from "zod";

import { baseParamSchema } from "./BaseParamSchema.ts";
import { jsonRpcSchema } from "./JsonRpcSchema.ts";
import { refinements } from "./utils.ts";

const { isHexadecimal, isHexadecimalJSON } = refinements;

export const insertRecordVersionInfoSchema = baseParamSchema.merge(
  z.object({
    recordId: z.string().superRefine(isHexadecimal),
    versionId: z
      .custom<ethers.BigNumberish>((val) => isBigNumberish(val))
      .refine((val) => ethers.getBigInt(val) >= 0n, {
        message: "Number must be greater than or equal to 0",
      }),
    versionInfo: z.string().superRefine(isHexadecimalJSON),
  }),
);

export type InsertRecordVersionInfoSchema = z.infer<
  typeof insertRecordVersionInfoSchema
>;

export const requestInsertRecordVersionInfoDtoSchema = jsonRpcSchema.merge(
  z.object({
    method: z.literal("insertRecordVersionInfo"),
    params: z.array(insertRecordVersionInfoSchema).min(1).max(1),
  }),
);
