import { CacheModule } from "@nestjs/cache-manager";
import { Module } from "@nestjs/common";

import { ApiConfigModule } from "../../config/configuration.ts";
import { AuthService } from "./auth.service.ts";
import { BearerJwtStrategy } from "./strategies/index.ts";

@Module({
  exports: [AuthService],
  imports: [ApiConfigModule, CacheModule.register()],
  providers: [AuthService, BearerJwtStrategy],
})
export class AuthModule {}
