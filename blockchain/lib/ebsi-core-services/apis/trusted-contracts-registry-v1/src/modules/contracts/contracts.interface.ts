export interface Contract {
  address: string;
  deployer: string;
  deployerDID: string;
  deploymentTimestamp: number;
  isActive: boolean;
  templateId: string;
}

export interface ContractsLink {
  address: string;
  href: string;
}
