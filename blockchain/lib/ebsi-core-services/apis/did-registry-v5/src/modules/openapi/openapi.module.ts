import { Module } from "@nestjs/common";

import { OpenApiController } from "./openapi.controller.ts";

@Module({
  controllers: [OpenApiController],
  exports: [],
  providers: [],
})
export class OpenApiModule {}
