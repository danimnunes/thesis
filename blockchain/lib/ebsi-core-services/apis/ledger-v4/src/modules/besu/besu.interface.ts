/**
 *  A JSON-RPC error, which are returned on failure from a JSON-RPC server.
 */
export interface BesuJsonRpcError {
  /**
   *  The response error.
   */
  error: {
    code: number;
    data?: unknown;
    message?: string;
  };

  /**
   *  The response ID to match it to the relevant request.
   */
  id: null | number | string;

  /**
   *  A required constant in the JSON-RPC specification.
   */
  jsonrpc: "2.0";
}

/**
 *  A JSON-RPC result, as returned by Besu.
 */
export interface BesuJsonRpcResult {
  /**
   *  The response ID to match it to the relevant request.
   */
  id: null | number | string;

  /**
   *  A required constant in the JSON-RPC specification.
   */
  jsonrpc: "2.0";

  /**
   *  The response result.
   */
  result: unknown;
}

export type BesuResponse =
  | BesuJsonRpcError
  | BesuJsonRpcResult
  // Notification
  | undefined;

export interface BesuServiceResponse {
  data:
    | BesuResponse // Response to a single request
    | BesuResponse[]; // Response to a batch request
  status: number;
}
