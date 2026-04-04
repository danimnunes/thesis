import { Accepts, Log } from "@ebsiint-api/shared";
import { ProxyFactory__factory } from "@ebsiint-sc/trusted-contracts-registry-v1";
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
    return ProxyFactory__factory.abi;
  }
}
