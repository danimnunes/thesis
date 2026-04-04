import { isAddress } from "ethers";
import { z } from "zod";

import { baseParamSchema } from "./BaseParamSchema.ts";
import { jsonRpcSchema } from "./JsonRpcSchema.ts";

export const insertUserAttributesSchema = baseParamSchema.merge(
  z.object({
    attributes: z.array(z.string()),
    user: z.string().refine(isAddress, { message: "Invalid Ethereum address" }),
  }),
);

export type InsertUserAttributesSchema = z.infer<
  typeof insertUserAttributesSchema
>;

export const requestInsertUserAttributesDtoSchema = jsonRpcSchema.merge(
  z.object({
    method: z.literal("insertUserAttributes"),
    params: z.array(insertUserAttributesSchema).min(1).max(1),
  }),
);
