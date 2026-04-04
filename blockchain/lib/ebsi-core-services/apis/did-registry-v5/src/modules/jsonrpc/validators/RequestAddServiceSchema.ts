import { isDidV1 } from "@ebsiint-api/shared";
import { z, ZodError } from "zod";

import { baseParamSchema } from "./BaseParamSchema.ts";
import { jsonRpcSchema } from "./JsonRpcSchema.ts";

const credentialRegistryServiceEndpointSchema = z.object({
  byId: z.string().optional(),
  byType: z.string().optional(),
});

const serviceSchema = z.object({
  /**
   * ZOD does not have validations for URI, only URL
   * https://www.w3.org/TR/did-core/#services
   */
  id: z.string(),
  serviceEndpoint: z
    .string()
    .or(credentialRegistryServiceEndpointSchema)
    .or(z.set(z.string().or(z.object({})))),
  type: z.string().or(z.set(z.string().min(1))),
});

function isServiceDocument(
  value: string,
): { error: string | ZodError; success: false } | { success: true } {
  let documentService;
  try {
    documentService = JSON.parse(value);
  } catch {
    return { error: "Unable to parse JSON", success: false };
  }

  const parsedServiceSchema = serviceSchema.safeParse(documentService);

  if (!parsedServiceSchema.success) {
    return {
      error: parsedServiceSchema.error,
      success: false,
    };
  }

  if (parsedServiceSchema.data.type === "CredentialRegistry") {
    const parsedServiceRegistrySchema =
      credentialRegistryServiceEndpointSchema.safeParse(
        parsedServiceSchema.data.serviceEndpoint,
      );

    if (!parsedServiceRegistrySchema.success) {
      return {
        error: parsedServiceRegistrySchema.error,
        success: false,
      };
    }
  }

  return { success: true };
}

export const addServiceSchema = baseParamSchema.merge(
  z.object({
    did: z.string().superRefine((val, ctx) => {
      const didValidation = isDidV1(val);
      if (!didValidation.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: didValidation.error,
        });
      }
    }),
    service: z.string().superRefine((val, ctx) => {
      const serviceValidation = isServiceDocument(val);
      if (!serviceValidation.success) {
        if (serviceValidation.error instanceof ZodError) {
          for (const error of serviceValidation.error.errors)
            ctx.addIssue({
              ...error,
              path: [...error.path],
            });
        } else {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: serviceValidation.error,
          });
        }
      }
    }),
  }),
);

export type AddServiceSchema = z.infer<typeof addServiceSchema>;

export const requestAddServiceDtoSchema = jsonRpcSchema.merge(
  z.object({
    method: z.literal("addService"),
    params: z.array(addServiceSchema).min(1).max(1),
  }),
);
