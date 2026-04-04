import type { PaginatedList } from "@ebsiint-api/shared";

import { Accepts } from "@ebsiint-api/shared";
import { Controller, Get, Param, Query } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { ApiConfig } from "../../config/configuration.ts";
import type {
  TimestampLink,
  TimestampResponseObject,
} from "./timestamps.interface.ts";

import { GetTimestampDto, GetTimestampsDto } from "./dto/index.ts";
import { formatTimestamps } from "./timestamps.formatter.ts";
import { TimestampsService } from "./timestamps.service.ts";

@Controller("/timestamps")
export class TimestampsController {
  private readonly timestampsService: TimestampsService;
  private readonly configService: ConfigService<ApiConfig, true>;

  constructor(
    timestampsService: TimestampsService,
    configService: ConfigService<ApiConfig, true>,
  ) {
    this.timestampsService = timestampsService;
    this.configService = configService;
  }

  @Accepts("application/json")
  @Get("")
  async getTimestamps(
    @Query() query: GetTimestampsDto,
  ): Promise<PaginatedList<TimestampLink>> {
    const pageAfter = query["page[after]"];
    const pageSize = query["page[size]"];

    const timestamps = await this.timestampsService.getTimestamps(
      pageAfter,
      pageSize,
    );

    const apiUrlPrefix = this.configService.get("apiUrlPrefix", {
      infer: true,
    });
    const domain = this.configService.get("domain", { infer: true });
    const baseUrl = `${domain}${apiUrlPrefix}/timestamps`;

    return formatTimestamps(timestamps, pageAfter, pageSize, baseUrl);
  }

  @Accepts("application/json")
  @Get("/:timestampId")
  async getTimestamp(
    @Param() params: GetTimestampDto,
  ): Promise<TimestampResponseObject> {
    const { timestampId } = params;
    return this.timestampsService.getTimestamp(timestampId);
  }
}
