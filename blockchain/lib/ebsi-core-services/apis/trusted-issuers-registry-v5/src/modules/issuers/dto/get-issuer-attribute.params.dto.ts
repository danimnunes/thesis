import { IsHexadecimal } from "class-validator";

import { GetIssuerParamsDto } from "./get-issuer.params.dto.ts";

export class GetIssuerAttributeParamsDto extends GetIssuerParamsDto {
  @IsHexadecimal()
  "attributeId": string;
}
