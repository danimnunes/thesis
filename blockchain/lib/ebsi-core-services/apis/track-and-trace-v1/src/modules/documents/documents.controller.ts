import type { PaginatedList } from "@ebsiint-api/shared";

import { Accepts } from "@ebsiint-api/shared";
import { Controller, Get, Param, Query } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { ApiConfig } from "../../config/configuration.ts";
import type {
  Access,
  Document,
  Document__deprecated,
  DocumentEventsLink,
  DocumentsLink,
  Event,
} from "./documents.interface.ts";

import {
  formatDocumentAccesses,
  formatDocumentEvents,
  formatDocuments,
} from "./documents.formatter.ts";
import { DocumentsService } from "./documents.service.ts";
import {
  GetDocumentAccessesDto,
  GetDocumentAccessesParamsDto,
  GetDocumentEventParamsDto,
  GetDocumentEventsDto,
  GetDocumentEventsParamsDto,
  GetDocumentParamsDto,
  GetDocumentQueryDto,
  GetDocumentsDto,
} from "./dto/index.ts";

@Controller("/documents")
export class DocumentsController {
  private readonly documentsService: DocumentsService;
  private readonly configService: ConfigService<ApiConfig, true>;

  constructor(
    documentsService: DocumentsService,
    configService: ConfigService<ApiConfig, true>,
  ) {
    this.documentsService = documentsService;
    this.configService = configService;
  }

  @Accepts("application/json")
  @Get("")
  async getDocuments(
    @Query() query: GetDocumentsDto,
  ): Promise<PaginatedList<DocumentsLink>> {
    const documents = await this.documentsService.getDocuments(
      query["page[after]"],
      query["page[size]"],
    );

    const apiUrlPrefix = this.configService.get("apiUrlPrefix", {
      infer: true,
    });
    const domain = this.configService.get("domain", { infer: true });
    const baseUrl = `${domain}${apiUrlPrefix}/documents`;

    return formatDocuments(
      documents,
      query["page[after]"],
      query["page[size]"],
      baseUrl,
    );
  }

  @Accepts("application/json")
  @Get("/:documentId")
  async getDocument(
    @Param() params: GetDocumentParamsDto,
    @Query() query: GetDocumentQueryDto,
  ): Promise<Document | Document__deprecated> {
    const { documentId } = params;
    const { version } = query;

    if (version === "deprecated") {
      return await this.documentsService.getDocument__deprecated(documentId);
    }

    return await this.documentsService.getDocument(documentId);
  }

  @Accepts("application/json")
  @Get("/:documentId/events")
  async getDocumentEvents(
    @Param() params: GetDocumentEventsParamsDto,
    @Query() query: GetDocumentEventsDto,
  ): Promise<PaginatedList<DocumentEventsLink>> {
    const { documentId } = params;

    const events = await this.documentsService.getDocumentEvents(
      documentId,
      query["page[after]"],
      query["page[size]"],
    );

    const apiUrlPrefix = this.configService.get("apiUrlPrefix", {
      infer: true,
    });
    const domain = this.configService.get("domain", { infer: true });
    const baseUrl = `${domain}${apiUrlPrefix}/documents/${documentId}/events`;

    return formatDocumentEvents(
      events,
      query["page[after]"],
      query["page[size]"],
      baseUrl,
    );
  }

  @Accepts("application/json")
  @Get("/:documentId/events/:eventId")
  async getDocumentEvent(
    @Param() params: GetDocumentEventParamsDto,
  ): Promise<Event> {
    const { documentId, eventId } = params;

    const event = await this.documentsService.getDocumentEvent(
      documentId,
      eventId,
    );

    return event;
  }

  @Accepts("application/json")
  @Get("/:documentId/accesses")
  async getDocumentAccesses(
    @Param() params: GetDocumentAccessesParamsDto,
    @Query() query: GetDocumentAccessesDto,
  ): Promise<PaginatedList<Access>> {
    const { documentId } = params;

    const accesses =
      await this.documentsService.getDocumentAccesses(documentId);

    const apiUrlPrefix = this.configService.get("apiUrlPrefix", {
      infer: true,
    });
    const domain = this.configService.get("domain", { infer: true });
    const baseUrl = `${domain}${apiUrlPrefix}/documents/${documentId}/accesses`;

    return formatDocumentAccesses(
      accesses,
      query["page[after]"],
      query["page[size]"],
      baseUrl,
    );
  }
}
