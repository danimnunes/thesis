import { Logger, Module } from "@nestjs/common";

import { ApiConfigModule } from "../../config/configuration.ts";
import { LedgerModule } from "../ledger/ledger.module.ts";
import { RecordsController } from "./records.controller.ts";
import { RecordsService } from "./records.service.ts";

@Module({
  controllers: [RecordsController],
  imports: [ApiConfigModule, LedgerModule],
  providers: [Logger, RecordsService],
})
export class RecordsModule {}
