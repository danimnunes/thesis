import { Logger, Module } from "@nestjs/common";

import { ApiConfigModule } from "../../config/configuration.ts";
import { LedgerModule } from "../ledger/ledger.module.ts";
import { IssuersController } from "./issuers.controller.ts";
import { IssuersService } from "./issuers.service.ts";

@Module({
  controllers: [IssuersController],
  imports: [ApiConfigModule, LedgerModule],
  providers: [Logger, IssuersService],
})
export class IssuersModule {}
