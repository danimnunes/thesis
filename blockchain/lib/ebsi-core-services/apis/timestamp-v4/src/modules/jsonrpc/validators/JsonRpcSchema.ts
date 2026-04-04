import { z } from "zod";

export const jsonRpcSchema = z.object({
  id: z.optional(
    z.union([
      z.string(),
      z.number().int(),
      // Note: Null is discouraged, see https://www.jsonrpc.org/specification#request_object
      z.undefined(),
    ]),
  ),
  jsonrpc: z.literal("2.0"),
  method: z.string(),
  params: z.array(z.unknown()),
});

export type JsonRpcSchema = z.infer<typeof jsonRpcSchema>;
