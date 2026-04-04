import { Logger, Module } from "@nestjs/common";

import { ApiConfigModule } from "../../config/configuration.ts";
import { LedgerModule } from "../ledger/ledger.module.ts";
import { TimestampsController } from "./timestamps.controller.ts";
import { TimestampsService } from "./timestamps.service.ts";

@Module({
  controllers: [TimestampsController],
  imports: [ApiConfigModule, LedgerModule],
  providers: [Logger, TimestampsService],
})
export class TimestampsModule {}
