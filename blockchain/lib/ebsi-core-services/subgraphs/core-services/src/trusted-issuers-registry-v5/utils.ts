import { Bytes, crypto, ethereum, log } from "@graphprotocol/graph-ts";

import { REVOKED, ROOT_TAO, TAO, TI } from "./constants";

/**
* Decodes transaction input using function signature and returns decoded parameters
* @see https://medium.com/@r2d2_68242/indexing-transaction-input-data-in-a-subgraph-6ff5c55abf20

*/
export function decodeTransactionInput(
  functionSig: string,
  tx: ethereum.Transaction,
): ethereum.Value | null {
  const sigHash = new Bytes(4);
  sigHash.set(crypto.keccak256(Bytes.fromUTF8(functionSig)).slice(0, 4));

  const fnSignatureBytes = new Bytes(4);
  fnSignatureBytes.set(tx.input.slice(0, 4));

  if (!sigHash.equals(fnSignatureBytes)) {
    log.error("Function signature mismatch. Expect {} but got {}", [
      sigHash.toHexString(),
      fnSignatureBytes.toHexString(),
    ]);
    return null;
  }

  // Remove function name, keep parameters only
  const type = functionSig.slice(functionSig.indexOf("("));

  // Create prefix 0x0000000000000000000000000000000000000000000000000000000000000020 expected by ethabi cargo crate
  const tuplePrefix = new Bytes(32);
  tuplePrefix[31] = 0x20;

  // Remove signature hash and add prefix to input data
  const data = new Bytes(tx.input.length - 4 + tuplePrefix.length);
  data.set(tuplePrefix, 0);
  data.set(tx.input.slice(4), 32);

  // Decode and return transaction parameters
  return ethereum.decode(type, data);
}

export function getIssuerType(i: i32): string {
  switch (i) {
    case REVOKED: {
      return "REVOKED";
    }
    case ROOT_TAO: {
      return "ROOT_TAO";
    }
    case TAO: {
      return "TAO";
    }
    case TI: {
      return "TI";
    }
    default: {
      log.error("Unknown issuer type {}. Using TI as a fallback", [
        i.toString(),
      ]);
      return "TI";
    }
  }
}
