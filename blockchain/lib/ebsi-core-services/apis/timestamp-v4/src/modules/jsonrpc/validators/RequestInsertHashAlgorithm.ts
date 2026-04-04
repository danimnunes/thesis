import { isBigNumberish } from "@ebsiint-api/shared";
import { ethers } from "ethers";
import { z } from "zod";

import { baseParamSchema } from "./BaseParamSchema.ts";
import { jsonRpcSchema } from "./JsonRpcSchema.ts";
import { refinements } from "./utils.ts";

const { isMultihash } = refinements;

export const insertHashAlgorithmSchema = baseParamSchema.merge(
  z.object({
    ianaName: z.string().nonempty("ianaName can't be empty"),
    multiHash: z.string().superRefine(isMultihash),
    oid: z.string().optional(),
    outputLength: z
      .custom<ethers.BigNumberish>((val) => isBigNumberish(val))
      .refine((val) => ethers.getBigInt(val) >= 0n, {
        message: "Number must be greater than or equal to 0",
      }),
    status: z
      .custom<ethers.BigNumberish>((val) => isBigNumberish(val))
      .refine(
        (val) => {
          const v = ethers.getBigInt(val);
          return v == 1n || v === 2n;
        },
        {
          message: "Status must be equal to 1 (active) or 2 (revoked)",
        },
      ),
  }),
);

export type InsertHashAlgorithmSchema = z.infer<
  typeof insertHashAlgorithmSchema
>;

export const requestInsertHashAlgorithmDtoSchema = jsonRpcSchema.merge(
  z.object({
    method: z.literal("insertHashAlgorithm"),
    params: z.array(insertHashAlgorithmSchema).min(1).max(1),
  }),
);
