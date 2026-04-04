import { Accepts, Log } from "@ebsiint-api/shared";
import { DidRegistry__factory } from "@ebsiint-sc/did-registry-v5";
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
    return DidRegistry__factory.abi;
  }
}
