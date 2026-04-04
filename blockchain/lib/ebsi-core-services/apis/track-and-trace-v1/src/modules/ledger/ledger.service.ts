import { BesuService } from "@ebsiint-api/shared";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { ApiConfig } from "../../config/configuration.ts";

@Injectable()
export class LedgerService extends BesuService {
  constructor(configService: ConfigService<ApiConfig, true>) {
    const logger = new Logger(LedgerService.name);

    const url = configService.get("besuRpcNode", { infer: true });
    const requestTimeout = configService.get("requestTimeout", { infer: true });

    super(url, requestTimeout, logger);
  }
}
