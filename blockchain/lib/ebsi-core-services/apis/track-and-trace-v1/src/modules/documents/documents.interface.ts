export interface Access {
  /**
   * Document ID
   */
  documentId: string;

  /**
   * The `did:ebsi` or `did:key` DID of the granter of the permission.
   * "creator" shall have itself as "grantedBy".
   */
  grantedBy: string;

  /**
   * Permission granted: "write", "delegate" or "creator".
   */
  permission: "creator" | "delegate" | "write";

  /**
   * A `did:ebsi` or `did:key` DID.
   */
  subject: string;
}

export interface Document {
  creator: string;
  metadata: string;
  timestamp: Timestamp;
}

export interface Document__deprecated extends Document {
  events: string[];
}

export type DocumentAccesses = Access[];

export interface DocumentEventsLink {
  eventId: string;
  href: string;
}

export interface DocumentsLink {
  documentId: string;
  href: string;
}

export interface Event {
  externalHash: string;
  hash: string;
  metadata: string;
  origin: string;
  sender: string;
  timestamp: Timestamp;
}

export interface Timestamp {
  datetime: string;
  proof: string; // Either a block number ("block" source) or the hash from transaction input ("external" source)
  source: "block" | "external";
}
