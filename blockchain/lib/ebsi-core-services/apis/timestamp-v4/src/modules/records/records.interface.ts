export type InfoObject = Record<string, unknown>;

export interface RecordLink {
  href: string;
  recordId: string;
}

export interface RecordResponseObject {
  firstVersionTimestamps: string[];
  lastVersionTimestamps: string[];
  ownerIds: string[];
  revokedOwnerIds: string[];
  totalVersions: number;
}

export interface RecordVersionResponseObject {
  hashes: string[];
  info: InfoObject[];
}

export interface VersionLink {
  href: string;
  versionId: number;
}
