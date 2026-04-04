import { Logger, Module } from "@nestjs/common";

import { ApiConfigModule } from "../../config/configuration.ts";
import { LedgerModule } from "../ledger/ledger.module.ts";
import { TemplatesController } from "./templates.controller.ts";
import { TemplatesService } from "./templates.service.ts";

@Module({
  controllers: [TemplatesController],
  imports: [ApiConfigModule, LedgerModule],
  providers: [Logger, TemplatesService],
})
export class TemplatesModule {}
