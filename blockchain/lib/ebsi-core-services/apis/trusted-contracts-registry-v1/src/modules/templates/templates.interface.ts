export interface Template {
  auditURI: string;
  beaconAddress: string;
  contractHash: string;
  id: string;
  initSelector: string;
  isActive: boolean;
  name: string;
  repoURI: string;
  storageLayoutHash: string;
  version: string;
}

export interface TemplatesLink {
  href: string;
  id: string;
}
