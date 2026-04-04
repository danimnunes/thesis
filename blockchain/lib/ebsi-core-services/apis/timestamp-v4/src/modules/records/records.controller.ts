import type { PaginatedList } from "@ebsiint-api/shared";
import type { Timestamp } from "@ebsiint-sc/timestamp-v4";

import { Accepts } from "@ebsiint-api/shared";
import { Controller, Get, Param, Query } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { ApiConfig } from "../../config/configuration.ts";
import type {
  RecordLink,
  RecordResponseObject,
  RecordVersionResponseObject,
  VersionLink,
} from "./records.interface.ts";

import { GetRecordVersionDto } from "./dto/get-record-version.dto.ts";
import { GetRecordVersionsDto } from "./dto/get-record-versions.dto.ts";
import { GetRecordDto } from "./dto/get-record.dto.ts";
import { GetRecordsDto } from "./dto/get-records.dto.ts";
import { formatRecords, formatRecordVersions } from "./records.formatter.ts";
import { RecordsService } from "./records.service.ts";

@Controller("/records")
export class RecordsController {
  private readonly recordsService: RecordsService;
  private readonly configService: ConfigService<ApiConfig, true>;

  constructor(
    recordsService: RecordsService,
    configService: ConfigService<ApiConfig, true>,
  ) {
    this.recordsService = recordsService;
    this.configService = configService;
  }

  @Accepts("application/json")
  @Get("")
  async getRecords(
    @Query() query: GetRecordsDto,
  ): Promise<PaginatedList<RecordLink>> {
    let records: Awaited<ReturnType<Timestamp["getRecordIds"]>>;
    const pageAfter = query["page[after]"];
    const pageSize = query["page[size]"];

    if (query["first-version"]) {
      records = await this.recordsService.getRecordIdsByFirstVersionHash(
        query["first-version"],
        pageAfter,
        pageSize,
      );
    } else if (query.owner) {
      records = await this.recordsService.getRecordIdsByOwnerId(
        query.owner,
        pageAfter,
        pageSize,
      );
    } else {
      records = await this.recordsService.getRecordIds(pageAfter, pageSize);
    }

    const apiUrlPrefix = this.configService.get("apiUrlPrefix", {
      infer: true,
    });
    const domain = this.configService.get("domain", { infer: true });
    const baseUrl = `${domain}${apiUrlPrefix}/records`;

    const searchParams = new URLSearchParams();
    for (const k of Object.keys(query)) {
      const key = k as keyof GetRecordsDto;
      if (
        query[key] !== undefined &&
        key !== "page[after]" &&
        key !== "page[size]"
      ) {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        searchParams.append(key, query[key]!);
      }
    }
    const extraQuery =
      searchParams.size > 0 ? `&${searchParams.toString()}` : "";

    return formatRecords(records, pageAfter, pageSize, baseUrl, extraQuery);
  }

  @Accepts("application/json")
  @Get("/:recordId")
  async getRecord(
    @Param() params: GetRecordDto,
  ): Promise<RecordResponseObject> {
    const { recordId } = params;
    return this.recordsService.getRecord(recordId);
  }

  @Accepts("application/json")
  @Get("/:recordId/versions")
  async getRecordVersions(
    @Param() params: GetRecordDto,
    @Query() query: GetRecordVersionsDto,
  ): Promise<PaginatedList<VersionLink>> {
    const { recordId } = params;
    const totalVersions = await this.recordsService.getRecordVersions(recordId);

    const apiUrlPrefix = this.configService.get("apiUrlPrefix", {
      infer: true,
    });
    const domain = this.configService.get("domain", { infer: true });
    const baseUrl = `${domain}${apiUrlPrefix}/records/${recordId}/versions`;

    return formatRecordVersions(
      totalVersions,
      query["page[after]"],
      query["page[size]"],
      baseUrl,
    );
  }

  @Accepts("application/json")
  @Get("/:recordId/versions/:versionId")
  async getRecordVersion(
    @Param() params: GetRecordVersionDto,
  ): Promise<RecordVersionResponseObject> {
    const { recordId, versionId } = params;
    return this.recordsService.getRecordVersion(recordId, versionId);
  }
}
