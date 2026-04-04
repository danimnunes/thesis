import { Logger, Module } from "@nestjs/common";

import { ApiConfigModule } from "../../config/configuration.ts";
import { LedgerModule } from "../ledger/ledger.module.ts";
import { SchemasController } from "./schemas.controller.ts";
import { SchemasService } from "./schemas.service.ts";

@Module({
  controllers: [SchemasController],
  imports: [ApiConfigModule, LedgerModule],
  providers: [Logger, SchemasService],
})
export class SchemasModule {}
