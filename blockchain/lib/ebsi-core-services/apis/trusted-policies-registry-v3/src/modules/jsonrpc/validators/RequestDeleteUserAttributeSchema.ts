import { isAddress } from "ethers";
import { z } from "zod";

import { baseParamSchema } from "./BaseParamSchema.ts";
import { jsonRpcSchema } from "./JsonRpcSchema.ts";

export const deleteUserAttributeSchema = baseParamSchema.merge(
  z.object({
    attribute: z.string(),
    user: z.string().refine(isAddress, { message: "Invalid Ethereum address" }),
  }),
);

export type DeleteUserAttributeSchema = z.infer<
  typeof deleteUserAttributeSchema
>;

export const requestDeleteUserAttributeDtoSchema = jsonRpcSchema.merge(
  z.object({
    method: z.literal("deleteUserAttribute"),
    params: z.array(deleteUserAttributeSchema).min(1).max(1),
  }),
);
