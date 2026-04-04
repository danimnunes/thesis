import { isBigNumberish } from "@ebsiint-api/shared";
import { ethers } from "ethers";
import { z } from "zod";

import { baseParamSchema } from "./BaseParamSchema.ts";
import { jsonRpcSchema } from "./JsonRpcSchema.ts";
import { refinements } from "./utils.ts";

const { isHexadecimal, isHexadecimalJSON } = refinements;

export const timestampHashesSchema = baseParamSchema.merge(
  z.object({
    hashAlgorithmIds: z.array(
      z
        .custom<ethers.BigNumberish>((val) => isBigNumberish(val))
        .refine((val) => ethers.getBigInt(val) >= 0n, {
          message: "Number must be greater than or equal to 0",
        }),
    ),
    hashValues: z.array(z.string().superRefine(isHexadecimal)),
    timestampData: z
      .array(z.string().superRefine(isHexadecimalJSON))
      .optional(),
  }),
);

export type TimestampHashesSchema = z.infer<typeof timestampHashesSchema>;

export const requestTimestampHashesDtoSchema = jsonRpcSchema.merge(
  z.object({
    method: z.literal("timestampHashes"),
    params: z.array(timestampHashesSchema).min(1).max(1),
  }),
);
