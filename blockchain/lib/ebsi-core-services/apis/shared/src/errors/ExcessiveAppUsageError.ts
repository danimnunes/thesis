import { BadRequestError } from "./BadRequestError.ts";

export class ExcessiveAppUsageError extends BadRequestError {
  constructor(detail?: string) {
    super("Excessive app usage", detail ? { detail } : {});
  }
}
