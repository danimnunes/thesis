import { Type } from "class-transformer";
import { IsNumber, Min } from "class-validator";

export class GetHashAlgorithmDto {
  @IsNumber()
  @Min(0)
  @Type(() => Number) // We receive a string (in the URL), we must convert it to Number
  hashAlgorithmId!: number;
}
