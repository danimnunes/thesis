import { PaginationQuery } from "@ebsiint-api/shared";
import { IsIn, IsISO8601, IsOptional } from "class-validator";

export class GetSchemaRevisionsQuery extends PaginationQuery {
  @IsOptional()
  @IsISO8601()
  "valid-at"?: string;

  @IsOptional()
  @IsIn(["deprecated", "latest"])
  "version"?: "deprecated" | "latest";
}
