import type { ValidationOptions } from "class-validator";

import {
  EBSI_DID_METHOD_PREFIX,
  validate,
} from "@europeum-ebsi/ebsi-did-resolver";
import { util } from "@europeum-ebsi/key-did-resolver";
import { buildMessage, registerDecorator } from "class-validator";

import type { ValidationResult } from "./types.ts";

export function isDid(value: unknown): ValidationResult {
  if (!value || typeof value !== "string")
    return { error: "must be a valid DID string", success: false };

  try {
    if (value.startsWith(EBSI_DID_METHOD_PREFIX)) {
      validate(value);
    } else {
      util.validateDid(value);
    }
    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "unknown error",
      success: false,
    };
  }
}

export function IsDid(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string): void => {
    registerDecorator({
      name: "isDid",
      propertyName,
      target: object.constructor,
      validator: {
        defaultMessage: buildMessage(
          (eachPrefix) => `${eachPrefix}$property must be a valid DID string`,
          validationOptions,
        ),
        validate: (value) => isDid(value).success,
      },
    });
  };
}
