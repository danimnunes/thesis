import type { PolicyRegistry } from "@ebsiint-sc/trusted-policies-registry-v3";

import { isEthersError, NotFoundError } from "@ebsiint-api/shared";
import { PolicyRegistry__factory } from "@ebsiint-sc/trusted-policies-registry-v3";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { ApiConfig } from "../../config/configuration.ts";
import type { PolicyResponseObject } from "./policies.interface.ts";

import { LedgerService } from "../ledger/ledger.service.ts";

@Injectable()
export class PoliciesService {
  private readonly contract: PolicyRegistry;

  private readonly ledgerService: LedgerService;

  private readonly logger = new Logger(PoliciesService.name);

  constructor(
    configService: ConfigService<ApiConfig, true>,
    ledgerService: LedgerService,
  ) {
    this.ledgerService = ledgerService;
    const contractAddress = configService.get("contractAddr", { infer: true });
    this.contract = PolicyRegistry__factory.connect(contractAddress);
  }

  async getPolicy(policyName: string): Promise<PolicyResponseObject> {
    const provider = this.ledgerService.getProvider();

    let policy: Awaited<ReturnType<PolicyRegistry["getPolicy(string)"]>>;

    try {
      policy = await this.contract
        // @ts-expect-error Error due to CommonJS vs ESM modules imports
        .connect(provider)
        ["getPolicy(string)"](policyName);
    } catch (error) {
      if (isEthersError(error)) {
        this.logger.error(error.message, error.stack);
      }
      throw new NotFoundError("Policy Not Found", {
        detail: `Policy ${policyName} not found`,
      });
    }

    return {
      description: policy.description,
      policyId: BigInt(policy.policyId).toString(),
      policyName: policy.policyName,
      status: policy.status,
    };
  }

  async getPolicyNames(
    page: number,
    pageSize: number,
  ): ReturnType<PolicyRegistry["getPolicyNames"]> {
    const provider = this.ledgerService.getProvider();

    try {
      return await this.contract
        // @ts-expect-error Error due to CommonJS vs ESM modules imports
        .connect(provider)
        .getPolicyNames(page, pageSize);
    } catch (error) {
      if (isEthersError(error)) {
        this.logger.error(error.message, error.stack);
      }
      throw new NotFoundError("Policies not found", {
        detail: "Policies not found",
      });
    }
  }
}
