import { JsonRpcError } from "./JsonRpcError.ts";

/**
 * InvalidRequestJsonRpcError defines the Invalid Request (-32600) error type.
 */

export class InvalidRequestJsonRpcError extends JsonRpcError {
  static defaultTitle = "Invalid Request";

  static statusCode = 400;

  /**
   * @param message A String providing a short description of the error. The message SHOULD be limited to a concise single sentence.
   * @param id It MUST be the same as the value of the id member in the Request Object.
   * @param data A Primitive or Structured value that contains additional information about the error. This may be omitted.
   * @param code JSON-RPC error code (default: -32_600)
   */
  constructor(
    message: string,
    id: null | number | string | undefined,
    data?: unknown,
    code = -32_600,
  ) {
    super(code, 400, message, id, data);
    this.name = "InvalidRequestJsonRpcError";
  }
}
