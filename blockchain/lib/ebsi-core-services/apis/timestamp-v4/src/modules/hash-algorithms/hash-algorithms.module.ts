import { Logger, Module } from "@nestjs/common";

import { ApiConfigModule } from "../../config/configuration.ts";
import { LedgerModule } from "../ledger/ledger.module.ts";
import { HashAlgorithmsController } from "./hash-algorithms.controller.ts";
import { HashAlgorithmsService } from "./hash-algorithms.service.ts";

@Module({
  controllers: [HashAlgorithmsController],
  imports: [ApiConfigModule, LedgerModule],
  providers: [Logger, HashAlgorithmsService],
})
export class HashAlgorithmsModule {}
