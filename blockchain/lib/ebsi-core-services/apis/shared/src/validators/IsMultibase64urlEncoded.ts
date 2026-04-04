import type { ValidationOptions } from "class-validator";

import { buildMessage, ValidateBy } from "class-validator";

import { multibase } from "../utils/multibase.utils.ts";

export const IS_MULTIBASE64URL_ENCODED = "isMultibase64urlEncoded";

export function isMultibase64urlEncoded(value: unknown): boolean {
  if (typeof value !== "string") return false;

  try {
    multibase.base64url.decode(value);
    return true;
  } catch {
    return false;
  }
}

export function IsMultibase64urlEncoded(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: IS_MULTIBASE64URL_ENCODED,
      validator: {
        defaultMessage: buildMessage(
          (eachPrefix) =>
            `${eachPrefix}$property must be multi-base64url encoded`,
          validationOptions,
        ),
        validate: (value) => isMultibase64urlEncoded(value),
      },
    },
    validationOptions,
  );
}
