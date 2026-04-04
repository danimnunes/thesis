import type { PaginatedList } from "@ebsiint-api/shared";
import type { Timestamp } from "@ebsiint-sc/timestamp-v4";

import { multibase, multihashEncode, paginate } from "@ebsiint-api/shared";

import type { TimestampLink } from "./timestamps.interface.ts";

export function formatTimestamps(
  timestamps: Awaited<ReturnType<Timestamp["getTimestamps"]>>,
  page: number,
  pageSize: number,
  baseUrl: string,
  extraQuery?: string,
): PaginatedList<TimestampLink> {
  // Reshape items
  const total = Number(timestamps.total);
  const items = timestamps.items.map((timestampId) => {
    const multibaseBase64urlTimestampId = multibase.base64url.encode(
      multihashEncode(timestampId.replace(/^0x/, ""), "sha2-256", 32),
    );

    return {
      href: `${baseUrl}/${multibaseBase64urlTimestampId}`,
      timestampId: multibaseBase64urlTimestampId,
    };
  });

  return paginate<TimestampLink>(
    items,
    baseUrl,
    total,
    page,
    pageSize,
    extraQuery,
  );
}
