import { IsDidV1 } from "@ebsiint-api/shared";

export class HeadAccessesDto {
  @IsDidV1()
  "creator"!: string;
}
