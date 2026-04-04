import { CacheModule } from "@nestjs/cache-manager";
import { Logger, Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";

import { ApiConfigModule } from "../../config/configuration.ts";
import { AuthService } from "./auth.service.ts";
import { BearerJwtStrategy } from "./strategies/index.ts";

@Module({
  exports: [AuthService],
  imports: [ApiConfigModule, CacheModule.register(), PassportModule],
  providers: [Logger, AuthService, BearerJwtStrategy],
})
export class AuthModule {}
