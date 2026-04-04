/**
 * Collection of functions for generating fake data to be used in the tests.
 */

export interface TestContract {
  address: string;
  deployer: string;
  deployerDID: string;
  deploymentTimestamp: bigint;
  isActive: boolean;
  templateId: string;
}

export interface TestTemplate {
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
