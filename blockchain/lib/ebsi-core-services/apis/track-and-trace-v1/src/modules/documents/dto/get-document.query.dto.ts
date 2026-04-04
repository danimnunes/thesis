import { IsIn, IsOptional } from "class-validator";

export class GetDocumentQueryDto {
  @IsOptional()
  @IsIn(["deprecated", "latest"])
  "version"?: "deprecated" | "latest";
}
