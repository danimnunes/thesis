import { z } from "zod";

// We only need Auth API's `jwks_uri`
export const openidConfigurationSchema = z.object({
  jwks_uri: z.string().url(),
});
