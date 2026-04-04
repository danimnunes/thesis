import type { PaginatedList } from "@ebsiint-api/shared";

import { paginate } from "@ebsiint-api/shared";

import type {
  GetSchemaRevisionMetadataListResponse,
  GetSchemaRevisionsResponse,
  GetSchemasResponse,
  ItemsList,
} from "./schemas.interface.ts";

import { hexToMultibaseBase58Btc } from "./schemas.utils.ts";

export function formatSchemaRevisionMetadataList(
  metadata: ItemsList,
  page: number,
  pageSize: number,
  baseUrl: string,
): PaginatedList<GetSchemaRevisionMetadataListResponse> {
  // Reshape items
  const { total } = metadata;
  const items = metadata.items.map((metadataId) => ({
    href: `${baseUrl}/${metadataId}`,
    metadataId,
  }));

  return paginate<GetSchemaRevisionMetadataListResponse>(
    items,
    baseUrl,
    total,
    page,
    pageSize,
  );
}

export function formatSchemaRevisions(
  schemas: ItemsList,
  page: number,
  pageSize: number,
  baseUrl: string,
  validAt: string | undefined,
  version: string | undefined,
): PaginatedList<GetSchemaRevisionsResponse> {
  // Reshape items
  const { total } = schemas;
  const items = schemas.items.map((schemaRevisionId) => ({
    href: `${baseUrl}/${schemaRevisionId}`,
    schemaRevisionId,
  }));

  const extraQuery =
    validAt && version ? `&valid-at=${validAt}&version=${version}` : "";

  return paginate<GetSchemaRevisionsResponse>(
    items,
    baseUrl,
    total,
    page,
    pageSize,
    extraQuery,
  );
}

export function formatSchemas(
  schemas: ItemsList,
  page: number,
  pageSize: number,
  baseUrl: string,
): PaginatedList<GetSchemasResponse> {
  // Reshape items
  const { total } = schemas;
  const items = schemas.items.map((schema) => {
    const multibaseBase58BtcSchemaId = hexToMultibaseBase58Btc(schema);

    return {
      href: `${baseUrl}/${multibaseBase58BtcSchemaId}`,
      schemaId: multibaseBase58BtcSchemaId,
    };
  });

  return paginate<GetSchemasResponse>(items, baseUrl, total, page, pageSize);
}
