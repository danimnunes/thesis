import { IsDidV1 } from "@ebsiint-api/shared";

export class GetIssuerParamsDto {
  @IsDidV1()
  "did": string;
}
