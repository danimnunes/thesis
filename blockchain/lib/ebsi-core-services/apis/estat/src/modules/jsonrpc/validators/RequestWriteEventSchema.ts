import { isBigNumberish } from "@ebsiint-api/shared";
import { ethers } from "ethers";
import { z } from "zod";

import { baseParamSchema } from "./BaseParamSchema.ts";
import { jsonRpcSchema } from "./JsonRpcSchema.ts";
import { refinements } from "./utils.ts";

const { isHexadecimal, isSender } = refinements;

export const writeEventSchema = baseParamSchema.merge(
  z.object({
    eventParams: z.object({
      documentHash: z.string().superRefine(isHexadecimal),

      /**
       * hash is externally generated
       */
      externalHash: z.string(),

      /**
       * metadata is a free text field.
       */
      metadata: z.string(),

      /**
       * origin is most of the times empty field, while it may be a string containing company name,
       * while it can also point into an Event. All assumed relations are external to the SC.
       */
      origin: z.string(),

      /**
       * sender is the did:key or did:ebsi that had permission with "write" for the given Document.
       */
      sender: z.string().superRefine(isSender),
    }),

    /**
     * Timestamp as hex string. By default it uses takes the timestamp from the blockchain
     */
    timestamp: z.optional(
      z
        .custom<ethers.BigNumberish>((val) => isBigNumberish(val))
        .refine((val) => ethers.getBigInt(val) > 0n, {
          message: "Number must be greater than 0",
        }),
    ),

    /**
     * Timestamp proof as hex string. It must be defined when "timestamp" is defined
     */
    timestampProof: z.optional(z.string().superRefine(isHexadecimal)),
  }),
);

export type WriteEventSchema = z.infer<typeof writeEventSchema>;

export const requestWriteEventDtoSchema = jsonRpcSchema.merge(
  z.object({
    method: z.literal("writeEvent"),
    params: z.array(writeEventSchema).min(1).max(1),
  }),
);
