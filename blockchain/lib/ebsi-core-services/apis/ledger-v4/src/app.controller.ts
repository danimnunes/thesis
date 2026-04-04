import { Accepts, Log } from "@ebsiint-api/shared";
import { Controller, Get } from "@nestjs/common";

@Controller()
export class AppController {
  @Accepts("text/plain")
  @Get()
  @Log({ logRequest: false })
  root(): string {
    return "ok";
  }
}
