import { PaginationQuery } from "@ebsiint-api/shared";
import { IsIn, IsOptional } from "class-validator";

export class GetIssuerAttributeRevisionsQueryDto extends PaginationQuery {
  @IsOptional()
  @IsIn(["deprecated", "latest"])
  "version"?: "deprecated" | "latest";
}
