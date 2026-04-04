import {
  parseRevertReason,
  prefixWith0x,
  remove0xPrefix,
} from "@ebsiint-api/shared";
import { base16 } from "multiformats/bases/base16";
import { base58btc } from "multiformats/bases/base58";

// Generates a range
// Example: range(0, 5) => [0, 1, 2, 3, 4, 5]
export const range = (start: number, stop: number): number[] =>
  Array.from({ length: stop - start + 1 }, (_, i) => start + i);

export const schemaIdToHex = (schemaId: string): string => {
  if (schemaId.startsWith("0x")) {
    return schemaId;
  }

  // Decode multibase base58btc string
  const decoded = base58btc.decode(schemaId);

  // Encode in hex
  return prefixWith0x(base16.baseEncode(decoded));
};

export const hexToMultibaseBase58Btc = (value: string) => {
  return base58btc.encode(Buffer.from(remove0xPrefix(value), "hex"));
};

export function getContractError(err: unknown) {
  if (
    !err ||
    typeof err !== "object" ||
    !("data" in err) ||
    typeof err.data !== "string"
  ) {
    return "";
  }

  return parseRevertReason(err.data);
}
