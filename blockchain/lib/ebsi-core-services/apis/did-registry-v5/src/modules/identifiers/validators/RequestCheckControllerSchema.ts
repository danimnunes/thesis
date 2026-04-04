import { isAddress } from "ethers";
import { z } from "zod";

import { jsonRpcSchema } from "./JsonRpcSchema.ts";

const checkControllerSchema = z
  .string()
  .refine(isAddress, { message: "Invalid Ethereum address" });

export const requestCheckControllerDtoSchema = jsonRpcSchema.merge(
  z.object({
    method: z.literal("checkController"),
    params: z.array(checkControllerSchema).min(1).max(1),
  }),
);
