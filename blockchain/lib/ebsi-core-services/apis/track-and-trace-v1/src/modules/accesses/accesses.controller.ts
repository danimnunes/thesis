import { Accepts, paginate } from "@ebsiint-api/shared";
import { Controller, Get, Head, HttpCode, Query } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { ApiConfig } from "../../config/configuration.ts";
import type { Access } from "./accesses.interface.ts";

import { AccessesService } from "./accesses.service.ts";
import { HeadAccessesDto, SubjectAccessesDto } from "./dto/index.ts";

@Controller("/accesses")
export class AccessesController {
  private readonly accessesService: AccessesService;
  private readonly configService: ConfigService<ApiConfig, true>;

  constructor(
    accessesService: AccessesService,
    configService: ConfigService<ApiConfig, true>,
  ) {
    this.accessesService = accessesService;
    this.configService = configService;
  }

  @Head("")
  @HttpCode(204)
  async isCreator(@Query() query: HeadAccessesDto): Promise<void> {
    const { creator } = query;

    await this.accessesService.isCreator(creator);
  }

  @Accepts("application/json")
  @Get("")
  async getAccessesBySubject(@Query() query: SubjectAccessesDto) {
    const { "page[after]": pageAfter, "page[size]": pageSize, subject } = query;
    const allItems = await this.accessesService.getAccessesBySubject(subject);
    const total = allItems.length;
    const items = allItems.slice(
      (pageAfter - 1) * pageSize,
      pageAfter * pageSize,
    );

    const apiUrlPrefix = this.configService.get("apiUrlPrefix", {
      infer: true,
    });
    const domain = this.configService.get("domain", { infer: true });
    const baseUrl = `${domain}${apiUrlPrefix}/accesses`;

    return paginate<Access>(
      items,
      baseUrl,
      total,
      pageAfter,
      pageSize,
      `&subject=${query.subject}`,
    );
  }
}
