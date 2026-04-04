import { IsMultihashMultibase64urlEncoded } from "@ebsiint-api/shared";

export class GetTimestampDto {
  @IsMultihashMultibase64urlEncoded()
  timestampId!: string;
}
