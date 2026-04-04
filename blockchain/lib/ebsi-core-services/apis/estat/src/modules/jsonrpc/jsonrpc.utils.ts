import { ethers } from "ethers";

import type { UnsignedTransaction } from "./validators/RequestSendSignedTransactionSchema.ts";

export function formatEthersSignature(r: string, s: string, v: string) {
  return { r, s, v: Number(v) as 27 | 28 } satisfies Partial<ethers.Signature>;
}

export function formatEthersUnsignedTransaction(
  unsignedTransaction: UnsignedTransaction,
) {
  return {
    chainId: Number(unsignedTransaction.chainId),
    data: unsignedTransaction.data,
    gasLimit: unsignedTransaction.gasLimit,
    gasPrice: unsignedTransaction.gasPrice,
    nonce: Number(unsignedTransaction.nonce),
    to: unsignedTransaction.to,
    // Legacy transaction type
    // We have to explicitly set it to 0 because ethers.js v6 incorrectly infers it as 1 otherwise
    // Potential fix: https://github.com/ethers-io/ethers.js/pull/4859
    type: 0,
    value: unsignedTransaction.value,
  } satisfies ethers.TransactionLike;
}
