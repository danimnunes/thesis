import { Logger, Module } from "@nestjs/common";

import { ApiConfigModule } from "../../config/configuration.ts";
import { LedgerModule } from "../ledger/ledger.module.ts";
import { ContractsController } from "./contracts.controller.ts";
import { ContractsService } from "./contracts.service.ts";

@Module({
  controllers: [ContractsController],
  imports: [ApiConfigModule, LedgerModule],
  providers: [Logger, ContractsService],
})
export class ContractsModule {}
