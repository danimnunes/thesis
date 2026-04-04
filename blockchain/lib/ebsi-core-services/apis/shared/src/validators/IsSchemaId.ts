import type { ValidationOptions } from "class-validator";

import { buildMessage, isHexadecimal, ValidateBy } from "class-validator";
import { base58btc } from "multiformats/bases/base58";

export const IS_SCHEMA_ID = "isSchemaId";

export const isSchemaId = (value: unknown) => {
  if (typeof value !== "string") return false;

  if (value.startsWith("0x") && isHexadecimal(value)) {
    return true;
  }

  try {
    // Check if value is a valid multibase (base58btc) string
    const decoded = base58btc.decode(value);

    // Check if the value is 32 bytes long (length of a sha256)
    if (decoded.byteLength !== 32) {
      throw new Error("Invalid length");
    }

    return true;
  } catch {
    return false;
  }
};

export function IsSchemaId(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: IS_SCHEMA_ID,
      validator: {
        defaultMessage: buildMessage(
          (eachPrefix) => `${eachPrefix}$property must be a valid schema ID`,
          validationOptions,
        ),
        validate: isSchemaId,
      },
    },
    validationOptions,
  );
}
