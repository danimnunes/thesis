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
