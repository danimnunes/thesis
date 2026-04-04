import type { PaginatedList } from "@ebsiint-api/shared";
import type { PolicyRegistry } from "@ebsiint-sc/trusted-policies-registry-v3";

import { paginate } from "@ebsiint-api/shared";

import type { PolicyLink } from "./policies.interface.ts";

export function formatPolicies(
  policies: Awaited<ReturnType<PolicyRegistry["getPolicyNames"]>>,
  page: number,
  pageSize: number,
  baseUrl: string,
): PaginatedList<PolicyLink> {
  const total = Number(policies.total);

  // Reshape items
  const items = policies.items.map((policyName) => {
    return {
      href: `${baseUrl}/${policyName}`,
      policyName,
    };
  });

  return paginate<PolicyLink>(items, baseUrl, total, page, pageSize);
}
