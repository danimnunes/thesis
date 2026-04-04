import { isDidV1 } from "@ebsiint-api/shared";
import { Resolver } from "did-resolver";
import { z } from "zod";

import { baseParamSchema } from "./BaseParamSchema.ts";
import { jsonRpcSchema } from "./JsonRpcSchema.ts";

export const authoriseDidSchemaBuilder = (
  didResolver: Resolver,
  reqId: string,
) =>
  baseParamSchema.merge(
    z.object({
      authorisedDid: z.string().superRefine(async (val, ctx) => {
        const didValidation = isDidV1(val);

        if (!didValidation.success) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: didValidation.error,
          });
          return;
        }

        const doc = await didResolver.resolve(val, {
          axiosHeaders: { "x-request-id": reqId },
        });

        if (!doc.didDocument) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              "message" in doc.didResolutionMetadata &&
              typeof doc.didResolutionMetadata["message"] === "string"
                ? doc.didResolutionMetadata["message"]
                : `DID document ${val} not found`,
          });
        }
      }),
      senderDid: z.string().superRefine((val, ctx) => {
        const didValidation = isDidV1(val);
        if (!didValidation.success) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: didValidation.error,
          });
        }
      }),
      whiteList: z.boolean(),
    }),
  );

export type AuthoriseDidSchema = z.infer<
  ReturnType<typeof authoriseDidSchemaBuilder>
>;

export const requestAuthoriseDidDtoSchemaBuilder = (
  didResolver: Resolver,
  reqId: string,
) =>
  jsonRpcSchema.merge(
    z.object({
      method: z.literal("authoriseDid"),
      params: z
        .array(authoriseDidSchemaBuilder(didResolver, reqId))
        .min(1)
        .max(1),
    }),
  );
