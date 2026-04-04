import type { PaginatedList } from "@ebsiint-api/shared";

import { Accepts } from "@ebsiint-api/shared";
import { Controller, Get, Param, Query } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { ApiConfig } from "../../config/configuration.ts";
import type {
  HashAlgorithmLink,
  HashAlgorithmResponseObject,
} from "./hash-algorithms.interface.ts";

import { GetHashAlgorithmDto, GetHashAlgorithmsDto } from "./dto/index.ts";
import { formatHashAlgorithms } from "./hash-algorithms.formatter.ts";
import { HashAlgorithmsService } from "./hash-algorithms.service.ts";

@Controller("/hash-algorithms")
export class HashAlgorithmsController {
  private readonly hashAlgorithmsService: HashAlgorithmsService;
  private readonly configService: ConfigService<ApiConfig, true>;

  constructor(
    hashAlgorithmsService: HashAlgorithmsService,
    configService: ConfigService<ApiConfig, true>,
  ) {
    this.hashAlgorithmsService = hashAlgorithmsService;
    this.configService = configService;
  }

  @Accepts("application/json")
  @Get("")
  async getHashAlgorithms(
    @Query() query: GetHashAlgorithmsDto,
  ): Promise<PaginatedList<HashAlgorithmLink>> {
    const pageAfter = query["page[after]"];
    const pageSize = query["page[size]"];

    const hashAlgorithms = await this.hashAlgorithmsService.getHashAlgorithms(
      pageAfter,
      pageSize,
    );

    const apiUrlPrefix = this.configService.get("apiUrlPrefix", {
      infer: true,
    });
    const domain = this.configService.get("domain", { infer: true });
    const baseUrl = `${domain}${apiUrlPrefix}/hash-algorithms`;

    return formatHashAlgorithms(hashAlgorithms, pageAfter, pageSize, baseUrl);
  }

  @Accepts("application/json")
  @Get("/:hashAlgorithmId")
  async getHashAlgorithm(
    @Param() params: GetHashAlgorithmDto,
  ): Promise<HashAlgorithmResponseObject> {
    const { hashAlgorithmId } = params;
    return this.hashAlgorithmsService.getHashAlgorithm(hashAlgorithmId);
  }
}
