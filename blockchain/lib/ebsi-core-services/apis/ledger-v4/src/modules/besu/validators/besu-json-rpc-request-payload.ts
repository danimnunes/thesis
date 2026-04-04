import { z } from "zod";

export const besuJsonRpcRequestPayload = z.object({
  // Note: when this validator is run, the "id" field is required (notifications are ignored)
  id: z.union([
    z.string(),
    z.number().int(),
    // Note: Null is discouraged, see https://www.jsonrpc.org/specification#request_object
    // However, it's accepted by Besu.
    z.null(),
  ]),
  jsonrpc: z.literal("2.0"),
  method: z.string(),
  params: z.array(z.unknown()).optional(),
});

export type BesuJsonRpcRequestPayload = z.infer<
  typeof besuJsonRpcRequestPayload
>;
