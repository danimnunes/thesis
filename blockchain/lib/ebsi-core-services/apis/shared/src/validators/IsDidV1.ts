import type { ValidationOptions } from "class-validator";

import { validate } from "@europeum-ebsi/ebsi-did-resolver";
import { buildMessage, ValidateBy } from "class-validator";

import type { ValidationResult } from "./types.ts";

export const IS_DID_V1 = "isDidV1";

export function isDidV1(value: unknown): ValidationResult {
  try {
    validate(value as string); // EBSI DID method v2 is not supported by the lib any more.
    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "unknown error",
      success: false,
    };
  }
}

export function IsDidV1(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: IS_DID_V1,
      validator: {
        defaultMessage: buildMessage(
          (eachPrefix) => `${eachPrefix}$property must be a valid DID v1`,
          validationOptions,
        ),
        validate: (value) => isDidV1(value).success,
      },
    },
    validationOptions,
  );
}
