import * as ClassValidator from "class-validator";
import { ZodError } from "zod";

import { ProblemDetailsError } from "../errors/ProblemDetailsError.ts";
import { isEthersError } from "./isEthersError.ts";

export function getErrorMessage(error: unknown, defaultErrorMessage?: string) {
  if (
    isEthersError(error) &&
    "reason" in error &&
    typeof error.reason === "string"
  ) {
    return error.reason;
  }

  if (error instanceof ZodError) {
    return error.issues
      .map((issue) => {
        if (issue.path.length === 0) {
          return issue.message;
        }

        return `Invalid '${issue.path.join(".")}': ${issue.message}`;
      })
      .join("\n");
  }

  if (error instanceof ProblemDetailsError && error.detail) {
    return error.detail;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return defaultErrorMessage ?? "Unknown error";
}

export function getErrorMessages(
  errors: ClassValidator.ValidationError[],
): string[] {
  return errors.flatMap((err) => {
    const errorMessages: string[] = [];
    if (err.constraints) {
      errorMessages.push(...Object.values(err.constraints));
    }

    if (err.children) {
      errorMessages.push(...getErrorMessages(err.children));
    }

    return errorMessages;
  });
}
