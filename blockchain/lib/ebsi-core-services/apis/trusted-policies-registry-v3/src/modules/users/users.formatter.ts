import type { PaginatedList } from "@ebsiint-api/shared";
import type { PolicyRegistry } from "@ebsiint-sc/trusted-policies-registry-v3";

import { paginate } from "@ebsiint-api/shared";

import type { UserLink } from "./users.interface.ts";

export function formatUsers(
  users: Awaited<ReturnType<PolicyRegistry["getUsers"]>>,
  page: number,
  pageSize: number,
  baseUrl: string,
): PaginatedList<UserLink> {
  const total = Number(users.total);

  // Reshape items
  const items = users.items.map((user) => {
    return {
      href: `${baseUrl}/${user}`,
      user,
    };
  });

  return paginate<UserLink>(items, baseUrl, total, page, pageSize);
}
