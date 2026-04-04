import { Accepts } from "@ebsiint-api/shared";
import { Controller, Get, Header } from "@nestjs/common";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";

@Controller()
export class OpenApiController {
  private spec: string;

  constructor() {
    this.spec = readFileSync(
      path.join(import.meta.dirname, "../../../api/openapi.yaml"),
      "utf8",
    );
  }

  @Accepts("application/openapi+json")
  @Get("openapi.json")
  @Header("Content-Type", "application/openapi+json")
  getJson() {
    return parse(this.spec) as JSON;
  }

  @Accepts("application/openapi+yaml")
  @Get("openapi.yaml")
  @Header("Content-Type", "application/openapi+yaml")
  getYaml() {
    return this.spec;
  }
}
