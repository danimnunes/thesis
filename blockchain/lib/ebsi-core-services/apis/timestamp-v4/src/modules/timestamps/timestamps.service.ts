import type { HashName } from "@ebsiint-api/shared";
import type { Timestamp } from "@ebsiint-sc/timestamp-v4";

import {
  InternalServerError,
  isEthersError,
  multibase,
  multihashDecode,
  multihashEncode,
  NotFoundError,
} from "@ebsiint-api/shared";
import { Timestamp__factory } from "@ebsiint-sc/timestamp-v4";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ethers } from "ethers";

import type { ApiConfig } from "../../config/configuration.ts";
import type { TimestampResponseObject } from "./timestamps.interface.ts";

import { LedgerService } from "../ledger/ledger.service.ts";

@Injectable()
export class TimestampsService {
  private readonly contract: Timestamp;

  private readonly ledgerService: LedgerService;

  private readonly logger = new Logger(TimestampsService.name);

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

  async getTimestamp(timestampId: string): Promise<TimestampResponseObject> {
    let timestamp: Awaited<ReturnType<Timestamp["getTimestamp"]>>;

    const provider = this.ledgerService.getProvider();

    try {
      const timestampIdDecoded = `0x${Buffer.from(
        multihashDecode(multibase.base64url.decode(timestampId)).digest,
      ).toString("hex")}`;

      timestamp = await this.contract
        // @ts-expect-error Error due to contracts using CommonJS modules
        .connect(provider)
        .getTimestampById(timestampIdDecoded);
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(error.message, error.stack);
      } else {
        this.logger.error(error);
      }

      throw new NotFoundError("Timestamp Not Found", {
        detail: `Timestamp ${timestampId} not found`,
      });
    }

    const { blockNumber, data, hash, timestampedBy } = timestamp;

    try {
      // Parallelize SC calls
      const [hashAlgorithm, block] = await Promise.all([
        this.contract
          // @ts-expect-error Error due to contracts using CommonJS modules
          .connect(provider)
          .getHashAlgorithmById(Number(hash.algorithm)),
        provider.getBlock(Number(blockNumber), true),
      ]);

      if (!block) {
        throw new NotFoundError("Timestamp Not Found", {
          detail: `Timestamp ${timestampId} not found`,
        });
      }

      // Multi-hash (multibase base64url)
      const { multiHash, outputLength } = hashAlgorithm;
      const multihashEncodedHash = multibase.base64.encode(
        multihashEncode(
          timestamp.hash.value,
          multiHash as HashName,
          Number(outputLength) / 8,
        ),
      );

      // Find correct tx hash
      if (block.transactions.length === 0) {
        this.logger.error(
          `Timestamp ${timestampId} refers to an empty block: ${Number(blockNumber)}`,
        );
        throw new InternalServerError(InternalServerError.defaultTitle, {
          detail: "Invalid record",
        });
      }

      // Find the transaction in the block that was sent with:
      // {
      //   hashAlgorithmIds: [..., hash.algorithm, ...],
      //   hashValues: [..., hash.value, ...],
      //   ...
      // }

      const transaction = block.prefetchedTransactions.find((tx) => {
        let parsedTx: ReturnType<
          typeof this.contract.interface.parseTransaction
        >;
        try {
          parsedTx = this.contract.interface.parseTransaction(
            ethers.Transaction.from(tx),
          );
          if (!parsedTx) return false;
        } catch {
          return false;
        }

        if (
          !Array.isArray(parsedTx.args["hashAlgorithmIds"]) ||
          !Array.isArray(parsedTx.args["hashValues"]) ||
          parsedTx.args["hashAlgorithmIds"].length === 0 ||
          parsedTx.args["hashValues"].length === 0
        ) {
          return false;
        }

        return parsedTx.args["hashAlgorithmIds"].some(
          (hashAlgId, index) =>
            // Compare hash algorithm ID
            Number(hash.algorithm) === Number(hashAlgId) &&
            // Compare hash value
            index in parsedTx.args["hashValues"] &&
            (parsedTx.args["hashValues"] as string[])[index] === hash.value,
        );
      });

      if (!transaction) {
        throw new InternalServerError(InternalServerError.defaultTitle, {
          detail: "Unable to find the corresponding transaction",
        });
      }

      const transactionHash = ethers.Transaction.from(transaction).hash;

      if (!transactionHash) {
        throw new InternalServerError(InternalServerError.defaultTitle, {
          detail: "Unable to find the corresponding transaction",
        });
      }

      return {
        blockNumber: Number(blockNumber),
        data,
        hash: multihashEncodedHash,
        timestamp: new Date(block.timestamp * 1000).toISOString(),
        timestampedBy,
        transactionHash,
      };
    } catch (error) {
      if (isEthersError(error)) {
        this.logger.error(error, error.stack);
        // Throw the user-friendly error hiding details of blockchain/besu issues
        throw new NotFoundError("Timestamp Not Found", {
          detail: `Timestamp ${timestampId} not found`,
        });
      }
      throw error;
    }
  }

  async getTimestamps(
    page: number,
    pageSize: number,
  ): ReturnType<Timestamp["getTimestamps"]> {
    const provider = this.ledgerService.getProvider();

    try {
      return await this.contract
        // @ts-expect-error Error due to contracts using CommonJS modules
        .connect(provider)
        .getTimestamps(page, pageSize);
    } catch (error) {
      if (isEthersError(error)) {
        this.logger.error(error, error.stack);
      }
      throw new NotFoundError("No timestamps found", {
        detail: "No timestamps found",
      });
    }
  }
}
