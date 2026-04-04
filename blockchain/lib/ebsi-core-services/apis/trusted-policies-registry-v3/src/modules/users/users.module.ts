import { Logger, Module } from "@nestjs/common";

import { ApiConfigModule } from "../../config/configuration.ts";
import { LedgerModule } from "../ledger/ledger.module.ts";
import { UsersController } from "./users.controller.ts";
import { UsersService } from "./users.service.ts";

@Module({
  controllers: [UsersController],
  imports: [ApiConfigModule, LedgerModule],
  providers: [Logger, UsersService],
})
export class UsersModule {}
