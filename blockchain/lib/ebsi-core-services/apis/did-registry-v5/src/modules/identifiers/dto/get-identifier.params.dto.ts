import { IsDidV1 } from "@ebsiint-api/shared";

export class GetIdentifierParamsDto {
  @IsDidV1()
  "did"!: string;
}
