import type { PaginatedList } from "@ebsiint-api/shared";
import type { ProxyFactory } from "@ebsiint-sc/trusted-contracts-registry-v1";

import { paginate } from "@ebsiint-api/shared";

import type { ContractsLink } from "./contracts.interface.ts";

export function formatContracts(
  contracts: Awaited<ReturnType<ProxyFactory["getDeployedContracts"]>>,
  page: number,
  pageSize: number,
  baseUrl: string,
): PaginatedList<ContractsLink> {
  const total = Number(contracts.total);

  // Reshape items
  const items = contracts.items.map((address) => {
    return {
      address,
      href: `${baseUrl}/${address}`,
    };
  });

  return paginate<ContractsLink>(items, baseUrl, total, page, pageSize);
}
