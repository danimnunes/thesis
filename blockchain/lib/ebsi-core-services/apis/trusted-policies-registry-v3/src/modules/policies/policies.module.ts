import { Logger, Module } from "@nestjs/common";

import { ApiConfigModule } from "../../config/configuration.ts";
import { LedgerModule } from "../ledger/ledger.module.ts";
import { PoliciesController } from "./policies.controller.ts";
import { PoliciesService } from "./policies.service.ts";

@Module({
  controllers: [PoliciesController],
  imports: [ApiConfigModule, LedgerModule],
  providers: [Logger, PoliciesService],
})
export class PoliciesModule {}
