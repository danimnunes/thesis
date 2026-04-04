import type { ValidationOptions } from "class-validator";

import { buildMessage, ValidateBy } from "class-validator";

import { multibase } from "../utils/multibase.utils.ts";
import { multihashDecode } from "../utils/multihash.utils.ts";

export const IS_MULTIHASH_MULTIBASE64URL_ENCODED =
  "isMultihashMultibase64urlEncoded";

export function isMultihashMultibase64urlEncoded(value: unknown): boolean {
  if (typeof value !== "string") return false;

  try {
    multihashDecode(multibase.base64url.decode(value));
    return true;
  } catch {
    return false;
  }
}

export function IsMultihashMultibase64urlEncoded(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: IS_MULTIHASH_MULTIBASE64URL_ENCODED,
      validator: {
        defaultMessage: buildMessage(
          (eachPrefix) =>
            `${eachPrefix}$property must be multihash encoded in multi-base64url`,
          validationOptions,
        ),
        validate: (value) => isMultihashMultibase64urlEncoded(value),
      },
    },
    validationOptions,
  );
}
