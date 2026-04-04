import { CacheModule } from "@nestjs/cache-manager";
import { Logger, Module } from "@nestjs/common";

import { ApiConfigModule } from "../../config/configuration.ts";
import { AuthorisationController } from "./authorisation.controller.ts";
import { AuthorisationService } from "./authorisation.service.ts";

@Module({
  controllers: [AuthorisationController],
  imports: [ApiConfigModule, CacheModule.register()],
  providers: [Logger, AuthorisationService],
})
export class AuthorisationModule {}
