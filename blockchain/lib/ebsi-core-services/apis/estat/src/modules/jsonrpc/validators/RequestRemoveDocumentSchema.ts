import { z } from "zod";

import { baseParamSchema } from "./BaseParamSchema.ts";
import { jsonRpcSchema } from "./JsonRpcSchema.ts";
import { refinements } from "./utils.ts";

const { isHexadecimal } = refinements;

export const removeDocumentSchema = baseParamSchema.merge(
  z.object({
    documentHash: z.string().superRefine(isHexadecimal),
  }),
);

export type RemoveDocumentSchema = z.infer<typeof removeDocumentSchema>;

export const requestRemoveDocumentDtoSchema = jsonRpcSchema.merge(
  z.object({
    method: z.literal("removeDocument"),
    params: z.array(removeDocumentSchema).min(1).max(1),
  }),
);
