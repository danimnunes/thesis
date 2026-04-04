import { Logger, Module } from "@nestjs/common";

import { ApiConfigModule } from "../../config/configuration.ts";
import { AuthModule } from "../auth/auth.module.ts";
import { BesuController } from "./besu.controller.ts";
import { BesuService } from "./besu.service.ts";

@Module({
  controllers: [BesuController],
  imports: [ApiConfigModule, AuthModule],
  providers: [Logger, BesuService],
})
export class BesuModule {}
