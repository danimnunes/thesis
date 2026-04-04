import { IsEthereumAddress, PaginationQuery } from "@ebsiint-api/shared";
import { IsHexadecimal, IsOptional, Length, Matches } from "class-validator";

export class GetRecordsDto extends PaginationQuery {
  @IsOptional()
  @IsHexadecimal()
  @Matches(/^0x/, { message: "must start with 0x" })
  @Length(66, 66, { message: "first-version must have 66 characters" })
  "first-version"?: string;

  @IsOptional()
  @IsEthereumAddress()
  owner?: string;
}
