import { CacheModule } from "@nestjs/cache-manager";
import { Logger, Module } from "@nestjs/common";

import { ApiConfigModule } from "../../config/configuration.ts";
import { AuthService } from "./auth.service.ts";

@Module({
  exports: [AuthService],
  imports: [ApiConfigModule, CacheModule.register()],
  providers: [Logger, AuthService],
})
export class AuthModule {}
