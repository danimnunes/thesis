import { Module } from "@nestjs/common";

import { ApiConfigModule } from "../../config/configuration.ts";
import { LedgerService } from "./ledger.service.ts";

@Module({
  exports: [LedgerService],
  imports: [ApiConfigModule],
  providers: [LedgerService],
})
export class LedgerModule {}
