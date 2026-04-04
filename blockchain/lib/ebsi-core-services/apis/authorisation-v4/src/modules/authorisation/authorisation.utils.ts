import type { ClassConstructor } from "class-transformer";

import { ClassTransformer } from "class-transformer";
import { validate } from "class-validator";

import { ClassValidatorError } from "./errors/index.ts";

/**
 * Validates and transforms DTO.
 *
 * @param data The DTO to parse
 */
export async function parseDto<T extends object>(
  data: unknown,
  cls: ClassConstructor<T>,
): Promise<T> {
  const dataClass = new ClassTransformer().plainToInstance(cls, data);

  const errors = await validate(dataClass, {
    stopAtFirstError: true,
  });

  if (errors.length > 0) {
    throw new ClassValidatorError(errors[0]!); // Return only the first error
  }

  return dataClass;
}
