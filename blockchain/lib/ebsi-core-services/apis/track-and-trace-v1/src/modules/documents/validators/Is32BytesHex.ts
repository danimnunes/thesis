import type { ValidationOptions } from "class-validator";

import { buildMessage, isHexadecimal, ValidateBy } from "class-validator";

const IS_32_BYTES_HEX = "is32BytesHex";

const is32BytesHex = (value: unknown) => {
  // Check if the value is an hexadecimal string starting with 0x
  if (
    typeof value !== "string" ||
    !value.startsWith("0x") ||
    !isHexadecimal(value)
  ) {
    return false;
  }

  // Check if the byte length is 32
  if (Buffer.from(value.slice(2), "hex").byteLength !== 32) {
    return false;
  }

  return true;
};

export function Is32BytesHex(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: IS_32_BYTES_HEX,
      validator: {
        defaultMessage: buildMessage(
          (eachPrefix) =>
            `${eachPrefix}$property must be 32 bytes encoded in hexadecimal and start with 0x`,
          validationOptions,
        ),
        validate: is32BytesHex,
      },
    },
    validationOptions,
  );
}
