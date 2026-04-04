import { IsHexadecimal, IsOptional, Length, Matches } from "class-validator";

import { GetIssuerParamsDto } from "./get-issuer.params.dto.ts";

export class GetIssuerProxyParamsDto extends GetIssuerParamsDto {
  @Matches(/^0x/, { message: "proxyId must start with 0x" })
  @IsHexadecimal()
  @Length(66, 66, { message: "proxyId must have 66 characters" })
  "proxyId": string;

  @IsOptional()
  "path"?: string;
}
