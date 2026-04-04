import { z } from "zod";

import { baseParamSchema } from "./BaseParamSchema.ts";
import { jsonRpcSchema } from "./JsonRpcSchema.ts";
import { refinements } from "./utils.ts";

const { isHexadecimal, isHexadecimalJSON } = refinements;

export const updateMetadataSchema = baseParamSchema.merge(
  z.object({
    metadata: z.string().superRefine(isHexadecimalJSON),

    schemaId: z.string().superRefine(isHexadecimal),

    schemaRevisionId: z.string().superRefine(isHexadecimal),
  }),
);

export type UpdateMetadataSchema = z.infer<typeof updateMetadataSchema>;

export const requestUpdateMetadataSchema = jsonRpcSchema.merge(
  z.object({
    method: z.literal("updateMetadata"),
    params: z.array(updateMetadataSchema).min(1).max(1),
  }),
);
