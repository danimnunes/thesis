import { z } from "zod";

export const issuerSchema = z.object({
  attributes: z.string(),
  did: z.string(),
  hasAttributes: z.boolean(),
});
