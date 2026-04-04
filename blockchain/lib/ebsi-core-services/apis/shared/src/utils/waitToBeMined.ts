import type { TransactionReceiptParams } from "ethers";

import axios from "axios";

import { parseRevertReason } from "./parseRevertReason.ts";

/**
 * Overrides ethers.js' TransactionReceiptParams with properties returned by Besu
 * See https://besu.hyperledger.org/public-networks/reference/api/objects#transaction-receipt-object
 */
export interface BesuTransactionReceipt extends Omit<
  TransactionReceiptParams,
  "status"
> {
  revertReason: string;

  status: "0x0" | "0x1" | "0x2"; // 0x0 (failure), 0x1 (success), or 0x2 (invalid)
}

async function getTransactionReceipt(
  url: string,
  txId: string,
): Promise<BesuTransactionReceipt> {
  const { data } = await axios.post<{
    result: BesuTransactionReceipt;
  }>(url, {
    // eslint-disable-next-line unicorn/no-null
    id: null,
    jsonrpc: "2.0",
    method: "eth_getTransactionReceipt",
    params: [txId],
  });

  return data.result;
}

export const waitToBeMined = async (
  url: string,
  txId: string,
): Promise<BesuTransactionReceipt> => {
  let mined = false;
  let receipt: BesuTransactionReceipt;

  do {
    await new Promise((resolve) => {
      setTimeout(resolve, 500);
    });
    receipt = await getTransactionReceipt(url, txId);
    mined = !!receipt;
  } while (!mined);

  if (receipt.revertReason) {
    receipt.revertReason = parseRevertReason(receipt.revertReason);
  }

  return receipt;
};
