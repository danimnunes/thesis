import { IsDateString, IsOptional } from "class-validator";

export class GetIdentifierQueryDto {
  @IsOptional()
  @IsDateString()
  "valid-at"?: string;
}
