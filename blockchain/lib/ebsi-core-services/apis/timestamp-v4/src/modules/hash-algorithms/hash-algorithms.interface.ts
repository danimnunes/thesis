export interface HashAlgorithmLink {
  hashAlgorithmId: number;
  href: string;
}

export interface HashAlgorithmResponseObject {
  ianaName: string;
  multihash: string;
  oid: string;
  outputLengthBits: number;
  status: "active" | "revoked";
}
