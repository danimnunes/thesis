import { Accepts, Log } from "@ebsiint-api/shared";
import { Timestamp__factory } from "@ebsiint-sc/timestamp-v4";
import { Controller, Get, HttpCode } from "@nestjs/common";

@Controller()
export class AppController {
  @Accepts("text/plain")
  @Get()
  @HttpCode(200)
  @Log({ logRequest: false })
  root(): string {
    return "ok";
  }

  @Accepts("application/json")
  @Get("/abi")
  @HttpCode(200)
  @Log({ logRequest: false })
  abi() {
    return Timestamp__factory.abi;
  }
}
