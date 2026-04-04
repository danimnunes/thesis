export interface JsonRpcResponseObject {
  id: null | number | string;
  jsonrpc: string;
  result: unknown;
}
