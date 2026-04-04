import type { PaginatedList } from "@ebsiint-api/shared";
import type { DidRegistry } from "@ebsiint-sc/did-registry-v5";

import { paginate } from "@ebsiint-api/shared";

import type { DidLink } from "./identifiers.interface.ts";

export function formatIdentifiers(
  identifiers: Awaited<ReturnType<DidRegistry["getDids"]>>,
  page: number,
  pageSize: number,
  baseUrl: string,
  controller?: string,
  vMethodId?: string,
  vRelationship?: string,
): PaginatedList<DidLink> {
  const total = Number(identifiers.total);

  let extraQuery = controller ? `&controller=${controller}` : "";
  extraQuery +=
    vMethodId && vRelationship
      ? `&verification-method-id=${vMethodId}&verification-relationship=${vRelationship}`
      : "";

  // Reshape items
  const items = identifiers.items.map((did) => {
    return {
      did,
      href: `${baseUrl}/${did}`,
    };
  });

  return paginate<DidLink>(items, baseUrl, total, page, pageSize, extraQuery);
}
