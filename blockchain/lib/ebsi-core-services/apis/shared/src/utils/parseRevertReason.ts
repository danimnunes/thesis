export function parseRevertReason(revertReason: string): string {
  // Try to clean the revert reason (only keep the string data)
  // See https://besu.hyperledger.org/private-networks/how-to/send-transactions/revert-reason#revert-reason-format
  const cleanerRevertReason = Buffer.from(revertReason.slice(138), "hex")
    .toString()
    .replaceAll(/[^a-z0-9:'. ]/gi, "");

  if (cleanerRevertReason) {
    return cleanerRevertReason;
  }

  return revertReason;
}
