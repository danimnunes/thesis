import type { PaginatedList } from "@ebsiint-api/shared";

import { Accepts, BadRequestError } from "@ebsiint-api/shared";
import { Controller, Get, Header, Param, Query } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { ApiConfig } from "../../config/configuration.ts";
import type {
  GetSchemaRevisionMetadataListResponse,
  GetSchemaRevisionsResponse,
  GetSchemasResponse,
} from "./schemas.interface.ts";

import {
  GetSchemaParams,
  GetSchemaRevisionMetadataParams,
  GetSchemaRevisionMetadataQuery,
  GetSchemaRevisionParams,
  GetSchemaRevisionsQuery,
  GetSchemasQuery,
} from "./dto/index.ts";
import {
  formatSchemaRevisionMetadataList,
  formatSchemaRevisions,
  formatSchemas,
} from "./schemas.formatter.ts";
import { SchemasService } from "./schemas.service.ts";

@Controller("/schemas")
export class SchemasController {
  private readonly schemasService: SchemasService;
  private readonly configService: ConfigService<ApiConfig, true>;

  constructor(
    schemasService: SchemasService,
    configService: ConfigService<ApiConfig, true>,
  ) {
    this.schemasService = schemasService;
    this.configService = configService;
  }

  @Accepts("application/json")
  @Get("")
  async getSchemas(
    @Query() query: GetSchemasQuery,
  ): Promise<PaginatedList<GetSchemasResponse>> {
    const schemas = await this.schemasService.getSchemas(
      query["page[after]"],
      query["page[size]"],
    );

    const apiUrlPrefix = this.configService.get("apiUrlPrefix", {
      infer: true,
    });
    const domain = this.configService.get("domain", { infer: true });
    const baseUrl = `${domain}${apiUrlPrefix}/schemas`;

    return formatSchemas(
      schemas,
      query["page[after]"],
      query["page[size]"],
      baseUrl,
    );
  }

  @Accepts("application/json")
  @Get("/:schemaId")
  async getSchema(@Param() params: GetSchemaParams): Promise<unknown> {
    const { schemaId } = params;
    return this.schemasService.getSchema(schemaId);
  }

  @Accepts("application/json")
  @Get("/:schemaId/revisions")
  async getSchemaRevisions(
    @Param() params: GetSchemaParams,
    @Query() query: GetSchemaRevisionsQuery,
  ): Promise<PaginatedList<GetSchemaRevisionsResponse>> {
    const { schemaId } = params;

    if (query["valid-at"] && query.version !== "deprecated") {
      throw new BadRequestError(BadRequestError.defaultTitle, {
        detail:
          "Query parameter 'version' must be set to 'deprecated' in order to use 'valid-at'",
      });
    }

    const revisions =
      query.version === "deprecated"
        ? await this.schemasService.getSchemaRevisions__deprecated(
            schemaId,
            query["page[after]"],
            query["page[size]"],
            query["valid-at"],
          )
        : await this.schemasService.getSchemaRevisions(
            schemaId,
            query["page[after]"],
            query["page[size]"],
          );

    const apiUrlPrefix = this.configService.get("apiUrlPrefix", {
      infer: true,
    });
    const domain = this.configService.get("domain", { infer: true });
    const baseUrl = `${domain}${apiUrlPrefix}/schemas/${schemaId}/revisions`;

    return formatSchemaRevisions(
      revisions,
      query["page[after]"],
      query["page[size]"],
      baseUrl,
      query["valid-at"],
      query.version,
    );
  }

  @Accepts("application/json")
  @Get("/:schemaId/revisions/:schemaRevisionId")
  async getSchemaRevision(
    @Param() params: GetSchemaRevisionParams,
  ): Promise<unknown> {
    const { schemaId, schemaRevisionId } = params;
    return this.schemasService.getSchemaRevision(schemaId, schemaRevisionId);
  }

  @Accepts("application/json")
  @Get("/:schemaId/revisions/:schemaRevisionId/metadata")
  async getSchemaRevisionMetadataList(
    @Param() params: GetSchemaRevisionParams,
    @Query() query: GetSchemaRevisionMetadataQuery,
  ): Promise<PaginatedList<GetSchemaRevisionMetadataListResponse>> {
    const { schemaId, schemaRevisionId } = params;

    const metadata = await this.schemasService.getSchemaRevisionMetadataList(
      schemaId,
      schemaRevisionId,
      query["page[after]"],
      query["page[size]"],
    );

    const apiUrlPrefix = this.configService.get("apiUrlPrefix", {
      infer: true,
    });
    const domain = this.configService.get("domain", { infer: true });
    const baseUrl = `${domain}${apiUrlPrefix}/schemas/${schemaId}/revisions/${schemaRevisionId}/metadata`;

    return formatSchemaRevisionMetadataList(
      metadata,
      query["page[after]"],
      query["page[size]"],
      baseUrl,
    );
  }

  @Accepts("application/ld+json")
  @Get("/:schemaId/revisions/:schemaRevisionId/metadata/:metadataId")
  @Header("Content-type", "application/ld+json")
  async getSchemaRevisionMetadata(
    @Param() params: GetSchemaRevisionMetadataParams,
  ): Promise<unknown> {
    const { metadataId, schemaId, schemaRevisionId } = params;

    return this.schemasService.getSchemaRevisionMetadata(
      schemaId,
      schemaRevisionId,
      metadataId,
    );
  }
}
