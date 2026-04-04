import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TerminusModule } from "@nestjs/terminus";

import { ApiConfigModule } from "../../config/configuration.ts";
import { HealthController } from "./health.controller.ts";

@Module({
  controllers: [HealthController],
  imports: [
    ApiConfigModule,
    TerminusModule.forRoot({ logger: false }),
    HttpModule,
  ],
  providers: [ConfigService],
})
export class HealthModule {}
