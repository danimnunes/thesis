import { isBigNumberish } from "@ebsiint-api/shared";
import { ethers } from "ethers";
import { z } from "zod";

import { baseParamSchema } from "./BaseParamSchema.ts";
import { jsonRpcSchema } from "./JsonRpcSchema.ts";
import { refinements } from "./utils.ts";

const { isHexadecimal } = refinements;

export const detachRecordVersionHashSchema = baseParamSchema.merge(
  z.object({
    hashValue: z.string().superRefine(isHexadecimal),
    recordId: z.string().superRefine(isHexadecimal),
    versionId: z
      .custom<ethers.BigNumberish>((val) => isBigNumberish(val))
      .refine((val) => ethers.getBigInt(val) >= 0n, {
        message: "Number must be greater than or equal to 0",
      }),
  }),
);

export type DetachRecordVersionHashSchema = z.infer<
  typeof detachRecordVersionHashSchema
>;

export const requestDetachRecordVersionHashDtoSchema = jsonRpcSchema.merge(
  z.object({
    method: z.literal("detachRecordVersionHash"),
    params: z.array(detachRecordVersionHashSchema).min(1).max(1),
  }),
);
