import type { PaginatedList } from "@ebsiint-api/shared";
import type { Timestamp } from "@ebsiint-sc/timestamp-v4";

import { paginate } from "@ebsiint-api/shared";

import type { HashAlgorithmLink } from "./hash-algorithms.interface.ts";

export function formatHashAlgorithms(
  hashAlgorithms: Awaited<ReturnType<Timestamp["getHashAlgorithms"]>>,
  page: number,
  pageSize: number,
  baseUrl: string,
  extraQuery?: string,
): PaginatedList<HashAlgorithmLink> {
  // Reshape items
  const total = Number(hashAlgorithms.total);
  const items = hashAlgorithms.items.map((hashAlgorithmId) => ({
    hashAlgorithmId: Number(hashAlgorithmId),
    href: `${baseUrl}/${Number(hashAlgorithmId)}`,
  }));

  return paginate<HashAlgorithmLink>(
    items,
    baseUrl,
    total,
    page,
    pageSize,
    extraQuery,
  );
}
