import { Logger, Module } from "@nestjs/common";

import { ApiConfigModule } from "../../config/configuration.ts";
import { LedgerModule } from "../ledger/ledger.module.ts";
import { DocumentsController } from "./documents.controller.ts";
import { DocumentsService } from "./documents.service.ts";

@Module({
  controllers: [DocumentsController],
  imports: [ApiConfigModule, LedgerModule],
  providers: [Logger, DocumentsService],
})
export class DocumentsModule {}
