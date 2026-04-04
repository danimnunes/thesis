import { IsIn, IsOptional } from "class-validator";

export class GetIssuerQueryDto {
  @IsOptional()
  @IsIn(["deprecated", "latest"])
  "version"?: "deprecated" | "latest";
}
