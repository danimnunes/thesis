import { Logger, Module } from "@nestjs/common";

import { ApiConfigModule } from "../../config/configuration.ts";
import { LedgerModule } from "../ledger/ledger.module.ts";
import { SubjectsController } from "./subjects.controller.ts";
import { SubjectsService } from "./subjects.service.ts";

@Module({
  controllers: [SubjectsController],
  imports: [ApiConfigModule, LedgerModule],
  providers: [Logger, SubjectsService],
})
export class SubjectsModule {}
