import type { ProxyFactory } from "@ebsiint-sc/trusted-contracts-registry-v1";

import { isEthersError, NotFoundError } from "@ebsiint-api/shared";
import { ProxyFactory__factory } from "@ebsiint-sc/trusted-contracts-registry-v1";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ethers } from "ethers";

import type { ApiConfig } from "../../config/configuration.ts";
import type { Contract } from "./contracts.interface.ts";

import { LedgerService } from "../ledger/ledger.service.ts";

@Injectable()
export class ContractsService {
  private readonly contract: ProxyFactory;

  private readonly ledgerService: LedgerService;

  private readonly logger = new Logger(ContractsService.name);

  constructor(
    configService: ConfigService<ApiConfig, true>,
    ledgerService: LedgerService,
  ) {
    this.ledgerService = ledgerService;
    const contractAddress = configService.get("proxyFactoryContractAddr", {
      infer: true,
    });
    this.contract = ProxyFactory__factory.connect(contractAddress);
  }

  async getContract(address: string): Promise<Contract> {
    const provider = this.ledgerService.getProvider();

    let contract: Awaited<ReturnType<ProxyFactory["getDeploymentInfo"]>>;

    try {
      contract = await this.contract
        // @ts-expect-error Error due to CommonJS vs ESM modules imports
        .connect(provider)
        .getDeployment(address);
    } catch (error) {
      if (isEthersError(error)) {
        this.logger.error(error, error.stack);
      }
      throw new NotFoundError("Contract Not Found", {
        detail: `Contract ${address} not found`,
      });
    }

    if (contract.deployer === ethers.ZeroAddress) {
      throw new NotFoundError("Contract Not Found", {
        detail: `Contract ${address} not found`,
      });
    }

    return {
      address,
      deployer: contract.deployer,
      deployerDID: contract.deployerDID,
      deploymentTimestamp: Number(contract.deploymentTimestamp),
      isActive: contract.isActive,
      templateId: contract.templateId,
    } satisfies Contract;
  }

  async getContracts(
    page: number,
    pageSize: number,
  ): ReturnType<ProxyFactory["getDeployedContracts"]> {
    const provider = this.ledgerService.getProvider();

    try {
      return await this.contract
        // @ts-expect-error Error due to CommonJS vs ESM modules imports
        .connect(provider)
        .getDeployedContracts(page, pageSize);
    } catch (error) {
      if (isEthersError(error)) {
        this.logger.error(error, error.stack);
      }
      throw new NotFoundError("No contract found", {
        detail: "No contract found",
      });
    }
  }
}
