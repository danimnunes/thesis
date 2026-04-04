import type { PaginatedList } from "@ebsiint-api/shared";
import type { Timestamp } from "@ebsiint-sc/timestamp-v4";

import { multibase, paginate } from "@ebsiint-api/shared";

import type { RecordLink, VersionLink } from "./records.interface.ts";

export function formatRecords(
  records: Awaited<ReturnType<Timestamp["getRecordIds"]>>,
  page: number,
  pageSize: number,
  baseUrl: string,
  extraQuery?: string,
): PaginatedList<RecordLink> {
  // Reshape items
  const total = Number(records.total);
  const items = records.items.map((recordId) => {
    const multibaseBase64urlRecordId = multibase.base64url.encode(
      Buffer.from(recordId.replace(/^0x/, ""), "hex"),
    );

    return {
      href: `${baseUrl}/${multibaseBase64urlRecordId}`,
      recordId: multibaseBase64urlRecordId,
    };
  });

  return paginate<RecordLink>(
    items,
    baseUrl,
    total,
    page,
    pageSize,
    extraQuery,
  );
}

export function formatRecordVersions(
  totalVersions: number,
  page: number,
  pageSize: number,
  baseUrl: string,
  extraQuery?: string,
): PaginatedList<VersionLink> {
  const total = totalVersions;
  const items = Array.from({ length: total })
    .map((_, i) => i)
    .slice((page - 1) * pageSize, page * pageSize)
    .map((versionId) => ({
      href: `${baseUrl}/${versionId}`,
      versionId,
    }));

  return paginate<VersionLink>(
    items,
    baseUrl,
    total,
    page,
    pageSize,
    extraQuery,
  );
}
