import { z } from "zod";

import { LEDGER_INVOKE_SCOPE, OPENID_SCOPE } from "../auth.constants.ts";

/**
 * Bearer token issued by Authorisation API v4 for "openid ledger_invoke" scope
 */
export const bearerTokenSchema = z
  .object({
    authorization_details: z.object({
      addresses: z.array(z.string()),
    }),
    scp: z.literal(`${OPENID_SCOPE} ${LEDGER_INVOKE_SCOPE}`),
    sub: z.string(),
  })
  .passthrough(); // Allow extra properties
