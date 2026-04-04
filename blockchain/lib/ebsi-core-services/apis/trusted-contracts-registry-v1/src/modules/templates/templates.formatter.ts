import type { PaginatedList } from "@ebsiint-api/shared";
import type { ProxyTemplateRegistry } from "@ebsiint-sc/trusted-contracts-registry-v1";

import { paginate } from "@ebsiint-api/shared";

import type { TemplatesLink } from "./templates.interface.ts";

export function formatTemplates(
  templates: Awaited<ReturnType<ProxyTemplateRegistry["getTemplateIds"]>>,
  page: number,
  pageSize: number,
  baseUrl: string,
): PaginatedList<TemplatesLink> {
  const total = Number(templates.total);

  // Reshape items
  const items = templates.items.map((id) => {
    return {
      href: `${baseUrl}/${id}`,
      id,
    };
  });

  return paginate<TemplatesLink>(items, baseUrl, total, page, pageSize);
}
