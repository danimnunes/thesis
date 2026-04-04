import { IsMultibase64urlEncoded } from "@ebsiint-api/shared";
import { Type } from "class-transformer";
import { IsNumber, Min } from "class-validator";

export class GetRecordVersionDto {
  @IsMultibase64urlEncoded()
  recordId!: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number) // We receive a string (in the URL), we must convert it to Number
  versionId!: string;
}
