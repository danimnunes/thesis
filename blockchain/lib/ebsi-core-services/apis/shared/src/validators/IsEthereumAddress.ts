import type { ValidationOptions } from "class-validator";

import { buildMessage, isEthereumAddress, ValidateBy } from "class-validator";
import { isAddress } from "ethers";

export const IS_ETHEREUM_ADDRESS = "isEthereumAddress";

export function IsEthereumAddress(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: IS_ETHEREUM_ADDRESS,
      validator: {
        defaultMessage: buildMessage(
          (eachPrefix) => `${eachPrefix}$property must be an Ethereum address`,
          validationOptions,
        ),
        validate: (value) =>
          // Check that the value is a a string and matches the regex /^(0x)[0-9a-f]{40}$/i
          isEthereumAddress(value) &&
          // Check checksum
          isAddress(value),
      },
    },
    validationOptions,
  );
}
