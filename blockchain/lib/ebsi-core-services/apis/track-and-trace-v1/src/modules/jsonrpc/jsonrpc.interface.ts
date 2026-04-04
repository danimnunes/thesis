export interface JsonRpcResponseObject<T = unknown> {
  error?: unknown;
  id: null | number | string;
  jsonrpc: string;
  result: T;
}
