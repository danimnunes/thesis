import type { Timestamp } from "@ebsiint-sc/timestamp-v4";

import { isEthersError, NotFoundError } from "@ebsiint-api/shared";
import { Timestamp__factory } from "@ebsiint-sc/timestamp-v4";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { ApiConfig } from "../../config/configuration.ts";
import type { HashAlgorithmResponseObject } from "./hash-algorithms.interface.ts";

import { LedgerService } from "../ledger/ledger.service.ts";

@Injectable()
export class HashAlgorithmsService {
  private readonly contract: Timestamp;

  private readonly ledgerService: LedgerService;

  private readonly logger = new Logger(HashAlgorithmsService.name);

  constructor(
    configService: ConfigService<ApiConfig, true>,
    ledgerService: LedgerService,
  ) {
    this.ledgerService = ledgerService;
    const contractAddress = configService.get("contractAddr", {
      infer: true,
    });
    this.contract = Timestamp__factory.connect(contractAddress);
  }

  async getHashAlgorithm(
    hashAlgorithmId: number,
  ): Promise<HashAlgorithmResponseObject> {
    let hashAlgorithm: Awaited<ReturnType<Timestamp["getHashAlgorithmById"]>>;

    const provider = this.ledgerService.getProvider();

    try {
      hashAlgorithm = await this.contract
        // @ts-expect-error Error due to contracts using CommonJS modules
        .connect(provider)
        .getHashAlgorithmById(hashAlgorithmId);
    } catch (error) {
      if (isEthersError(error)) {
        this.logger.error(error, error.stack);
      }
      throw new NotFoundError("Hash algorithm Not Found", {
        detail: `Hash algorithm ${hashAlgorithmId} not found`,
      });
    }

    const { ianaName, multiHash, oid, outputLength, status } = hashAlgorithm;

    return {
      ianaName,
      multihash: multiHash,
      oid,
      outputLengthBits: Number(outputLength),
      // 1: active - 2: revoked
      status: status === 1n ? "active" : "revoked",
    };
  }

  async getHashAlgorithms(
    page: number,
    pageSize: number,
  ): Promise<ReturnType<Timestamp["getHashAlgorithms"]>> {
    const provider = this.ledgerService.getProvider();

    try {
      return await this.contract
        // @ts-expect-error Error due to contracts using CommonJS modules
        .connect(provider)
        .getHashAlgorithms(page, pageSize);
    } catch (error) {
      if (isEthersError(error)) {
        this.logger.error(error, error.stack);
      }
      throw new NotFoundError("Failed to get hash algorithms", {
        detail: "Failed to get hash algorithms",
      });
    }
  }
}
