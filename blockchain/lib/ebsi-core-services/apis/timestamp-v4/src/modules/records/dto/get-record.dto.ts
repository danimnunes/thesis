import { IsMultibase64urlEncoded } from "@ebsiint-api/shared";

export class GetRecordDto {
  @IsMultibase64urlEncoded()
  recordId!: string;
}
