import type { PaginatedList } from "@ebsiint-api/shared";

import { Accepts } from "@ebsiint-api/shared";
import { Controller, Get, Param, Query } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { ApiConfig } from "../../config/configuration.ts";
import type { Template, TemplatesLink } from "./templates.interface.ts";

import { GetTemplateParamsDto, GetTemplatesDto } from "./dto/index.ts";
import { formatTemplates } from "./templates.formatter.ts";
import { TemplatesService } from "./templates.service.ts";

@Controller("/templates")
export class TemplatesController {
  private readonly templatesService: TemplatesService;
  private readonly configService: ConfigService<ApiConfig, true>;

  constructor(
    templatesService: TemplatesService,
    configService: ConfigService<ApiConfig, true>,
  ) {
    this.templatesService = templatesService;
    this.configService = configService;
  }

  @Accepts("application/json")
  @Get("")
  async getTemplates(
    @Query() query: GetTemplatesDto,
  ): Promise<PaginatedList<TemplatesLink>> {
    const templates = await this.templatesService.getTemplates(
      query["page[after]"],
      query["page[size]"],
    );

    const apiUrlPrefix = this.configService.get("apiUrlPrefix", {
      infer: true,
    });
    const domain = this.configService.get("domain", { infer: true });
    const baseUrl = `${domain}${apiUrlPrefix}/templates`;

    return formatTemplates(
      templates,
      query["page[after]"],
      query["page[size]"],
      baseUrl,
    );
  }

  @Accepts("application/json")
  @Get("/:id")
  async getTemplate(@Param() params: GetTemplateParamsDto): Promise<Template> {
    const { id } = params;

    return await this.templatesService.getTemplate(id);
  }
}
