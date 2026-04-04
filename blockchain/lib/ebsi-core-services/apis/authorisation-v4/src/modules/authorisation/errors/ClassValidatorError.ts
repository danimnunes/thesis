import type { ValidationError } from "class-validator";

export class ClassValidatorError extends Error {
  validationError: ValidationError;

  constructor(validationError: ValidationError) {
    super();
    this.validationError = validationError;
  }
}
