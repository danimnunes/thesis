import { PayloadTooLargeError } from "./PayloadTooLargeError.ts";

export class ValueTooLargeError extends PayloadTooLargeError {
  constructor(detail: string) {
    super(PayloadTooLargeError.defaultTitle, { detail });
  }
}
