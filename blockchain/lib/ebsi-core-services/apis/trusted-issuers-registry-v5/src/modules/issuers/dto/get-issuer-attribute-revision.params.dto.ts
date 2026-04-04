import { IsHexadecimal } from "class-validator";

import { GetIssuerAttributeParamsDto } from "./get-issuer-attribute.params.dto.ts";

export class GetIssuerAttributeRevisionParamsDto extends GetIssuerAttributeParamsDto {
  @IsHexadecimal()
  "revisionId": string;
}
