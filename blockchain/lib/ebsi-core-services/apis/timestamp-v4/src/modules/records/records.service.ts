import type { Timestamp } from "@ebsiint-sc/timestamp-v4";

import {
  BadRequestError,
  getErrorMessage,
  isEthersError,
  multibase,
  NotFoundError,
  remove0xPrefix,
} from "@ebsiint-api/shared";
import { Timestamp__factory } from "@ebsiint-sc/timestamp-v4";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { ApiConfig } from "../../config/configuration.ts";
import type {
  InfoObject,
  RecordResponseObject,
  RecordVersionResponseObject,
} from "./records.interface.ts";

import { LedgerService } from "../ledger/ledger.service.ts";

@Injectable()
export class RecordsService {
  private readonly contract: Timestamp;

  private readonly ledgerService: LedgerService;

  private readonly logger = new Logger(RecordsService.name);

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

  async getRecord(recordIdEncoded: string): Promise<RecordResponseObject> {
    let record: Awaited<ReturnType<Timestamp["getRecord"]>>;

    const recordId = `0x${Buffer.from(
      multibase.base64url.decode(recordIdEncoded),
    ).toString("hex")}`;

    const provider = this.ledgerService.getProvider();

    try {
      record = await this.contract
        // @ts-expect-error Error due to contracts using CommonJS modules
        .connect(provider)
        .getRecord(recordId);
    } catch (error) {
      if (isEthersError(error)) {
        this.logger.error(error, error.stack);
      }
      throw new NotFoundError("Record Not Found", {
        detail: `Record ${recordIdEncoded} not found`,
      });
    }

    const { ownerIds, revokedOwnerIds, totalVersions } = record;

    let firstVersionTimestamps: string[];
    let lastVersionTimestamps: string[];
    try {
      const { hashValues: firstHashes } = await this.contract
        // @ts-expect-error Error due to contracts using CommonJS modules
        .connect(provider)
        .getRecordVersion(
          recordId,
          0,
          1,
          10, // max hashes per version
        );
      firstVersionTimestamps = firstHashes;

      const { hashValues: lastHashes } = await this.contract
        // @ts-expect-error Error due to contracts using CommonJS modules
        .connect(provider)
        .getRecordVersion(
          recordId,
          Number(totalVersions) - 1,
          1,
          10, // max hashes per version
        );
      lastVersionTimestamps = lastHashes;
    } catch (error) {
      if (isEthersError(error)) {
        this.logger.error(error, error.stack);
      }
      throw new NotFoundError("Record Not Found", {
        detail: "Record not found",
      });
    }

    return {
      firstVersionTimestamps,
      lastVersionTimestamps,
      ownerIds,
      revokedOwnerIds,
      totalVersions: Number(totalVersions),
    };
  }

  async getRecordIds(
    page: number,
    pageSize: number,
  ): ReturnType<Timestamp["getRecordIds"]> {
    const provider = this.ledgerService.getProvider();

    try {
      return await this.contract
        // @ts-expect-error Error due to contracts using CommonJS modules
        .connect(provider)
        .getRecordIds(page, pageSize);
    } catch (error) {
      if (isEthersError(error)) {
        this.logger.error(error, error.stack);
      }
      throw new BadRequestError("Invalid page or pageSize", {
        detail: "Invalid page or pageSize",
      });
    }
  }

  async getRecordIdsByFirstVersionHash(
    firstVersion: string,
    page: number,
    pageSize: number,
  ): ReturnType<Timestamp["getRecordIdsByFirstVersionHash"]> {
    const provider = this.ledgerService.getProvider();

    try {
      return await this.contract
        // @ts-expect-error Error due to contracts using CommonJS modules
        .connect(provider)
        .getRecordIdsByFirstVersionHash(firstVersion, page, pageSize);
    } catch (error) {
      if (isEthersError(error)) {
        this.logger.error(error, error.stack);
      }
      throw new BadRequestError("Invalid firstVersion, page or pageSize", {
        detail: "Invalid firstVersion, page or pageSize",
      });
    }
  }

  async getRecordIdsByOwnerId(
    owner: string,
    page: number,
    pageSize: number,
  ): ReturnType<Timestamp["getRecordIdsByOwnerId"]> {
    const provider = this.ledgerService.getProvider();

    try {
      return await this.contract
        // @ts-expect-error Error due to contracts using CommonJS modules
        .connect(provider)
        .getRecordIdsByOwnerId(owner.toLowerCase(), page, pageSize);
    } catch (error) {
      if (isEthersError(error)) {
        this.logger.error(error, error.stack);
      }
      throw new BadRequestError("Invalid owner, page or pageSize", {
        detail: "Invalid owner, page or pageSize",
      });
    }
  }

  async getRecordVersion(
    recordIdEncoded: string,
    versionId: string,
  ): Promise<RecordVersionResponseObject> {
    const recordId = `0x${Buffer.from(
      multibase.base64url.decode(recordIdEncoded),
    ).toString("hex")}`;

    const totalVersions = await this.getRecordVersions(recordIdEncoded);

    if (Number(versionId) >= totalVersions) {
      throw new NotFoundError("Version Not Found", {
        detail: `Version ${versionId} not found`,
      });
    }

    const provider = this.ledgerService.getProvider();

    let hashValues: string[];
    let infoIds: string[];
    try {
      const { hashValues: hashValuesVersion, infoIds: infoIdsVersion } =
        await this.contract
          // @ts-expect-error Error due to contracts using CommonJS modules
          .connect(provider)
          .getRecordVersion(
            recordId,
            Number(versionId),
            1,
            10, // max hashes per version
          );
      hashValues = hashValuesVersion;
      infoIds = infoIdsVersion;
    } catch (error) {
      if (isEthersError(error)) {
        this.logger.error(error, error.stack);
      }
      throw new NotFoundError("Record Not Found", {
        detail: "Record not found",
      });
    }

    try {
      const contract = this.contract
        // @ts-expect-error Error due to contracts using CommonJS modules
        .connect(provider);
      const infosBytes = await Promise.all(
        infoIds.map((infoId) => contract.getRecordVersionInfo(infoId)),
      );

      const info: InfoObject[] = infosBytes.map((infoBytes) => {
        const infoString = Buffer.from(
          remove0xPrefix(infoBytes),
          "hex",
        ).toString("utf8");
        try {
          return JSON.parse(infoString) as InfoObject;
        } catch {
          throw new BadRequestError("Info can not be parsed", {
            detail: `The info related to this versionId can not be parsed to JSON. infoBytes: ${infoBytes}`,
          });
        }
      });

      return {
        hashes: hashValues,
        info,
      };
    } catch (error) {
      if (isEthersError(error)) {
        this.logger.error(error, error.stack);
      }
      throw new Error(getErrorMessage(error));
    }
  }

  async getRecordVersions(recordIdEncoded: string): Promise<number> {
    let record: Awaited<ReturnType<Timestamp["getRecord"]>>;

    const recordId = `0x${Buffer.from(
      multibase.base64url.decode(recordIdEncoded),
    ).toString("hex")}`;

    const provider = this.ledgerService.getProvider();

    try {
      record = await this.contract
        // @ts-expect-error Error due to contracts using CommonJS modules
        .connect(provider)
        .getRecord(recordId);
    } catch (error) {
      if (isEthersError(error)) {
        this.logger.error(error, error.stack);
      }
      throw new NotFoundError("Record Not Found", {
        detail: `Record ${recordIdEncoded} not found`,
      });
    }

    return Number(record.totalVersions);
  }
}
