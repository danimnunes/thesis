import type { PaginatedList } from "@ebsiint-api/shared";

import { Accepts } from "@ebsiint-api/shared";
import { Controller, Get, Param, Query } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { ApiConfig } from "../../config/configuration.ts";
import type { Contract, ContractsLink } from "./contracts.interface.ts";

import { formatContracts } from "./contracts.formatter.ts";
import { ContractsService } from "./contracts.service.ts";
import { GetContractParamsDto, GetContractsDto } from "./dto/index.ts";

@Controller("/contracts")
export class ContractsController {
  private readonly contractsService: ContractsService;
  private readonly configService: ConfigService<ApiConfig, true>;

  constructor(
    contractsService: ContractsService,
    configService: ConfigService<ApiConfig, true>,
  ) {
    this.contractsService = contractsService;
    this.configService = configService;
  }

  @Accepts("application/json")
  @Get("")
  async getContracts(
    @Query() query: GetContractsDto,
  ): Promise<PaginatedList<ContractsLink>> {
    const contracts = await this.contractsService.getContracts(
      query["page[after]"],
      query["page[size]"],
    );

    const apiUrlPrefix = this.configService.get("apiUrlPrefix", {
      infer: true,
    });
    const domain = this.configService.get("domain", { infer: true });
    const baseUrl = `${domain}${apiUrlPrefix}/contracts`;

    return formatContracts(
      contracts,
      query["page[after]"],
      query["page[size]"],
      baseUrl,
    );
  }

  @Accepts("application/json")
  @Get("/:address")
  async getContract(@Param() params: GetContractParamsDto): Promise<Contract> {
    const { address } = params;

    return await this.contractsService.getContract(address);
  }
}
