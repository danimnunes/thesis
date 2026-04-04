import type { EthersError, Interface } from "ethers";

const errorsCodes = [
  // Generic Errors
  "UNKNOWN_ERROR",
  "NOT_IMPLEMENTED",
  "UNSUPPORTED_OPERATION",
  "NETWORK_ERROR",
  "SERVER_ERROR",
  "TIMEOUT",
  "BAD_DATA",
  "CANCELLED",
  // Operational Errors
  "BUFFER_OVERRUN",
  "NUMERIC_FAULT",
  // Argument Errors
  "INVALID_ARGUMENT",
  "MISSING_ARGUMENT",
  "UNEXPECTED_ARGUMENT",
  "VALUE_MISMATCH",
  // Blockchain Errors
  "CALL_EXCEPTION",
  "INSUFFICIENT_FUNDS",
  "NONCE_EXPIRED",
  "REPLACEMENT_UNDERPRICED",
  "TRANSACTION_REPLACED",
  "UNCONFIGURED_NAME",
  "OFFCHAIN_FAULT",
  // User Interaction
  "ACTION_REJECTED",
];

export function decodeContractError(
  contractInterface: Interface,
  error: unknown,
): string | undefined {
  if (
    !(error instanceof Error) ||
    !("data" in error) ||
    typeof error.data !== "string"
  ) {
    return undefined;
  }

  const key = error.data.slice(0, 10);
  const errorFragment = contractInterface.getError(key);

  if (!errorFragment) {
    return undefined;
  }

  const res = contractInterface.decodeErrorResult(errorFragment, error.data);

  return res.toString();
}

export function isEthersError(err: unknown): err is EthersError {
  if (err instanceof Error && "code" in err && typeof err.code === "string") {
    return Object.values(errorsCodes).includes(err.code);
  }
  return false;
}
