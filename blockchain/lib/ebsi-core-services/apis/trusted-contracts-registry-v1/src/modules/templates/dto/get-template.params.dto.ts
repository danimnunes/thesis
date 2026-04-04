import { Is32BytesHex } from "../validators/Is32BytesHex.ts";

export class GetTemplateParamsDto {
  @Is32BytesHex()
  "id"!: string;
}
