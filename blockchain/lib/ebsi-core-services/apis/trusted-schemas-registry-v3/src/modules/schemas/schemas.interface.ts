export interface GetSchemaRevisionMetadataListResponse {
  href: string;
  metadataId: string;
}

export interface GetSchemaRevisionsResponse {
  href: string;
  schemaRevisionId: string;
}

export interface GetSchemasResponse {
  href: string;
  schemaId: string;
}

export interface ItemsList {
  items: string[];
  total: number;
}
