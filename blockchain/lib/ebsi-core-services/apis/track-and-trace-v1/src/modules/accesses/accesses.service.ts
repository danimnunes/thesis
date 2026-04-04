import type { TrackAndTrace } from "@ebsiint-sc/track-and-trace";

import {
  InternalServerError,
  isEthersError,
  NotFoundError,
} from "@ebsiint-api/shared";
import { TrackAndTrace__factory } from "@ebsiint-sc/track-and-trace";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ethers } from "ethers";

import type { ApiConfig } from "../../config/configuration.ts";
import type { Access } from "./accesses.interface.ts";

import { Permission } from "../../shared/constants.ts";
import { didToHex, hexToDid, permissionToString } from "../../shared/utils.ts";
import { LedgerService } from "../ledger/ledger.service.ts";

@Injectable()
export class AccessesService {
  private readonly contract: TrackAndTrace;

  private readonly ledgerService: LedgerService;

  private readonly logger = new Logger(AccessesService.name);

  constructor(
    configService: ConfigService<ApiConfig, true>,
    ledgerService: LedgerService,
  ) {
    this.ledgerService = ledgerService;
    const contractAddress = configService.get("contractAddr", {
      infer: true,
    });
    this.contract = TrackAndTrace__factory.connect(contractAddress);
  }

  async getAccessesBySubject(subject: string): Promise<Access[]> {
    const pageSize = 50;
    const provider = this.ledgerService.getProvider();
    const subjectBuffer = await didToHex(subject);
    const documentIds: string[] = [];
    let currentPage = 1;
    let accessesBySubject: Awaited<
      ReturnType<TrackAndTrace["getAccessesBySubject"]>
    >;

    do {
      try {
        accessesBySubject = await this.contract
          // @ts-expect-error Error due to CommonJS vs ESM modules imports
          .connect(provider)
          .getAccessesBySubject(subjectBuffer, currentPage, pageSize);
        currentPage += 1;
        documentIds.push(...accessesBySubject.items);
      } catch {
        // do not update documentIds
        break;
      }
    } while (Number(accessesBySubject.total) > (currentPage - 1) * pageSize);

    const accesses: Access[] = [];
    await Promise.all(
      documentIds.map(async (documentId) => {
        try {
          const [grantedByAccounts, , access] = await this.contract
            // @ts-expect-error Error due to CommonJS vs ESM modules imports
            .connect(provider)
            .getGrantedBy(documentId, subjectBuffer, [
              Permission.DELEGATE,
              Permission.WRITE,
              Permission.CREATOR,
            ]);
          for (const [i, grantedByAccount] of grantedByAccounts.entries()) {
            if (!grantedByAccount || grantedByAccount === "0x") continue;
            if (!access[i]) continue;
            const grantedBy = hexToDid(grantedByAccount);
            const permission = permissionToString(i);

            accesses.push({
              documentId,
              grantedBy,
              permission,
              subject,
            });
          }
        } catch {
          // do not update accesses
        }
      }),
    );
    return accesses;
  }

  async isCreator(did: string): Promise<void> {
    const provider = this.ledgerService.getProvider();

    let res;
    try {
      res = await this.contract
        // @ts-expect-error Error due to CommonJS vs ESM modules imports
        .connect(provider)
        .isCreator(ethers.toUtf8Bytes(did));
    } catch (error) {
      if (isEthersError(error)) {
        this.logger.error(error, error.stack);
      }

      this.logger.error(error);
      throw new InternalServerError(InternalServerError.defaultTitle);
    }

    if (!res) {
      throw new NotFoundError("Creator Not Found", {
        detail: `${did} is not allowlisted as a creator`,
      });
    }
  }
}
