import { Logger, Module } from "@nestjs/common";

import { ApiConfigModule } from "../../config/configuration.ts";
import { LedgerModule } from "../ledger/ledger.module.ts";
import { AccessesController } from "./accesses.controller.ts";
import { AccessesService } from "./accesses.service.ts";

@Module({
  controllers: [AccessesController],
  imports: [ApiConfigModule, LedgerModule],
  providers: [Logger, AccessesService],
})
export class AccessesModule {}
