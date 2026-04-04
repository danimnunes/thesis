import type { ProxyTemplateRegistry } from "@ebsiint-sc/trusted-contracts-registry-v1";

import { isEthersError, NotFoundError } from "@ebsiint-api/shared";
import { ProxyTemplateRegistry__factory } from "@ebsiint-sc/trusted-contracts-registry-v1";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ethers } from "ethers";

import type { ApiConfig } from "../../config/configuration.ts";
import type { Template } from "./templates.interface.ts";

import { LedgerService } from "../ledger/ledger.service.ts";

@Injectable()
export class TemplatesService {
  private readonly contract: ProxyTemplateRegistry;

  private readonly ledgerService: LedgerService;

  private readonly logger = new Logger(TemplatesService.name);

  constructor(
    configService: ConfigService<ApiConfig, true>,
    ledgerService: LedgerService,
  ) {
    this.ledgerService = ledgerService;
    const contractAddress = configService.get("proxyTemplateContractAddr", {
      infer: true,
    });
    this.contract = ProxyTemplateRegistry__factory.connect(contractAddress);
  }

  async getTemplate(id: string): Promise<Template> {
    const provider = this.ledgerService.getProvider();

    let template: Awaited<ReturnType<ProxyTemplateRegistry["getTemplate"]>>;

    try {
      template = await this.contract
        // @ts-expect-error Error due to CommonJS vs ESM modules imports
        .connect(provider)
        .getTemplate(id);
    } catch (error) {
      if (isEthersError(error)) {
        this.logger.error(error, error.stack);
      }
      throw new NotFoundError("Template Not Found", {
        detail: `Template ${id} not found`,
      });
    }

    if (template.beaconAddress === ethers.ZeroAddress) {
      throw new NotFoundError("Template Not Found", {
        detail: `Template ${id} not found`,
      });
    }

    return {
      auditURI: template.auditURI,
      beaconAddress: template.beaconAddress,
      contractHash: template.contractHash,
      id,
      initSelector: template.initSelector,
      isActive: template.isActive,
      name: template.name,
      repoURI: template.repoURI,
      storageLayoutHash: template.storageLayoutHash,
      version: template.version,
    };
  }

  async getTemplates(
    page: number,
    pageSize: number,
  ): ReturnType<ProxyTemplateRegistry["getTemplateIds"]> {
    const provider = this.ledgerService.getProvider();

    try {
      return await this.contract
        // @ts-expect-error Error due to CommonJS vs ESM modules imports
        .connect(provider)
        .getTemplateIds(page, pageSize);
    } catch (error) {
      if (isEthersError(error)) {
        this.logger.error(error, error.stack);
      }
      throw new NotFoundError("No template found", {
        detail: "No template found",
      });
    }
  }
}
