import { z } from "zod";

const basePexDescriptorSchema = z.object({
  format: z.string(),
  id: z.string(),
  path: z.string(),
});

type Descriptor = z.infer<typeof basePexDescriptorSchema> & {
  path_nested?: Descriptor | undefined;
};

const pexDescriptorSchema: z.ZodType<Descriptor> =
  basePexDescriptorSchema.extend({
    path_nested: z.optional(z.lazy(() => pexDescriptorSchema)),
  });

export const presentationSubmissionSchema = z.object({
  definition_id: z.string(),
  descriptor_map: z.array(pexDescriptorSchema),
  id: z.string(),
});
