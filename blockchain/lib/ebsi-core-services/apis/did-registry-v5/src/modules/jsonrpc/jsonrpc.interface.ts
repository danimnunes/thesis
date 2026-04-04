export interface JsonRpcResponseObject {
  error?: unknown;
  id: null | number | string;
  jsonrpc: string;
  result: unknown;
}
