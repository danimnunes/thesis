import { z } from "zod";

import { baseParamSchema } from "./BaseParamSchema.ts";

export const unsignedTransactionSchema = baseParamSchema.merge(
  z.object({
    chainId: z.string(),
    data: z.string(),
    from: z.string(),
    gasLimit: z.string(),
    gasPrice: z.string(),
    nonce: z.string(),
    to: z.string(),
    value: z.string(),
  }),
);

export type UnsignedTransactionSchema = z.infer<
  typeof unsignedTransactionSchema
>;
