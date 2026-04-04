export interface TimestampLink {
  href: string;
  timestampId: string; // multi-base64url encoded sha256(hash)
}

export interface TimestampResponseObject {
  blockNumber: number;
  data: string;
  hash: string; // multi-hash (base64 multi-encoded)
  timestamp: string;
  timestampedBy: string;
  transactionHash: string;
}
