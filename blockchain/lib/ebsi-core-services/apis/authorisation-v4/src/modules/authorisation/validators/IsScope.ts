import type { ValidationOptions } from "class-validator";

import { buildMessage, ValidateBy } from "class-validator";

import { CUSTOM_SCOPES, OPENID_SCOPE } from "../authorisation.constants.ts";

const IS_SCOPE = "isScope";

export function IsScope(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: IS_SCOPE,
      validator: {
        defaultMessage: buildMessage(
          (eachPrefix) =>
            `${eachPrefix}$property must be a combination of '${OPENID_SCOPE}' and one of the supported scopes ('${CUSTOM_SCOPES.join(
              "', '",
            )}')`,
          validationOptions,
        ),
        validate: (value) => isScope(value),
      },
    },
    validationOptions,
  );
}

function isScope(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }

  const valueAsArray = value.split(" ");

  // scope must contain 2 items
  if (valueAsArray.length !== 2) {
    return false;
  }

  // The first item must be "openid"
  if (valueAsArray[0] !== OPENID_SCOPE) {
    return false;
  }

  // The second item must be one of the custom scopes
  return CUSTOM_SCOPES.includes(valueAsArray[1]!);
}
